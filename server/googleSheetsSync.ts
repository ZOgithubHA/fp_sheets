import Papa from "papaparse";
import {
  setInventoryCache,
  getInventoryCache,
  touchInventoryRevision,
  insertRecordForUser,
  type BotEquipmentRecord,
  type WarehouseSheetRecord,
  WAREHOUSE_HEADERS,
  getWarehouseInventory,
  setWarehouseInventoryCache,
  loadStoredConfig,
  saveStoredConfig,
} from "./telegramService.ts";

export const DEFAULT_SPREADSHEET_URL =
  process.env.SPREADSHEET_URL ||
  "https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit?usp=sharing";

const stored = loadStoredConfig();
let currentSpreadsheetUrl: string = process.env.SPREADSHEET_URL || stored.spreadsheetUrl || DEFAULT_SPREADSHEET_URL;
let lastSyncTime: number = 0;
let lastSyncStatus: string = "Не запускалась";
let lastSyncRowCount: number = 0;
let syncIntervalId: NodeJS.Timeout | null = null;
let isSyncInProgress: boolean = false;

export function parseGoogleSheetUrl(rawUrl: string): { sheetId: string; gid?: string } | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const cleanUrl = rawUrl.trim();
  const idMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  let sheetId: string | null = null;

  if (idMatch && idMatch[1]) {
    sheetId = idMatch[1];
  } else if (/^[a-zA-Z0-9-_]{20,}$/.test(cleanUrl)) {
    sheetId = cleanUrl;
  }

  if (!sheetId) return null;

  let gid: string | undefined;
  const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch && gidMatch[1]) {
    gid = gidMatch[1];
  }

  return { sheetId, gid };
}

export function getSpreadsheetUrl(): string {
  return currentSpreadsheetUrl;
}

export function setSpreadsheetUrl(url: string): void {
  if (url && url.trim()) {
    currentSpreadsheetUrl = url.trim();
    saveStoredConfig("spreadsheetUrl", currentSpreadsheetUrl);
  }
}

export function getLastSyncInfo(): {
  lastSyncTime: number;
  lastSyncStatus: string;
  rowCount: number;
  spreadsheetUrl: string;
  isSyncing: boolean;
} {
  return {
    lastSyncTime,
    lastSyncStatus,
    rowCount: lastSyncRowCount,
    spreadsheetUrl: currentSpreadsheetUrl,
    isSyncing: isSyncInProgress,
  };
}

/**
 * Fetches and parses Google Sheet data via CSV export or GViz API
 */
