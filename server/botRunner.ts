/**
 * Standalone 24/7 Telegram Bot Runner
 * Runs headless without Vite dev server.
 * Ideal for Docker, Linux VPS (systemd/pm2), or GitHub Actions.
 */
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import {
  handleBotInteraction,
  getInventoryCache,
} from "./telegramService.ts";
import {
  startPeriodicSheetsSync,
  syncGoogleSheetsToInventory,
  DEFAULT_SPREADSHEET_URL,
} from "./googleSheetsSync.ts";

const token = process.env.TELEGRAM_BOT_TOKEN || "8661379316:AAGtH3hBc964NlBMVFNnfiDYT5qpzO2BlJI";
const geminiApiKey = process.env.GEMINI_API_KEY;

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-bot-runner",
        },
      },
    });
  }
  return aiClient;
}

let isRunning = true;
let lastUpdateId = 0;
let consecutiveErrors = 0;

async function startBot() {
  console.log("==========================================");
  console.log("🤖 IT Asset Telegram Bot 24/7 Runner");
  console.log(`📊 Google Sheets Target: ${DEFAULT_SPREADSHEET_URL}`);
  console.log("🔄 Real-time Google Sheets Sync: Active (every 30s)");
  console.log("==========================================");

  // 1. Initial Google Sheets Sync
  try {
    console.log("Synchronizing with Google Sheets...");
    const initialSync = await syncGoogleSheetsToInventory();
    if (initialSync.success) {
      console.log(`✅ Loaded ${initialSync.rowCount} records from Google Sheets.`);
    } else {
      console.warn(`⚠️ Warning during initial sync: ${initialSync.message}`);
    }
  } catch (e: any) {
    console.warn("Initial sync notice:", e.message);
  }

  // 2. Start periodic background sync every 30 seconds
  startPeriodicSheetsSync(30000);

  // 3. Start Long-Polling
  console.log("Starting Telegram Long-Polling...");

  while (isRunning) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 16000);

    try {
      const pollUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
      const res = await fetch(pollUrl, { signal: timeoutController.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 409) {
          console.log("[Telegram Polling] HTTP 409 (Conflict) - Another bot instance is polling. Waiting 30s...");
          await new Promise((r) => setTimeout(r, 30000));
          continue;
        }
        console.log(`[Telegram Polling HTTP ${res.status}] Standing by...`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      const data = await res.json();
      consecutiveErrors = 0;

      if (data.ok && Array.isArray(data.result)) {
        const ai = getAI();
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);

          let chatId: number | undefined;
          let inputPayload: any = null;

          if (update.message) {
            chatId = update.message.chat.id;
            if (update.message.text) {
              inputPayload = { type: "message", text: update.message.text };
            } else if (update.message.photo && update.message.photo.length > 0) {
              const highestPhoto = update.message.photo[update.message.photo.length - 1];
              try {
                const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${highestPhoto.file_id}`);
                const fileData = await fileRes.json();
                if (fileData.ok && fileData.result?.file_path) {
                  const imgRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
                  const arrayBuf = await imgRes.arrayBuffer();
                  const b64 = Buffer.from(arrayBuf).toString("base64");
                  inputPayload = { type: "photo", photoBase64: `data:image/jpeg;base64,${b64}` };
                }
              } catch (photoErr: any) {
                console.log("[Photo Download Warning]:", photoErr.message);
              }
            }
          } else if (update.callback_query) {
            chatId = update.callback_query.message?.chat?.id;
            inputPayload = { type: "callback_query", data: update.callback_query.data };

            // Acknowledge callback
            try {
              await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: update.callback_query.id }),
              });
            } catch (e) {}
          }

          if (chatId && inputPayload) {
            console.log(`[Telegram IN] chatId: ${chatId} type: ${inputPayload.type} text: ${inputPayload.text || inputPayload.data || ''}`);
            try {
              const botReply = await handleBotInteraction(chatId, inputPayload, ai);

              let safeText = botReply.text;
              if (safeText.length > 4000) {
                safeText = safeText.slice(0, 3950) + "\n\n<i>...текст сокращен</i>";
              }

              const sendBody: any = {
                chat_id: chatId,
                text: safeText,
                parse_mode: "HTML",
              };

              if (botReply.inlineKeyboard && botReply.inlineKeyboard.length > 0) {
                sendBody.reply_markup = { inline_keyboard: botReply.inlineKeyboard };
              }

              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sendBody),
              });
            } catch (handleErr: any) {
              console.error("[Bot Handler Error]:", handleErr.message);
            }
          }
        }
      }
    } catch (loopErr: any) {
      clearTimeout(timeoutId);
      if (loopErr.name !== "AbortError") {
        consecutiveErrors++;
        const backoffMs = Math.min(2000 * Math.pow(1.5, consecutiveErrors), 30000);
        console.log(`[Polling Error]: ${loopErr.message}. Backoff ${(backoffMs / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Stopping bot runner...");
  isRunning = false;
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Stopping bot runner...");
  isRunning = false;
  process.exit(0);
});

startBot();
