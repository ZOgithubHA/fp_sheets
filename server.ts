import express from "express";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";
import Papa from "papaparse";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");
import {
  setInventoryCache,
  getInventoryCache,
  getDistinctUsers,
  generateUserEquipmentCard,
  getAvailableBrandsForType,
  extractSnFromImage,
  analyzePhotoForHardwareOrDocument,
  handleBotInteraction,
  type BotEquipmentRecord,
  insertRecordForUser,
  setGoogleAppsScriptUrl,
  getGoogleAppsScriptUrl,
  getInventoryRevision,
  touchInventoryRevision,
  getLastSyncedRecordInfo,
  pushAllInventoryToGoogleSheet,
  pushRecordToGoogleSheet,
  loadStoredConfig,
  saveStoredConfig,
  deleteRecordFromInventory,
  warehouseReceipt,
  issueFromWarehouseToUser,
  returnEquipmentToWarehouse,
  getWarehouseStock,
  getWarehouseInventory,
  getWarehouseColumns,
  deleteWarehouseRecord,
  pushAllWarehouseToGoogleSheet,
  pushDualSyncToGoogleSheets,
  GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_DRIVE_FOLDER_URL,
  uploadFileToGoogleDriveViaAppsScript
} from "./server/telegramService.ts";
import {
  generateContentWithRetry,
  buildDeterministicAnalysisReport
} from "./server/geminiHelper.ts";
import {
  startPeriodicSheetsSync,
  syncGoogleSheetsToInventory,
  getLastSyncInfo,
  setSpreadsheetUrl,
  getSpreadsheetUrl,
  fetchSpreadsheetData,
  parseGoogleSheetUrl,
  DEFAULT_SPREADSHEET_URL
} from "./server/googleSheetsSync.ts";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Live Telegram Bot Polling State
let liveBotPolling = false;
let isPollingRunning = false;
const initialConfig = loadStoredConfig();
let liveBotToken = process.env.TELEGRAM_BOT_TOKEN || initialConfig.telegramToken || "8661379316:AAGtH3hBc964NlBMVFNnfiDYT5qpzO2BlJI";
let pollingAbortController: AbortController | null = null;
let lastUpdateId = 0;

async function preloadGoogleSheetInventory() {
  try {
    const res = await syncGoogleSheetsToInventory();
    if (res.success) {
      console.log(`[Startup] Preloaded ${res.rowCount} records from Google Sheets.`);
    } else {
      console.warn(`[Startup] Google Sheet preload warning: ${res.message}`);
    }
  } catch (err: any) {
    console.warn("[Startup] Preload Google Sheet attempt error:", err.message);
  }
}