export async function fetchSpreadsheetData(
  targetUrl?: string,
  sheetName?: string,
  gid?: string
): Promise<{
  success: boolean;
  rows: BotEquipmentRecord[];
  columns: string[];
  sheetId: string;
  gid: string;
  rowCount: number;
  error?: string;
}> {
  const url = (targetUrl || currentSpreadsheetUrl || DEFAULT_SPREADSHEET_URL).trim();
  const parsed = parseGoogleSheetUrl(url);

  if (!parsed) {
    return {
      success: false,
      rows: [],
      columns: [],
      sheetId: "",
      gid: "0",
      rowCount: 0,
      error: "Некорректная ссылка на Google Таблицу",
    };
  }

  const { sheetId } = parsed;
  const targetGid = gid || parsed.gid || "0";

  const exportCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=${targetGid}`;
  const gvizCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : targetGid ? `&gid=${targetGid}` : ""}`;

  let csvText = "";
  let fetchErrorMsg = "";

  // 1. Try public CSV export endpoint
  try {
    const response = await fetch(exportCsvUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (response.ok) {
      const text = await response.text();
      if (text && !text.trim().startsWith("<!DOCTYPE html") && !text.includes("<html")) {
        csvText = text;
      }
    }
  } catch (err: any) {
    fetchErrorMsg += `Export error: ${err.message}. `;
  }

  // 2. Fallback: Google Visualization API CSV
  if (!csvText) {
    try {
      const response2 = await fetch(gvizCsvUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (response2.ok) {
        const text2 = await response2.text();
        if (text2 && !text2.trim().startsWith("<!DOCTYPE html") && !text2.includes("<html")) {
          csvText = text2;
        }
      }
    } catch (err: any) {
      fetchErrorMsg += `GViz error: ${err.message}. `;
    }
  }

  if (!csvText) {
    return {
      success: false,
      rows: [],
      columns: [],
      sheetId,
      gid: targetGid,
      rowCount: 0,
      error: `Не удалось загрузить таблицу из Google Sheets. Убедитесь, что открыт доступ по ссылке ("Все, у кого есть ссылка могут просматривать"). Детали: ${fetchErrorMsg}`,
    };
  }

  // Parse CSV
  const parsedData = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const rawRows = (parsedData.data || []) as Record<string, any>[];
  const rawCols =
    parsedData.meta.fields || (rawRows.length > 0 ? Object.keys(rawRows[0]) : []);

  const columns = rawCols
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith("_") && c.length > 0);

  const userCol = columns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || "Имя пользователя";
  const posCol = columns.find((c) => /должность|подразделение/i.test(c)) || "Должность";
  const pcIdCol = columns.find((c) => /идентификатор|доменный|пк/i.test(c)) || "Идентификатор ПК";
  const typeCol = columns.find((c) => /тип/i.test(c)) || "Тип";
  const brandCol = columns.find((c) => /марка/i.test(c)) || "Марка";
  const snCol = columns.find((c) => /s\/n|серийный/i.test(c)) || "S/N";

  // Pass 1: Map each employee to their known position
  const userPositions: Record<string, string> = {};
  let curScanUser = "";
  for (const raw of rawRows) {
    const u = String(raw[userCol] || "").trim();
    const p = String(raw[posCol] || "").trim();
    if (u) curScanUser = u;
    if (curScanUser && p && !userPositions[curScanUser]) {
      userPositions[curScanUser] = p;
    }
  }

  // Pass 2: Normalize rows with forward-fill for employee groups
  let currentUser = "";
  let currentPosition = "";
  let currentPcId = "";

  const rows: BotEquipmentRecord[] = [];

  for (const row of rawRows) {
    const nonEmpties = Object.values(row).filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
    if (nonEmpties.length === 0) continue;

    const rowUser = String(row[userCol] || "").trim();
    const rowPos = String(row[posCol] || "").trim();
    const rowPcId = String(row[pcIdCol] || "").trim();
    const rowType = String(row[typeCol] || "").trim();
    const rowBrand = String(row[brandCol] || "").trim();
    const rowSn = String(row[snCol] || "").trim();

    if (rowUser) {
      currentUser = rowUser;
      currentPosition = rowPos || userPositions[currentUser] || "";
      currentPcId = rowPcId || currentPcId;
    } else if (rowPos) {
      currentPosition = rowPos;
      if (currentUser && !userPositions[currentUser]) {
        userPositions[currentUser] = rowPos;
      }
    }

    if (!rowType && !rowBrand && !rowSn && !rowPcId && !rowUser) {
      continue;
    }

    const cleanRow: Record<string, any> = {};
    columns.forEach((col) => {
      let val = row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : "";
      if (col === userCol && (!val || val === "")) {
        val = currentUser || "";
      } else if (col === posCol && (!val || val === "")) {
        val = currentPosition || (currentUser ? userPositions[currentUser] || "" : "");
      } else if (col === pcIdCol && (!val || val === "") && /ноут/i.test(rowType)) {
        val = currentPcId || "";
      } else if (/кто выдал|выдал|ответственный/i.test(col)) {
        if (!val || val === "") {
          val = "Зохид Зокиров";
        }
      }
      cleanRow[col] = val;
    });

    if (cleanRow[userCol]) {
      rows.push(cleanRow as BotEquipmentRecord);
    }
  }

  return {
    success: true,
    rows,
    columns,
    sheetId,
    gid: targetGid,
    rowCount: rows.length,
  };
}

/**
 * Fetches and parses the dedicated «Склад» sheet from Google Sheets
 * Strictly validates the 8-column format:
 * [№ П/П, Типы, Марка и модели, Единица измерения (м, шт.), Запись документа, Кто принял, Движение товаров, Основание]
 */
export async function fetchWarehouseSpreadsheetData(targetUrl?: string): Promise<{
  success: boolean;
  rows: WarehouseSheetRecord[];
  columns: string[];
  rowCount: number;
  error?: string;
}> {
  const url = (targetUrl || currentSpreadsheetUrl || DEFAULT_SPREADSHEET_URL).trim();
  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) {
    return { success: false, rows: [], columns: WAREHOUSE_HEADERS, rowCount: 0, error: "Некорректная ссылка" };
  }

  const { sheetId } = parsed;
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Склад")}`;

  try {
    const response = await fetch(gvizUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return { success: false, rows: [], columns: WAREHOUSE_HEADERS, rowCount: 0, error: `HTTP ${response.status}` };
    }

    const csvText = await response.text();
    if (!csvText || csvText.trim().startsWith("<!DOCTYPE html") || csvText.includes("<html")) {
      return { success: false, rows: [], columns: WAREHOUSE_HEADERS, rowCount: 0, error: "Лист «Склад» не найден или недоступен" };
    }

    const parsedData = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    const rawRows = (parsedData.data || []) as Record<string, any>[];
    const warehouseRows: WarehouseSheetRecord[] = [];

    rawRows.forEach((row, idx) => {
      // Find values matching each of the 8 canonical warehouse columns
      const rowKeys = Object.keys(row);
      const findVal = (pattern: RegExp, fallback = "") => {
        const key = rowKeys.find((k) => pattern.test(k));
        return key && row[key] !== undefined && row[key] !== null ? String(row[key]).trim() : fallback;
      };

      const type = findVal(/тип/i);
      const brand = findVal(/марка|модел/i);
      const unit = findVal(/единиц|измерен/i, "Склад ИТ (В наличии)");
      const timestamp = findVal(/запись документа|отметка|время|дата/i, new Date().toLocaleString("ru-RU"));
      const receiver = findVal(/кто принял|принял/i, "Зохид Зокиров");
      const movement = findVal(/движение/i, "Приход (Склад)");
      const doc = findVal(/основание|документ/i, "");
      const numRaw = findVal(/№|п\/п|пп/i, String(idx + 1));
      const num = parseInt(numRaw, 10) || (idx + 1);

      if (type || brand || doc) {
        warehouseRows.push({
          "№ П/П": num,
          "Типы": type || "Оборудование",
          "Марка и модели": brand || "—",
          "Единица измерения (м, шт.)": unit,
          "Запись документа": timestamp,
          "Кто принял": receiver,
          "Движение товаров": movement,
          "Основание": doc
        });
      }
    });

    return {
      success: true,
      rows: warehouseRows,
      columns: WAREHOUSE_HEADERS,
      rowCount: warehouseRows.length,
    };
  } catch (err: any) {
    return { success: false, rows: [], columns: WAREHOUSE_HEADERS, rowCount: 0, error: err.message };
  }
}

