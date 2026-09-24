import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite"
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const status = String(error.status || error.code || "").toLowerCase();
  
  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("spikes in demand") ||
    msg.includes("temporarily overloaded") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("fetch failed") ||
    status === "503" ||
    status === "429" ||
    status === "unavailable"
  );
}

/**
 * Executes a generateContent call with automatic retry on 503/429 and fallback to alternate models
 */
export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, "model"> & { preferredModel?: string },
  maxRetriesPerModel = 2
): Promise<GenerateContentResponse> {
  const preferred = params.preferredModel || "gemini-3.7-flash";
  const modelsToTry = [preferred, ...CANDIDATE_MODELS.filter((m) => m !== preferred)];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`[Gemini Request] Calling model: ${model} (attempt ${attempt}/${maxRetriesPerModel})`);
        
        const response = await ai.models.generateContent({
          ...params,
          model,
        });

        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Warning] Model ${model} attempt ${attempt} failed: ${err.message}`);

        if (isRetryableError(err)) {
          // Wait with exponential backoff + jitter before retrying
          const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 4000);
          console.log(`[Gemini Retry] Waiting ${Math.round(backoffTime)}ms before retry...`);
          await sleep(backoffTime);
        } else {
          // Non-retryable error on this specific model config, try next model immediately
          break;
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

/**
 * Builds a deterministic, structured analytical report if the remote AI service is temporarily completely unreachable
 */
export function buildDeterministicAnalysisReport(
  prompt: string,
  datasetSummary: any,
  sampleRows: Record<string, any>[]
): string {
  const totalRows = datasetSummary?.totalRows || sampleRows.length || 0;
  const columns: string[] = datasetSummary?.columns || (sampleRows.length > 0 ? Object.keys(sampleRows[0]) : []);

  // Compute key metrics from sampleRows or stats
  const typeCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};
  const pcIdMap: Record<string, string[]> = {};
  let returnedCount = 0;
  let issuedCount = 0;

  sampleRows.forEach((row) => {
    const type = String(row["Тип"] || row["Type"] || "Не указан").trim();
    if (type) typeCounts[type] = (typeCounts[type] || 0) + 1;

    const user = String(row["Имя пользователя"] || row["Сотрудник"] || row["User"] || "").trim();
    if (user) userCounts[user] = (userCounts[user] || 0) + 1;

    const pcId = String(row["Идентификатор ПК"] || row["PC ID"] || "").trim();
    if (pcId && pcId !== "—" && pcId !== "-") {
      if (!pcIdMap[pcId]) pcIdMap[pcId] = [];
      pcIdMap[pcId].push(user || "Склад");
    }

    const movement = String(row["Движения"] || "").toLowerCase();
    if (movement.includes("сдал") || movement.includes("возврат")) returnedCount++;
    if (movement.includes("принял") || movement.includes("выдан")) issuedCount++;
  });

  const duplicatePcIds = Object.entries(pcIdMap).filter(([_, users]) => users.length > 1);

  return `### 📊 Аналитический отчет по учету ИТ-оборудования

> *Примечание: Из-за временной высокой нагрузки на облачный шлюз ИИ сформирован оперативный локальный срез на основе структуры и данных журнала.*

---

#### 1. Общие показатели датасета
- **Всего записей в базе:** **${totalRows}**
- **Количество отслеживаемых атрибутов:** **${columns.length}** (${columns.slice(0, 6).join(", ")}...)
- **Выдано сотрудникам (Принял):** **${issuedCount || "—"}**
- **Сдано / На складе (Сдал):** **${returnedCount || "—"}**

---

#### 2. 🔍 Аудит уникальности доменных номеров (Идентификатор ПК)
${
  duplicatePcIds.length > 0
    ? `⚠️ **Обнаружены повторяющиеся доменные номера ПК:**\n` +
      duplicatePcIds
        .map(
          ([pcId, users]) =>
            `- 🏷️ \`${pcId}\` — закреплен за: ${users.map((u) => `**${u}**`).join(", ")}`
        )
        .join("\n") +
      `\n\n*Рекомендация:* Проверьте данные позиции на предмет задвоения записей или несвоевременного списания.`
    : `✅ **Дубликатов не обнаружено:** Все проверенные доменные номера ПК уникальны.`
}

---

#### 3. 📦 Распределение оборудования по типам
${
  Object.keys(typeCounts).length > 0
    ? Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([type, cnt]) => `- **${type}:** ${cnt} ед.`)
        .join("\n")
    : "Данные о типах оборудования структурируются."
}

---

#### 4. 💡 Ключевые выводы и рекомендации
1. **Регулярный аудит:** Поддерживайте актуальность связки «Имя пользователя ⇄ Доменный ID ⇄ S/N».
2. **Учет движений:** Фиксируйте все примечания по возвратам и неисправностям в графе «Запись».
3. **Синхронизация:** Telegram-бот и веб-панель синхронизированы с Google Таблицей в реальном времени.`;
}