async function runTelegramLongPolling() {
  if (!liveBotToken) return;
  if (isPollingRunning) {
    console.log("Telegram Bot Long-Polling is already active, skipping duplicate spawn.");
    return;
  }

  liveBotPolling = true;
  isPollingRunning = true;
  pollingAbortController = new AbortController();

  console.log("Started Telegram Bot Long-Polling...");
  let consecutiveErrors = 0;

  try {
    while (liveBotPolling) {
      // Create a timeout signal for individual getUpdates calls (15s max for a 10s poll)
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 16000);

      // Link with main polling abort controller
      const onAbort = () => timeoutController.abort();
      pollingAbortController.signal.addEventListener("abort", onAbort);

      try {
        const url = `https://api.telegram.org/bot${liveBotToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
        const res = await fetch(url, { signal: timeoutController.signal });
        clearTimeout(timeoutId);
        pollingAbortController.signal.removeEventListener("abort", onAbort);

        if (!res.ok) {
          if (res.status === 409) {
            // Another bot instance is already polling (e.g. shared preview or another tab).
            // Yield gracefully without fighting or log spamming.
            console.log("[Telegram Polling] Another bot instance is active. Standing by for 30s...");
            await new Promise((r) => setTimeout(r, 30000));
            continue;
          }

          console.log(`[Telegram Polling HTTP ${res.status}] Standing by...`);
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }

        const data = await res.json();
        // Reset error backoff on successful response
        consecutiveErrors = 0;

        if (data.ok && Array.isArray(data.result)) {
          const ai = getGeminiClient();
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);

            let chatId: number | undefined;
            let inputPayload: any = null;

            if (update.message) {
              chatId = update.message.chat.id;
              if (update.message.text) {
                inputPayload = { type: "message", text: update.message.text };
              } else if (update.message.photo && update.message.photo.length > 0) {
                // Fetch the highest resolution photo from Telegram
                const highestPhoto = update.message.photo[update.message.photo.length - 1];
                try {
                  const fileRes = await fetch(`https://api.telegram.org/bot${liveBotToken}/getFile?file_id=${highestPhoto.file_id}`);
                  const fileData = await fileRes.json();
                  if (fileData.ok && fileData.result?.file_path) {
                    const imgRes = await fetch(`https://api.telegram.org/file/bot${liveBotToken}/${fileData.result.file_path}`);
                    const arrayBuf = await imgRes.arrayBuffer();
                    const b64 = Buffer.from(arrayBuf).toString("base64");
                    inputPayload = { type: "photo", photoBase64: `data:image/jpeg;base64,${b64}` };
                  }
                } catch (photoErr: any) {
                  console.log("[Telegram Photo Download Error]:", photoErr.message);
                }
              } else if (update.message.document && (
                update.message.document.mime_type?.startsWith("image/") ||
                /\.(jpe?g|png|webp|bmp)$/i.test(update.message.document.file_name || "")
              )) {
                // Handle uncompressed photo sent as file
                try {
                  const fileRes = await fetch(`https://api.telegram.org/bot${liveBotToken}/getFile?file_id=${update.message.document.file_id}`);
                  const fileData = await fileRes.json();
                  if (fileData.ok && fileData.result?.file_path) {
                    const imgRes = await fetch(`https://api.telegram.org/file/bot${liveBotToken}/${fileData.result.file_path}`);
                    const arrayBuf = await imgRes.arrayBuffer();
                    const b64 = Buffer.from(arrayBuf).toString("base64");
                    inputPayload = { type: "photo", photoBase64: `data:image/jpeg;base64,${b64}` };
                  }
                } catch (docErr: any) {
                  console.log("[Telegram Document Photo Download Error]:", docErr.message);
                }
              }
            } else if (update.callback_query) {
              chatId = update.callback_query.message?.chat?.id;
              inputPayload = { type: "callback_query", data: update.callback_query.data };

              // Acknowledge callback query
              try {
                await fetch(`https://api.telegram.org/bot${liveBotToken}/answerCallbackQuery`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ callback_query_id: update.callback_query.id }),
                });
              } catch (e) {}
            }

            if (chatId && inputPayload) {
              console.log(`[Telegram IN] chatId: ${chatId}`, JSON.stringify(inputPayload));
              try {
                const botReply = await handleBotInteraction(chatId, inputPayload, ai);

                // Ensure message text does not exceed Telegram 4096 limit
                let safeText = botReply.text;
                if (safeText.length > 4000) {
                  safeText = safeText.slice(0, 3950) + "\n\n<i>...часть текста сокращена из-за лимита длины сообщения Telegram</i>";
                }

                // Verify all callback_data in inlineKeyboard is under 64 bytes
                let safeKeyboard = botReply.inlineKeyboard;
                if (safeKeyboard && safeKeyboard.length > 0) {
                  safeKeyboard = safeKeyboard.map(row => 
                    row.map(btn => {
                      const byteLen = Buffer.byteLength(btn.callback_data || '', 'utf8');
                      if (byteLen > 64) {
                        return {
                          ...btn,
                          callback_data: btn.callback_data.slice(0, 60)
                        };
                      }
                      return btn;
                    })
                  );
                }

                const sendPayload: any = {
                  chat_id: chatId,
                  text: safeText,
                  parse_mode: "HTML",
                };

                if (safeKeyboard && safeKeyboard.length > 0) {
                  sendPayload.reply_markup = {
                    inline_keyboard: safeKeyboard,
                  };
                }

                const sendRes = await fetch(`https://api.telegram.org/bot${liveBotToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(sendPayload),
                });

                if (!sendRes.ok) {
                  const errJson = await sendRes.json().catch(() => ({}));
                  console.log("[Telegram Send HTML fallback]", errJson);
                  // Fallback to sending without HTML parse_mode if tag parsing failed
                  const plainPayload = {
                    ...sendPayload,
                    text: safeText.replace(/<[^>]*>/g, ""),
                    parse_mode: undefined,
                  };
                  const retryRes = await fetch(`https://api.telegram.org/bot${liveBotToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(plainPayload),
                  });
                  if (!retryRes.ok) {
                    const retryErr = await retryRes.json().catch(() => ({}));
                    console.log("[Telegram Plain Send Error]", retryErr);
                  } else {
                    console.log(`[Telegram OUT] Recovered with plain text for chatId ${chatId}`);
                  }
                } else {
                  console.log(`[Telegram OUT] Successfully replied to chatId ${chatId}`);
                }

                if ((botReply as any).sendScriptDocument) {
                  try {
                    const fs = await import("fs");
                    const scriptPath = path.join(process.cwd(), "google-apps-script.js");
                    if (fs.existsSync(scriptPath)) {
                      const scriptContent = fs.readFileSync(scriptPath, "utf-8");
                      const formData = new FormData();
                      formData.append("chat_id", String(chatId));
                      formData.append("caption", "📄 Файл скрипта Google Apps Script.\n1. Откройте в вашей таблице: Расширения -> Apps Script\n2. Замените код на содержимое этого файла\n3. Нажмите 'Развернуть' -> 'Новое развертывание' -> 'Веб-приложение' (доступ: Все)\n4. Пришлите полученную ссылку мне в чат!");
                      formData.append("document", new Blob([scriptContent], { type: "text/javascript" }), "google-apps-script.js");
                      await fetch(`https://api.telegram.org/bot${liveBotToken}/sendDocument`, {
                        method: "POST",
                        body: formData,
                      });
                      console.log(`[Telegram OUT] Sent google-apps-script.js document to chatId ${chatId}`);
                    }
                  } catch (docErr) {
                    console.log("[Telegram SendDocument Error]", docErr);
                  }
                }
              } catch (err: any) {
                console.log("[Telegram Interaction Error]:", err.message || err);
                try {
                  await fetch(`https://api.telegram.org/bot${liveBotToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `⚠️ Произошла ошибка обработки: ${err.message}`,
                    }),
                  });
                } catch (e) {}
              }
            }
          }
        }
      } catch (innerErr: any) {
        clearTimeout(timeoutId);
        pollingAbortController.signal.removeEventListener("abort", onAbort);

        if (innerErr.name === "AbortError") {
          // If polling stopped deliberately, break out
          if (!liveBotPolling) break;
          // Timeout reached on long poll, just continue to next cycle cleanly
          continue;
        }

        consecutiveErrors++;
        // Apply exponential backoff with cap at 30 seconds for quiet reconnects
        const backoffMs = Math.min(2000 * Math.pow(1.5, consecutiveErrors), 30000);
        console.log(`[Telegram Polling] Standby (${(backoffMs / 1000).toFixed(0)}s)...`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  } finally {
    isPollingRunning = false;
    console.log("Telegram Bot Long-Polling stopped.");
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Fetch Google Sheet data and sync with inventory
app.post("/api/sheets/fetch", async (req, res) => {
  try {
    const { url, sheetName, gid } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing spreadsheet URL or ID" });
    }

    setSpreadsheetUrl(url);
    const syncRes = await syncGoogleSheetsToInventory(url);
    const cache = getInventoryCache();
    const parsed = parseGoogleSheetUrl(url);

    if (!syncRes.success && cache.rows.length === 0) {
      return res.status(403).json({
        error: syncRes.message || "Could not retrieve spreadsheet data",
        sheetId: parsed?.sheetId || "",
      });
    }

    return res.json({
      success: true,
      sheetId: parsed?.sheetId || "sheet",
      gid: gid || parsed?.gid || "0",
      rowCount: cache.rows.length,
      columnCount: cache.columns.length,
      columns: cache.columns,
      rows: cache.rows,
      notice: syncRes.message,
    });
  } catch (error: any) {
    console.error("Error in /api/sheets/fetch:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Real-time instant sync trigger from UI or webhook
app.post("/api/sheets/sync-now", async (req, res) => {
  try {
    const { url } = req.body || {};
    const result = await syncGoogleSheetsToInventory(url);
    const cache = getInventoryCache();
    return res.json({
      ...result,
      cacheCount: cache.rows.length,
      columns: cache.columns,
      revision: getInventoryRevision(),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Get real-time sync status & metadata
app.get("/api/sheets/sync-status", (req, res) => {
  return res.json(getLastSyncInfo());
});

// AI Analysis endpoint using Gemini
app.post("/api/analyze", async (req, res) => {
  try {
    const { prompt, datasetSummary, sampleRows, queryType, language } = req.body;

    const ai = getGeminiClient();

    const systemInstruction = `You are an elite Senior Data Analyst & IT Asset Management Specialist. 
Analyze the provided dataset, answer user questions, identify key inventory distributions, duplicate PC Domain IDs, equipment movements, and actionable insights.

Key Business Rules of this IT Inventory Dataset:
1. "Идентификатор ПК" (PC ID / Domain Name): Corresponds to the laptop's domain number. MUST BE STRICTLY UNIQUE across active assets. Always audit and report duplicate PC IDs if requested.
2. "Имя пользователя" (Username): Can be blank if unassigned.
3. "Должность" / "Подразделение" (Department/Position): Can be blank if unassigned.
4. "Тип" (Equipment Type): Standard types are: Ноутбуки, Мониторы, Мыши, Клавиатуры, Гарнитуры, Рюкзаки/Сумки, USB Type-C Hub, Сетевые фильтры, Производственное оборудование.
5. "Марка" (Brand/Model): Exact hardware specs (e.g., HP G250 i5 8GB, Lenovo L24i, TSC MH341T, etc.).
6. "S/N" (Serial Number): Hardware serial numbers, can be blank.
7. "Отметка времени" (Timestamp): Date and time of issuance/movement.
8. "Кто выдал" (Issuer): Responsible officer, default is "Зохид Зокиров".
9. "Движения" (Movement Status): Statuses include "Сдал" (Returned), "Принял" (Accepted/Issued), "Новый" (New).
10. "Запись" (Notes/Records): Notes such as recipient, broken, under repair, etc.

Provide structured, beautifully formatted markdown output.
Always respond in Russian.
Highlight duplicates, unassigned gear, equipment in repair or returned, and summary counts per employee or hardware category.`;

    const userPrompt = `
Dataset Context:
- Columns & Data Types: ${JSON.stringify(datasetSummary?.columns || [])}
- Total Rows: ${datasetSummary?.totalRows || "Unknown"}
- Summary Stats: ${JSON.stringify(datasetSummary?.stats || {})}
- Sample Records (First few rows):
${JSON.stringify(sampleRows || [], null, 2)}

User Request / Question:
${prompt || "Please conduct a comprehensive exploratory data analysis (EDA) of this dataset. Highlight key trends, distribution metrics, potential anomalies, actionable insights, and recommended visual charts."}

Language to respond in: ${language || "Russian"}
`;

    let analysisText = "";
    try {
      const response = await generateContentWithRetry(ai, {
        preferredModel: "gemini-3.7-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      analysisText = response.text || "";
    } catch (genError: any) {
      console.warn("[/api/analyze Fallback] Remote AI returned error, generating local analytical report:", genError.message);
      analysisText = buildDeterministicAnalysisReport(prompt, datasetSummary, sampleRows || []);
    }

    if (!analysisText) {
      analysisText = buildDeterministicAnalysisReport(prompt, datasetSummary, sampleRows || []);
    }

    return res.json({
      success: true,
      analysis: analysisText,
    });
  } catch (error: any) {
    console.error("Error in /api/analyze:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate AI analysis",
    });
  }
});

// Sync inventory dataset cache
app.post("/api/telegram/sync-inventory", (req, res) => {
  try {
    const { rows, columns } = req.body;
    setInventoryCache(rows || [], columns || []);
    return res.json({ success: true, count: rows?.length || 0 });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Get or set Google Apps Script Web App URL for instant live sync
app.get("/api/sheets/script-url", (req, res) => {
  return res.json({
    url: getGoogleAppsScriptUrl(),
    configured: !!getGoogleAppsScriptUrl(),
  });
});

app.post("/api/sheets/script-url", async (req, res) => {
  try {
    const { url } = req.body;
    setGoogleAppsScriptUrl(url || "");
    return res.json({ success: true, url: getGoogleAppsScriptUrl() });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Push single record or all dataset to Google Sheet immediately
app.post("/api/sheets/push-sync", async (req, res) => {
  try {
    const { record, allRows } = req.body;
    if (record) {
      const result = await pushRecordToGoogleSheet(record);
      return res.json(result);
    }
    const currentCache = getInventoryCache();
    const rowsToPush = allRows && allRows.length > 0 ? allRows : currentCache.rows;
    const result = await pushAllInventoryToGoogleSheet(rowsToPush);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Get server active inventory state and revision
app.get("/api/inventory/state", (req, res) => {
  const cache = getInventoryCache();
  return res.json({
    success: true,
    rows: cache.rows,
    columns: cache.columns,
    revision: cache.revision,
    lastNotice: getLastSyncedRecordInfo(),
    googleAppsScriptConfigured: !!getGoogleAppsScriptUrl(),
  });
});

// Warehouse endpoints: stock, receipt, issue, return, delete
app.get("/api/inventory/warehouse-stock", (req, res) => {
  try {
    const stock = getWarehouseStock();
    return res.json({ success: true, ...stock });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Full sheet «Склад» raw rows (8 canonical columns)
app.get("/api/inventory/warehouse-all", (req, res) => {
  try {
    const rows = getWarehouseInventory();
    const columns = getWarehouseColumns();
    return res.json({ success: true, rows, columns, count: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/warehouse-delete", (req, res) => {
  try {
    const { index } = req.body;
    const result = deleteWarehouseRecord(index);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/sheets/push-warehouse", async (req, res) => {
  try {
    const result = await pushAllWarehouseToGoogleSheet();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/sheets/push-dual", async (req, res) => {
  try {
    const result = await pushDualSyncToGoogleSheets();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/receipt", async (req, res) => {
  try {
    const { type, brand, document, serialNumber, quantity, photoBase64, fileName, mimeType, driveUrl } = req.body;
    const result = await warehouseReceipt({
      type,
      brand,
      document,
      serialNumber,
      quantity: quantity ? parseInt(quantity, 10) : 1,
      photoBase64,
      fileName,
      mimeType,
      driveUrl,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Google Drive Folder Info & Direct Upload via Apps Script
app.get("/api/drive/folder-info", (req, res) => {
  return res.json({
    folderId: GOOGLE_DRIVE_FOLDER_ID,
    folderUrl: GOOGLE_DRIVE_FOLDER_URL,
    configured: true,
  });
});

app.post("/api/drive/upload", async (req, res) => {
  try {
    const { photoBase64, fileName, mimeType } = req.body;
    if (!photoBase64) {
      return res.status(400).json({ error: "No photoBase64 provided" });
    }
    const result = await uploadFileToGoogleDriveViaAppsScript(photoBase64, fileName, mimeType);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/issue", async (req, res) => {
  try {
    const { itemIndex, toUser } = req.body;
    const result = await issueFromWarehouseToUser(itemIndex, toUser);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/return", async (req, res) => {
  try {
    const { record } = req.body;
    const result = await returnEquipmentToWarehouse(record);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/inventory/delete-record", async (req, res) => {
  try {
    const { record } = req.body;
    const result = await deleteRecordFromInventory(record);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// OCR Image endpoint to extract Serial Number & Hardware Model via Gemini Vision
app.post("/api/ocr/serial", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }
    const ai = getGeminiClient();
    const result = await extractSnFromImage(ai, image, mimeType || "image/jpeg");
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Error in /api/ocr/serial:", err);
    return res.status(500).json({ error: err.message || "Failed to extract S/N from photo" });
  }
});

// OCR Document endpoint for Invoices / Waybills / Receipts via Gemini Vision
app.post("/api/ocr/document", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }
    const ai = getGeminiClient();
    const result = await analyzePhotoForHardwareOrDocument(ai, image, mimeType || "image/jpeg");
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Error in /api/ocr/document:", err);
    return res.status(500).json({ error: err.message || "Failed to analyze document" });
  }
});

// Telegram Bot Interaction for Simulator & Web
app.post("/api/telegram/interact", async (req, res) => {
  try {
    const { userId, input } = req.body;
    const ai = getGeminiClient();
    const response = await handleBotInteraction(userId || "sim_user", input || { type: "message", text: "/start" }, ai);
    return res.json({ success: true, ...response });
  } catch (err: any) {
    console.error("Error in /api/telegram/interact:", err);
    return res.status(500).json({ error: err.message || "Bot interaction failed" });
  }
});

// Get distinct users list with counts
app.get("/api/telegram/users", (req, res) => {
  try {
    const users = getDistinctUsers();
    return res.json({ success: true, users });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get user equipment card
app.get("/api/telegram/user-card", (req, res) => {
  try {
    const userName = String(req.query.user || "");
    const card = generateUserEquipmentCard(userName);
    return res.json({ success: true, ...card });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get available brands for type
app.get("/api/telegram/brands", (req, res) => {
  try {
    const type = String(req.query.type || "");
    const brands = getAvailableBrandsForType(type);
    return res.json({ success: true, brands });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Bot live status
app.get("/api/telegram/status", (req, res) => {
  return res.json({
    polling: liveBotPolling,
    tokenConfigured: !!liveBotToken,
    maskedToken: liveBotToken ? `${liveBotToken.slice(0, 6)}...${liveBotToken.slice(-4)}` : null,
  });
});

// Start Live Telegram Polling
app.post("/api/telegram/start-polling", async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      liveBotToken = token.trim();
      saveStoredConfig("telegramToken", liveBotToken);
    }
    if (!liveBotToken) {
      return res.status(400).json({ error: "Telegram Bot Token is required." });
    }

    if (pollingAbortController) {
      pollingAbortController.abort();
    }
    isPollingRunning = false;
    runTelegramLongPolling().catch((e) => console.error("Polling crash:", e));

    return res.json({ success: true, message: "Telegram bot polling started!" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Stop Live Telegram Polling
app.post("/api/telegram/stop-polling", (req, res) => {
  liveBotPolling = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
  }
  return res.json({ success: true, message: "Telegram bot polling stopped." });
});

// Webhook endpoint for Telegram
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;
    const ai = getGeminiClient();

    let chatId: number | undefined;
    let inputPayload: any = null;

    if (update.message) {
      chatId = update.message.chat.id;
      if (update.message.text) {
        inputPayload = { type: "message", text: update.message.text };
      } else if (update.message.photo && update.message.photo.length > 0) {
        const highestPhoto = update.message.photo[update.message.photo.length - 1];
        if (liveBotToken) {
          const fileRes = await fetch(`https://api.telegram.org/bot${liveBotToken}/getFile?file_id=${highestPhoto.file_id}`);
          const fileData = await fileRes.json();
          if (fileData.ok && fileData.result?.file_path) {
            const imgRes = await fetch(`https://api.telegram.org/file/bot${liveBotToken}/${fileData.result.file_path}`);
            const arrayBuf = await imgRes.arrayBuffer();
            const b64 = Buffer.from(arrayBuf).toString("base64");
            inputPayload = { type: "photo", photoBase64: `data:image/jpeg;base64,${b64}` };
          }
        }
      }
    } else if (update.callback_query) {
      chatId = update.callback_query.message?.chat?.id;
      inputPayload = { type: "callback_query", data: update.callback_query.data };
    }

    if (chatId && inputPayload) {
      const botReply = await handleBotInteraction(chatId, inputPayload, ai);

      if (liveBotToken) {
        const sendPayload: any = {
          chat_id: chatId,
          text: botReply.text,
          parse_mode: "HTML",
        };
        if (botReply.inlineKeyboard && botReply.inlineKeyboard.length > 0) {
          sendPayload.reply_markup = { inline_keyboard: botReply.inlineKeyboard };
        }
        await fetch(`https://api.telegram.org/bot${liveBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sendPayload),
        });
      }
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Error in webhook:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Google Apps Script code endpoint (serves the exact google-apps-script.js file)
app.get("/api/sheets/apps-script-code", (req, res) => {
  try {
    const scriptPath = path.join(process.cwd(), "google-apps-script.js");
    if (fs.existsSync(scriptPath)) {
      const code = fs.readFileSync(scriptPath, "utf-8");
      return res.json({ code });
    }
    return res.status(404).json({ error: "google-apps-script.js not found" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Test webhook connection to Google Apps Script Web App
app.post("/api/sheets/test-webhook", async (req, res) => {
  try {
    const url = (req.body?.url || getGoogleAppsScriptUrl() || "").trim();
    if (!url) {
      return res.status(400).json({ success: false, message: "URL Google Apps Script не указан." });
    }
    console.log(`[Test Webhook] Pinging ${url}...`);
    const pingPayload = { action: "ping", test: true, timestamp: new Date().toISOString() };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(pingPayload),
      redirect: "follow",
    });

    const text = await response.text();
    console.log(`[Test Webhook Response]: HTTP ${response.status}:`, text);
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {}

    if (response.ok && (!parsed || parsed.status !== 'error')) {
      return res.json({
        success: true,
        message: parsed?.message || "Google Apps Script веб-приложение активно и готово к записи!",
      });
    } else {
      return res.json({
        success: false,
        message: parsed?.error || parsed?.message || text || `HTTP ${response.status}`,
      });
    }
  } catch (err: any) {
    console.warn("[Test Webhook Error]:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Download full project source as ZIP archive
app.get("/api/project/download-zip", (req, res) => {
  try {
    const archive = new ZipArchive({ zlib: { level: 9 } });

    res.attachment("it-asset-management-source.zip");
    archive.pipe(res);

    archive.glob("**/*", {
      cwd: process.cwd(),
      ignore: ["node_modules/**", ".git/**", "dist/**", "coverage/**", "*.log"],
      dot: true,
    });

    archive.on("error", (err: any) => {
      console.error("[Zip Archive Error]:", err);
      if (!res.headersSent) {
        res.status(500).send("Error generating zip");
      }
    });

    archive.finalize();
  } catch (err: any) {
    console.error("[Zip Route Error]:", err);
    res.status(500).json({ error: err.message });
  }
});

// Check current GitHub Git repository status
app.get("/api/github/status", (req, res) => {
  try {
    let remoteUrl = "";
    let lastCommit = "";
    try {
      remoteUrl = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    } catch {}
    try {
      lastCommit = execSync("git log -1 --pretty=format:'%h - %s (%ci)'", { encoding: "utf-8" }).trim();
    } catch {}

    return res.json({
      initialized: fs.existsSync(path.join(process.cwd(), ".git")),
      remoteUrl: remoteUrl || "https://github.com/ZOgithubHA/fp_sheets",
      lastCommit,
      suggestedUser: "ZOgithubHA",
      suggestedRepo: "fp_sheets",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Push codebase directly to user's GitHub repository via Personal Access Token
app.post("/api/github/push", async (req, res) => {
  const token = (req.body?.token || "").trim();
  const repoName = (req.body?.repoName || "fp_sheets").trim().replace(/[^a-zA-Z0-9_\-\.]/g, "-");
  const isPrivate = !!req.body?.isPrivate;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "Пожалуйста, укажите GitHub Personal Access Token (PAT).",
    });
  }

  try {
    // 1. Verify token with GitHub API
    console.log("[GitHub Push] Verifying GitHub token...");
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "AIStudio-Project-Export",
      },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.warn("[GitHub Push] User verification failed:", errText);
      return res.status(401).json({
        success: false,
        message: "Неверный GitHub Personal Access Token или истек срок его действия. Создайте токен с правами 'repo'.",
      });
    }

    const userData = await userRes.json();
    const login = userData.login || "ZOgithubHA";
    const userEmail = userData.email || "recover3633@gmail.com";
    console.log(`[GitHub Push] Authenticated as GitHub user: ${login}`);

    // 2. Check if repository already exists
    let repoExists = false;
    const checkRepoRes = await fetch(`https://api.github.com/repos/${login}/${repoName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "AIStudio-Project-Export",
      },
    });

    if (checkRepoRes.ok) {
      repoExists = true;
      console.log(`[GitHub Push] Repository ${login}/${repoName} already exists.`);
    } else {
      // 3. Create repository automatically via GitHub API
      console.log(`[GitHub Push] Creating new repository ${login}/${repoName} on GitHub...`);
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "AIStudio-Project-Export",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName,
          private: isPrivate,
          description: "IT Asset Management System & Telegram Bot (Google Sheets & Drive Sync)",
          auto_init: false,
        }),
      });

      if (!createRes.ok) {
        const createErr = await createRes.text();
        console.warn("[GitHub Push] Failed to create repo:", createErr);
        return res.status(500).json({
          success: false,
          message: `Не удалось создать репозиторий на GitHub: ${createErr}`,
        });
      }
      console.log(`[GitHub Push] Repository ${login}/${repoName} created successfully.`);
    }

    // 4. Configure Git locally, stage and commit
    if (!fs.existsSync(path.join(process.cwd(), ".git"))) {
      execSync("git init -b main", { stdio: "pipe" });
    }

    execSync(`git config user.name "${login}"`, { stdio: "pipe" });
    execSync(`git config user.email "${userEmail}"`, { stdio: "pipe" });

    execSync("git add -A", { stdio: "pipe" });

    try {
      execSync('git commit -m "IT Asset Management System & Telegram Bot (Production Ready)"', {
        stdio: "pipe",
      });
    } catch {
      // Ignore if there is nothing new to commit
    }

    execSync("git branch -M main", { stdio: "pipe" });

    // 5. Setup authenticated remote and push
    try {
      execSync("git remote remove origin", { stdio: "pipe" });
    } catch {}

    // Use x-access-token which is GitHub's standard for Personal Access Tokens
    const authRemoteUrl = `https://x-access-token:${encodeURIComponent(token)}@github.com/${login}/${repoName}.git`;
    execSync(`git remote add origin ${authRemoteUrl}`, { stdio: "pipe" });

    console.log(`[GitHub Push] Pushing commits to https://github.com/${login}/${repoName}.git ...`);

    let pushSuccess = false;
    let lastErrorDetails = "";

    // Attempt 1: Direct force push to main
    try {
      execSync("git push -u origin main --force", { stdio: "pipe" });
      pushSuccess = true;
    } catch (pushErr1: any) {
      const errStr1 = (pushErr1?.stderr ? pushErr1.stderr.toString() : "") + " " + (pushErr1?.stdout ? pushErr1.stdout.toString() : "");
      console.warn("[GitHub Push] Attempt 1 failed. Stderr:", errStr1);
      lastErrorDetails = errStr1 || pushErr1.message;

      // Attempt 2: If repo has commits and force push is rejected by protection rule
      try {
        console.log("[GitHub Push] Attempt 2: Fetching remote and merging...");
        execSync("git fetch origin main", { stdio: "pipe" });
        execSync("git merge -X ours --allow-unrelated-histories -m 'Merge sync from IT Asset Manager' origin/main", { stdio: "pipe" });
        execSync("git push -u origin main", { stdio: "pipe" });
        pushSuccess = true;
      } catch (pushErr2: any) {
        const errStr2 = (pushErr2?.stderr ? pushErr2.stderr.toString() : "") + " " + (pushErr2?.stdout ? pushErr2.stdout.toString() : "");
        console.warn("[GitHub Push] Attempt 2 failed. Stderr:", errStr2);

        // Attempt 3: If repo uses master branch instead of main
        try {
          console.log("[GitHub Push] Attempt 3: Trying master branch...");
          execSync("git branch -M master", { stdio: "pipe" });
          execSync("git push -u origin master --force", { stdio: "pipe" });
          pushSuccess = true;
          try { execSync("git branch -M main", { stdio: "pipe" }); } catch {}
        } catch (pushErr3: any) {
          try { execSync("git branch -M main", { stdio: "pipe" }); } catch {}
          const errStr3 = (pushErr3?.stderr ? pushErr3.stderr.toString() : "") + " " + (pushErr3?.stdout ? pushErr3.stdout.toString() : "");
          lastErrorDetails = errStr1 || errStr2 || errStr3 || pushErr1.message;
        }
      }
    }

    // 6. Security cleanup: sanitize remote URL immediately so token is not left in .git/config
    const cleanRemoteUrl = `https://github.com/${login}/${repoName}.git`;
    execSync(`git remote set-url origin ${cleanRemoteUrl}`, { stdio: "pipe" });

    if (!pushSuccess) {
      let friendlyMessage = `Ошибка при отправке в GitHub: ${lastErrorDetails}`;
      if (lastErrorDetails.includes("without 'workflow' scope")) {
        friendlyMessage = "GitHub отклонил пуш, так как в токене не была включена галочка 'workflow'. Создайте токен с разрешениями 'repo' и 'workflow' и повторите.";
      } else if (lastErrorDetails.includes("Protected branch") || lastErrorDetails.includes("GH006")) {
        friendlyMessage = "Ветка main в репозитории защищена (Protected Branch). В настройках репозитория GitHub (Settings -> Branches) временно разрешите push или снимите защиту.";
      } else if (lastErrorDetails.includes("Authentication failed") || lastErrorDetails.includes("Bad credentials")) {
        friendlyMessage = "Ошибка авторизации GitHub: неверный или просроченный токен (PAT).";
      }

      return res.status(500).json({
        success: false,
        message: friendlyMessage,
        rawError: lastErrorDetails,
      });
    }

    console.log(`[GitHub Push] Push completed successfully! Clean remote set to ${cleanRemoteUrl}`);

    return res.json({
      success: true,
      repoUrl: `https://github.com/${login}/${repoName}`,
      message: `Код успешно загружен в репозиторий https://github.com/${login}/${repoName}!`,
      repoName,
      login,
    });
  } catch (err: any) {
    console.error("[GitHub Push Error]:", err);
    // Ensure clean remote URL even on failure
    try {
      execSync(`git remote set-url origin https://github.com/ZOgithubHA/${repoName}.git`, {
        stdio: "pipe",
      });
    } catch {}

    const stderr = (err?.stderr ? err.stderr.toString() : "") + " " + (err?.stdout ? err.stdout.toString() : "");
    return res.status(500).json({
      success: false,
      message: `Ошибка при отправке в GitHub: ${stderr.trim() || err.message}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Start Google Sheets real-time periodic auto-sync (every 30 seconds)
    startPeriodicSheetsSync(30000);
    // Start Telegram Bot Long-Polling
    runTelegramLongPolling().catch((e) => console.error("Auto Telegram polling crash:", e));
  });
}

startServer();