/**
 * Synchronizes both sheets from Google Sheets into active in-memory inventory:
 * 1. Лист1 (Сотрудники)
 * 2. Лист «Склад» (Оприходование и учет остатков склада)
 */
export async function syncGoogleSheetsToInventory(customUrl?: string): Promise<{
  success: boolean;
  rowCount: number;
  warehouseRowCount: number;
  message: string;
}> {
  if (isSyncInProgress) {
    return {
      success: false,
      rowCount: lastSyncRowCount,
      warehouseRowCount: getWarehouseInventory().length,
      message: "Синхронизация уже выполняется в фоне",
    };
  }

  isSyncInProgress = true;
  try {
    const url = customUrl || currentSpreadsheetUrl || DEFAULT_SPREADSHEET_URL;
    if (customUrl) {
      currentSpreadsheetUrl = customUrl;
    }

    // 1. Fetch Лист1 (Сотрудники)
    const fetched = await fetchSpreadsheetData(url);
    let mergedRows: BotEquipmentRecord[] = [];
    if (fetched.success && fetched.rows && fetched.rows.length > 0) {
      const currentCache = getInventoryCache();
      mergedRows = [...fetched.rows];

      // Preserve local records added via Bot if not yet in remote Google Sheet
      if (currentCache.rows && currentCache.rows.length > 0) {
        currentCache.rows.forEach((localItem) => {
          const localPcId = String(localItem["Идентификатор ПК"] || "").trim().toLowerCase();
          const localUser = String(localItem["Имя пользователя"] || "").trim().toLowerCase();
          const localType = String(localItem["Тип"] || "").trim().toLowerCase();
          const localBrand = String(localItem["Марка"] || "").trim().toLowerCase();
          const localSn = String(localItem["S/N"] || "").trim().toLowerCase();

          const alreadyInRemote = mergedRows.some((remoteItem) => {
            const remotePcId = String(remoteItem["Идентификатор ПК"] || "").trim().toLowerCase();
            if (localPcId && remotePcId && localPcId === remotePcId) return true;

            const remoteUser = String(remoteItem["Имя пользователя"] || "").trim().toLowerCase();
            const remoteType = String(remoteItem["Тип"] || "").trim().toLowerCase();
            const remoteBrand = String(remoteItem["Марка"] || "").trim().toLowerCase();
            const remoteSn = String(remoteItem["S/N"] || "").trim().toLowerCase();

            if (
              localUser &&
              remoteUser &&
              localUser === remoteUser &&
              localType === remoteType &&
              localBrand === remoteBrand
            ) {
              if (!localSn || localSn === "—" || !remoteSn || remoteSn === "—" || localSn === remoteSn) {
                return true;
              }
            }
            return false;
          });

          if (!alreadyInRemote && (localUser || localType || localBrand || localPcId)) {
            mergedRows = insertRecordForUser(mergedRows, localItem);
          }
        });
      }

      setInventoryCache(mergedRows, fetched.columns);
    }

    // 2. Fetch Лист «Склад»
    let warehouseRowCount = 0;
    const fetchedWarehouse = await fetchWarehouseSpreadsheetData(url);
    if (fetchedWarehouse.success && fetchedWarehouse.rows && fetchedWarehouse.rows.length > 0) {
      const currentWh = getWarehouseInventory();
      let mergedWh = [...fetchedWarehouse.rows];

      // Preserve local warehouse items not yet seen remotely
      if (currentWh && currentWh.length > 0) {
        currentWh.forEach((localWh) => {
          const lBrand = String(localWh["Марка и модели"] || "").trim().toLowerCase();
          const lType = String(localWh["Типы"] || "").trim().toLowerCase();
          const lDoc = String(localWh["Основание"] || "").trim().toLowerCase();
          const lUnit = String(localWh["Единица измерения (м, шт.)"] || "").trim().toLowerCase();

          const exists = mergedWh.some((rWh) => {
            const rBrand = String(rWh["Марка и модели"] || "").trim().toLowerCase();
            const rType = String(rWh["Типы"] || "").trim().toLowerCase();
            const rDoc = String(rWh["Основание"] || "").trim().toLowerCase();
            const rUnit = String(rWh["Единица измерения (м, шт.)"] || "").trim().toLowerCase();
            return lBrand === rBrand && lType === rType && (lDoc === rDoc || lUnit === rUnit);
          });

          if (!exists) {
            mergedWh.push({ ...localWh, "№ П/П": mergedWh.length + 1 });
          }
        });
      }

      setWarehouseInventoryCache(mergedWh, WAREHOUSE_HEADERS);
      warehouseRowCount = mergedWh.length;
    }

    touchInventoryRevision("Синхронизировано с Google Sheets (Лист1 и Склад)");

    lastSyncTime = Date.now();
    lastSyncRowCount = mergedRows.length || getInventoryCache().rows.length;
    lastSyncStatus = `Успешно: ${lastSyncRowCount} записей сотрудников, ${warehouseRowCount || getWarehouseInventory().length} позиций склада (${new Date().toLocaleTimeString("ru-RU")})`;

    console.log(`[Google Sheets Dual Sync] Synchronized ${lastSyncRowCount} employee records and ${warehouseRowCount} warehouse items from ${url}`);

    return {
      success: true,
      rowCount: lastSyncRowCount,
      warehouseRowCount: warehouseRowCount || getWarehouseInventory().length,
      message: `Синхронизировано: ${lastSyncRowCount} сотрудников, ${warehouseRowCount} позиций склада`,
    };
  } catch (err: any) {
    lastSyncStatus = `Исключение при синхронизации: ${err.message}`;
    console.warn("[Google Sheets Dual Sync Warning]:", err.message);
    return {
      success: false,
      rowCount: lastSyncRowCount,
      warehouseRowCount: getWarehouseInventory().length,
      message: err.message,
    };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Starts the continuous 24/7 background sync timer (default every 30 seconds)
 */
export function startPeriodicSheetsSync(intervalMs: number = 30000): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  // Initial sync immediately
  syncGoogleSheetsToInventory().catch((e) => {
    console.warn("[Initial Sheets Sync Notice]:", e.message);
  });

  // Periodic recurring background sync
  syncIntervalId = setInterval(() => {
    syncGoogleSheetsToInventory().catch((e) => {
      console.warn("[Periodic Sheets Sync Notice]:", e.message);
    });
  }, intervalMs);

  console.log(`[Google Sheets Auto-Sync] Started background sync loop (every ${Math.round(intervalMs / 1000)}s)`);
}

export function stopPeriodicSheetsSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}
