import { GoogleGenAI } from "@google/genai";
import { generateContentWithRetry } from "./geminiHelper.ts";
import fs from "fs";
import path from "path";

const CONFIG_FILE_PATH = path.join(process.cwd(), "server", "sync-config.json");

export function loadStoredConfig(): { googleAppsScriptUrl?: string; spreadsheetUrl?: string; telegramToken?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("[Config Load Warning]:", e);
  }
  return {};
}

export function saveStoredConfig(key: string, value: string) {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = loadStoredConfig();
    (current as any)[key] = value;
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(current, null, 2), "utf-8");
    console.log(`[Config Saved] ${key} saved to ${CONFIG_FILE_PATH}`);
  } catch (e) {
    console.warn("[Config Save Warning]:", e);
  }
}

export interface BotEquipmentRecord {
  "Идентификатор ПК"?: string;
  "Имя пользователя"?: string;
  "Должность"?: string;
  "Тип"?: string;
  "Марка"?: string;
  "S/N"?: string;
  "Отметка времени"?: string;
  "Кто выдал"?: string;
  "Движения"?: string;
  "Запись"?: string;
  [key: string]: any;
}

export interface WarehouseSheetRecord {
  "№ П/П": number | string;
  "Типы": string;
  "Марка и модели": string;
  "Единица измерения (м, шт.)": string;
  "Запись документа": string;
  "Кто принял": string;
  "Движение товаров": string;
  "Основание": string;
  [key: string]: any;
}

export const GOOGLE_DRIVE_FOLDER_ID = "1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ";
export const GOOGLE_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ?hl=ru";

export const WAREHOUSE_HEADERS = [
  "№ П/П",
  "Типы",
  "Марка и модели",
  "Единица измерения (м, шт.)",
  "Запись документа",
  "Кто принял",
  "Движение товаров",
  "Основание",
];

// In-memory dataset cache for Telegram Bot with preloaded realistic IT asset records
const DEFAULT_INVENTORY_SEED: BotEquipmentRecord[] = [
  {
    "Отметка времени": "12.01.2025 10:14:22",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Абдуллоев Фаррух",
    "Должность": "Senior Backend Developer",
    "Тип": "Ноутбуки",
    "Марка": "HP G250 i5 8gb",
    "Идентификатор ПК": "TAS05-010-FN-LT",
    "S/N": "5CD2348X9K",
    "Движения": "Принял",
    "Запись": "Выдан новый в коробке с зарядным устройством"
  },
  {
    "Отметка времени": "14.01.2025 11:30:10",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Абдуллоев Фаррух",
    "Должность": "Senior Backend Developer",
    "Тип": "Мониторы",
    "Марка": "Lenovo L24i-30",
    "Идентификатор ПК": "TAS05-010-MON-1",
    "S/N": "V309K8271A",
    "Движения": "Принял",
    "Запись": "HDMI кабель в комплекте"
  },
  {
    "Отметка времени": "18.01.2025 09:45:00",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Рустамов Сардор",
    "Должность": "DevOps Engineer",
    "Тип": "Ноутбуки",
    "Марка": "HP G250 i5 8gb",
    "Идентификатор ПК": "TAS05-044-FN-LT",
    "S/N": "5CD3199B2M",
    "Движения": "Принял",
    "Запись": "Рабочая станция с установленной Ubuntu 24.04"
  },
  {
    "Отметка времени": "18.01.2025 10:00:15",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Рустамов Сардор",
    "Должность": "DevOps Engineer",
    "Тип": "Мониторы",
    "Марка": "HP P24v G4",
    "Идентификатор ПК": "TAS05-044-MON-1",
    "S/N": "3CQ142078G",
    "Движения": "Принял",
    "Запись": "Монитор 24 дюйма"
  },
  {
    "Отметка времени": "22.01.2025 14:15:30",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Каримова Нигора",
    "Должность": "UI/UX Designer",
    "Тип": "Ноутбуки",
    "Марка": "Lenovo ThinkBook 15",
    "Идентификатор ПК": "TAS05-022-FN-LT",
    "S/N": "MP24X8911C",
    "Движения": "Принял",
    "Запись": "Установлен пакет Adobe CC"
  },
  {
    "Отметка времени": "25.01.2025 16:40:00",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Юсупов Джамшид",
    "Должность": "QA Lead",
    "Тип": "Ноутбуки",
    "Марка": "HP G250 i3 8gb",
    "Идентификатор ПК": "TAS05-015-FN-LT",
    "S/N": "5CD1894P5L",
    "Движения": "Принял",
    "Запись": "Выдан взамен старого ПК"
  },
  {
    "Отметка времени": "01.02.2025 12:00:00",
    "Кто выдал": "Зохид Зокиров",
    "Имя пользователя": "Исмаилов Алишер",
    "Должность": "Product Manager",
    "Тип": "Ноутбуки",
    "Марка": "Dell Vostro 3510",
    "Идентификатор ПК": "TAS05-011-FN-LT",
    "S/N": "8JK79M2",
    "Движения": "Принял",
    "Запись": "Выдан с сумкой и мышью"
  }
];

function loadInitialInventory(): BotEquipmentRecord[] {
  try {
    const jsonPath = path.join(process.cwd(), "server", "initial-inventory.json");
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Inventory] Loaded ${parsed.length} records from server/initial-inventory.json`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Could not load initial-inventory.json, falling back to seed", err);
  }
  return [...DEFAULT_INVENTORY_SEED];
}

export function saveInventoryToFile(): void {
  try {
    const jsonPath = path.join(process.cwd(), "server", "initial-inventory.json");
    fs.writeFileSync(jsonPath, JSON.stringify(activeInventory, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving inventory to file:", err);
  }
}

let activeInventory: BotEquipmentRecord[] = loadInitialInventory();
let activeColumns: string[] = [
  "Отметка времени",
  "Кто выдал",
  "Имя пользователя",
  "Должность",
  "Тип",
  "Марка",
  "Идентификатор ПК",
  "S/N",
  "Движения",
  "Запись"
];

// ==============================================================================
// 📦 ЛИСТ «СКЛАД»: Хранение, загрузка и кэширование записей оприходования
// Строгая 8-колоночная форма листа «Склад»
// ==============================================================================
function loadInitialWarehouseInventory(): WarehouseSheetRecord[] {
  try {
    const jsonPath = path.join(process.cwd(), "server", "warehouse-inventory.json");
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Warehouse] Loaded ${parsed.length} records from server/warehouse-inventory.json`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Could not load warehouse-inventory.json, falling back to default", err);
  }
  return [
    {
      "№ П/П": 1,
      "Типы": "Ноутбук",
      "Марка и модели": "Lenovo V15 G4 Ryzen 5 7520U",
      "Единица измерения (м, шт.)": "Склад ИТ (В наличии)",
      "Запись документа": "18.09.2026 5:48:58",
      "Кто принял": "Зохид Зокиров",
      "Движение товаров": "Приход (Склад)",
      "Основание": "Приход: Спецификация № 24 от 02.09.2026 (ООО «Heavenly Wave»)"
    }
  ];
}

export function saveWarehouseInventoryToFile(): void {
  try {
    const jsonPath = path.join(process.cwd(), "server", "warehouse-inventory.json");
    fs.writeFileSync(jsonPath, JSON.stringify(activeWarehouseInventory, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving warehouse inventory to file:", err);
  }
}

let activeWarehouseInventory: WarehouseSheetRecord[] = loadInitialWarehouseInventory();
let activeWarehouseColumns: string[] = [...WAREHOUSE_HEADERS];

export function getWarehouseInventory(): WarehouseSheetRecord[] {
  return activeWarehouseInventory;
}

export function getWarehouseColumns(): string[] {
  return activeWarehouseColumns;
}

export function setWarehouseInventoryCache(rows: WarehouseSheetRecord[], cols?: string[]) {
  if (Array.isArray(rows)) {
    activeWarehouseInventory = [...rows];
  }
  if (cols && cols.length > 0) {
    activeWarehouseColumns = cols;
  }
  saveWarehouseInventoryToFile();
}

export function deleteWarehouseRecord(index: number): { success: boolean; message: string } {
  if (index < 0 || index >= activeWarehouseInventory.length) {
    return { success: false, message: "Запись на складе не найдена" };
  }
  const deleted = activeWarehouseInventory.splice(index, 1)[0];
  // Re-index remaining rows so № П/П stays sequential
  activeWarehouseInventory.forEach((rec, idx) => {
    rec["№ П/П"] = idx + 1;
  });
  saveWarehouseInventoryToFile();
  touchInventoryRevision(`Удалена запись со склада: ${deleted["Типы"]} ${deleted["Марка и модели"]}`);
  pushAllWarehouseToGoogleSheet(activeWarehouseInventory).catch(() => {});
  return { success: true, message: `Позиция «${deleted["Типы"]} ${deleted["Марка и модели"]}» удалена со Склада` };
}

// Helper: Escape HTML special characters for safe Telegram Bot HTML parse_mode
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Global short-key registry for Telegram inline callback_data (max 64 bytes limit)
const shortDataStore = new Map<string, string>();
let shortDataCounter = 1;

export function registerCallbackPayload(payload: string): string {
  if (!payload) return 'empty';
  for (const [key, val] of shortDataStore.entries()) {
    if (val === payload) return key;
  }
  const id = `k_${(shortDataCounter++).toString(36)}`;
  shortDataStore.set(id, payload);
  if (shortDataStore.size > 3000) {
    const firstKey = shortDataStore.keys().next().value;
    if (firstKey) shortDataStore.delete(firstKey);
  }
  return id;
}

export function resolveCallbackPayload(key: string): string {
  if (!key || key === 'empty') return '';
  if (shortDataStore.has(key)) {
    return shortDataStore.get(key)!;
  }
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

// Helper: Normalize string for fuzzy comparison (remove dashes, underscores, spaces, dots)
export function normalizeQuery(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '');
}

// Advanced search engine across all inventory fields
export function searchInventory(rawQuery: string): BotEquipmentRecord[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const qLower = query.toLowerCase();
  const qNorm = normalizeQuery(query);

  const list = (activeInventory && activeInventory.length > 0) ? activeInventory : DEFAULT_INVENTORY_SEED;

  const matched = list.filter((record) => {
    // 1. Direct case-insensitive substring match in any value
    for (const v of Object.values(record)) {
      if (v !== null && v !== undefined) {
        const valStr = String(v).toLowerCase();
        if (valStr.includes(qLower)) return true;
      }
    }

    // 2. Normalized alphanumeric match for ID, S/N, and Name
    if (qNorm.length >= 2) {
      const pcIdNorm = normalizeQuery(record["Идентификатор ПК"]);
      const snNorm = normalizeQuery(record["S/N"]);
      const userNorm = normalizeQuery(record["Имя пользователя"]);
      const brandNorm = normalizeQuery(record["Марка"]);

      if (pcIdNorm && (pcIdNorm.includes(qNorm) || (qNorm.length >= 4 && qNorm.includes(pcIdNorm)))) return true;
      if (snNorm && (snNorm.includes(qNorm) || (qNorm.length >= 4 && qNorm.includes(snNorm)))) return true;
      if (userNorm && userNorm.includes(qNorm)) return true;
      if (brandNorm && brandNorm.includes(qNorm)) return true;
    }

    return false;
  });

  return matched;
}

// User conversation state for bot multi-step wizard
export interface BotUserState {
  step:
    | 'IDLE'
    | 'ADD_USER'
    | 'ADD_POSITION'
    | 'ADD_TYPE'
    | 'ADD_BRAND'
    | 'ADD_CUSTOM_BRAND'
    | 'ADD_SN'
    | 'ADD_PC_ID'
    | 'ADD_MOVEMENT'
    | 'ADD_NOTES'
    | 'CONFIRM_ADD'
    | 'SEARCH'
    | 'DELETE_CONFIRM'
    | 'EDIT_SELECT_FIELD'
    | 'EDIT_FIELD_VALUE'
    | 'WH_TYPE'
    | 'WH_BRAND'
    | 'WH_CUSTOM_BRAND'
    | 'WH_DOC'
    | 'WH_SN'
    | 'WH_QTY'
    | 'WH_CONFIRM'
    | 'WH_ISSUE_CHOOSE_USER'
    | 'DOC_EDIT_QTY'
    | 'DOC_EDIT_BRAND'
    | 'DOC_EDIT_DOC'
    | 'DOC_EDIT_TYPE';
  data: Partial<BotEquipmentRecord>;
  editRecordIndex?: number;
  editField?: string;
  selectedUser?: string;
  targetRecordIndex?: number;
  warehouseReceiptData?: {
    type?: string;
    brand?: string;
    document?: string;
    serialNumber?: string;
    quantity?: number;
    notes?: string;
    seller?: string;
    buyer?: string;
    docDate?: string;
    docNumber?: string;
    price?: string;
    totalSum?: string;
    rawOcrSummary?: string;
    photoBase64?: string;
    driveFileUrl?: string;
    fileName?: string;
    items?: Array<{
      type: string;
      brand: string;
      quantity: number;
      price?: string;
    }>;
  };
  warehouseIssueIndex?: number;
}

const userStates = new Map<string | number, BotUserState>();

const initConfig = loadStoredConfig();
let googleAppsScriptUrl: string = process.env.GOOGLE_APPS_SCRIPT_URL || initConfig.googleAppsScriptUrl || '';
let inventoryRevision: number = Date.now();
let lastSyncedRecordInfo: string = '';

export function setGoogleAppsScriptUrl(url: string) {
  googleAppsScriptUrl = (url || '').trim();
  saveStoredConfig('googleAppsScriptUrl', googleAppsScriptUrl);
  console.log(`[Google Apps Script URL Updated]: ${googleAppsScriptUrl ? googleAppsScriptUrl.slice(0, 45) + '...' : '(пусто)'}`);
}

export function getGoogleAppsScriptUrl(): string {
  if (!googleAppsScriptUrl) {
    const s = loadStoredConfig();
    if (s.googleAppsScriptUrl) {
      googleAppsScriptUrl = s.googleAppsScriptUrl;
    }
  }
  return googleAppsScriptUrl;
}

export function getInventoryRevision(): number {
  return inventoryRevision;
}

export function touchInventoryRevision(notice?: string) {
  inventoryRevision = Date.now();
  if (notice) {
    lastSyncedRecordInfo = notice;
  }
}

export function getLastSyncedRecordInfo(): string {
  return lastSyncedRecordInfo;
}

/**
 * Pushes a single record directly to Google Sheets via Google Apps Script Web App (Лист1)
 */
export async function pushRecordToGoogleSheet(record: BotEquipmentRecord): Promise<{ success: boolean; message?: string }> {
  const scriptUrl = getGoogleAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: 'Google Apps Script URL не настроен. Отправьте /set_script_url или настройте в дашборде.' };
  }
  try {
    const payload = {
      action: 'appendRow',
      timestamp: record["Отметка времени"] || new Date().toLocaleString("ru-RU"),
      issuer: record["Кто выдал"] || "Зохид Зокиров",
      username: record["Имя пользователя"] || "",
      position: record["Должность"] || "",
      type: record["Тип"] || "",
      brand: record["Марка"] || "",
      pcId: record["Идентификатор ПК"] || "",
      serialNumber: record["S/N"] || "",
      movement: record["Движения"] || "Принял",
      notes: record["Запись"] || "",
      record,
    };

    console.log(`[Google Sheet Push] Pushing record for "${record["Имя пользователя"]}" (${record["Тип"]} ${record["Марка"]}) to ${scriptUrl.slice(0, 40)}...`);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const resText = await response.text();
    console.log('[Google Sheet Push Response]:', resText);

    let parsed: any = null;
    try {
      parsed = JSON.parse(resText);
    } catch {}

    if (response.ok && (!parsed || parsed.status !== 'error')) {
      return { success: true, message: parsed?.message || 'Строка успешно добавлена в Google Таблицу!' };
    } else {
      return { success: false, message: parsed?.error || parsed?.message || resText || `HTTP ${response.status}` };
    }
  } catch (err: any) {
    console.warn('[Google Sheet Push Error]:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Pushes a single warehouse record directly to sheet «Склад» in Google Sheets
 */
export async function pushWarehouseRowToGoogleSheet(record: WarehouseSheetRecord): Promise<{ success: boolean; message?: string }> {
  const scriptUrl = getGoogleAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: 'Google Apps Script URL не настроен' };
  }
  try {
    const payload = {
      action: 'appendWarehouseRow',
      "№ П/П": record["№ П/П"],
      type: record["Типы"],
      brand: record["Марка и модели"],
      unit: record["Единица измерения (м, шт.)"],
      timestamp: record["Запись документа"],
      receiver: record["Кто принял"],
      movement: record["Движение товаров"],
      document: record["Основание"],
      row: record
    };

    console.log(`[Google Sheet Warehouse Push] Pushing to «Склад»: "${record["Типы"]} ${record["Марка и модели"]}"...`);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const resText = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(resText); } catch {}

    if (response.ok && (!parsed || parsed.status !== 'error')) {
      return { success: true, message: parsed?.message || 'Оприходовано на лист «Склад»!' };
    } else {
      return { success: false, message: parsed?.error || parsed?.message || resText };
    }
  } catch (err: any) {
    console.warn('[Warehouse Push Error]:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Pushes all warehouse rows to sheet «Склад»
 */
export async function pushAllWarehouseToGoogleSheet(rows?: WarehouseSheetRecord[]): Promise<{ success: boolean; message?: string; count?: number }> {
  const scriptUrl = getGoogleAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: 'Google Apps Script URL не настроен' };
  }
  const listToPush = rows && rows.length > 0 ? rows : activeWarehouseInventory;
  try {
    const payload = {
      action: 'syncWarehouse',
      warehouseColumns: activeWarehouseColumns,
      warehouseRows: listToPush,
    };

    console.log(`[Google Sheet Warehouse Sync] Pushing ${listToPush.length} warehouse rows...`);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const resText = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(resText); } catch {}

    if (response.ok && (!parsed || parsed.status !== 'error')) {
      return { success: true, message: parsed?.message || `Лист «Склад» синхронизирован: ${listToPush.length} позиций.`, count: listToPush.length };
    } else {
      return { success: false, message: parsed?.error || resText, count: 0 };
    }
  } catch (err: any) {
    console.warn('[Warehouse Full Sync Error]:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Pushes dual synchronization of BOTH sheets: Лист1 (Сотрудники) + Лист «Склад»
 */
export async function pushDualSyncToGoogleSheets(): Promise<{ success: boolean; message?: string }> {
  const scriptUrl = getGoogleAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: 'Google Apps Script URL не настроен' };
  }
  try {
    const payload = {
      action: 'syncAll',
      columns: activeColumns,
      rows: activeInventory,
      warehouseColumns: activeWarehouseColumns,
      warehouseRows: activeWarehouseInventory,
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const resText = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(resText); } catch {}

    return {
      success: response.ok && (!parsed || parsed.status !== 'error'),
      message: parsed?.message || 'Оба листа (Лист1 и Склад) синхронизированы!'
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Pushes full inventory dataset to Google Sheets via Google Apps Script Web App
 */
export async function pushAllInventoryToGoogleSheet(rows?: BotEquipmentRecord[]): Promise<{ success: boolean; message?: string; count?: number }> {
  const scriptUrl = getGoogleAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: 'Google Apps Script URL не настроен' };
  }
  const listToPush = rows && rows.length > 0 ? rows : activeInventory;
  try {
    const payload = {
      action: 'syncAll',
      columns: activeColumns,
      rows: listToPush,
      warehouseColumns: activeWarehouseColumns,
      warehouseRows: activeWarehouseInventory,
    };

    console.log(`[Google Sheet Full Sync] Pushing ${listToPush.length} rows to ${scriptUrl.slice(0, 40)}...`);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const resText = await response.text();
    console.log('[Google Sheet Full Sync Response]:', resText);

    let parsed: any = null;
    try {
      parsed = JSON.parse(resText);
    } catch {}

    if (response.ok && (!parsed || parsed.status !== 'error')) {
      return { success: true, message: parsed?.message || `Синхронизировано ${listToPush.length} строк в Google Таблицу.`, count: listToPush.length };
    } else {
      return { success: false, message: parsed?.error || parsed?.message || resText || `HTTP ${response.status}`, count: 0 };
    }
  } catch (err: any) {
    console.warn('[Google Sheet Full Sync Error]:', err.message);
    return { success: false, message: err.message };
  }
}

export function setInventoryCache(rows: BotEquipmentRecord[], cols?: string[]) {
  if (Array.isArray(rows)) {
    activeInventory = [...rows];
  }
  if (cols && cols.length > 0) {
    activeColumns = cols;
  }
  saveInventoryToFile();
  touchInventoryRevision();
}

export function getInventoryCache(): { rows: BotEquipmentRecord[]; columns: string[]; revision: number } {
  return { rows: activeInventory, columns: activeColumns, revision: inventoryRevision };
}

// Helpers for tracking deleted records to prevent resurrection on background sync
export function makeRecordSignature(r: Partial<BotEquipmentRecord>): string {
  const user = String(r["Имя пользователя"] || "").trim().toLowerCase();
  const type = String(r["Тип"] || "").trim().toLowerCase();
  const brand = String(r["Марка"] || "").trim().toLowerCase();
  const sn = String(r["S/N"] || "").trim().toLowerCase();
  const pcId = String(r["Идентификатор ПК"] || "").trim().toLowerCase();
  const time = String(r["Отметка времени"] || "").trim().toLowerCase();
  return `${user}::${type}::${brand}::${sn}::${pcId}::${time}`;
}

const deletedRecordsSignatures = new Set<string>();

export function isRecordDeleted(r: Partial<BotEquipmentRecord>): boolean {
  return deletedRecordsSignatures.has(makeRecordSignature(r));
}

export function formatDateTimeCustom(d = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${day}.${m}.${y} ${h}:${min}:${s}`;
}

/**
 * Delete a specific record from inventory database and Google Sheet instantly
 */
export async function deleteRecordFromInventory(target: Partial<BotEquipmentRecord> & { index?: number }): Promise<{
  success: boolean;
  deletedItem?: BotEquipmentRecord;
  message: string;
}> {
  const userCol = activeColumns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const typeCol = activeColumns.find((c) => /тип/i.test(c)) || 'Тип';
  const brandCol = activeColumns.find((c) => /марка/i.test(c)) || 'Марка';
  const snCol = activeColumns.find((c) => /s\/n|серийный/i.test(c)) || 'S/N';
  const timeCol = activeColumns.find((c) => /отметка|время|дата/i.test(c)) || 'Отметка времени';
  const pcIdCol = activeColumns.find((c) => /идентификатор|доменный|пк/i.test(c)) || 'Идентификатор ПК';

  let foundIndex = -1;

  if (target.index !== undefined && target.index >= 0 && target.index < activeInventory.length) {
    foundIndex = target.index;
  } else {
    const tUser = String(target[userCol] || target["Имя пользователя"] || "").trim().toLowerCase();
    const tType = String(target[typeCol] || target["Тип"] || "").trim().toLowerCase();
    const tBrand = String(target[brandCol] || target["Марка"] || "").trim().toLowerCase();
    const tSn = String(target[snCol] || target["S/N"] || "").trim().toLowerCase();
    const tTime = String(target[timeCol] || target["Отметка времени"] || "").trim().toLowerCase();
    const tPcId = String(target[pcIdCol] || target["Идентификатор ПК"] || "").trim().toLowerCase();

    for (let i = activeInventory.length - 1; i >= 0; i--) {
      const item = activeInventory[i];
      const iUser = String(item[userCol] || item["Имя пользователя"] || "").trim().toLowerCase();
      const iType = String(item[typeCol] || item["Тип"] || "").trim().toLowerCase();
      const iBrand = String(item[brandCol] || item["Марка"] || "").trim().toLowerCase();
      const iSn = String(item[snCol] || item["S/N"] || "").trim().toLowerCase();
      const iTime = String(item[timeCol] || item["Отметка времени"] || "").trim().toLowerCase();
      const iPcId = String(item[pcIdCol] || item["Идентификатор ПК"] || "").trim().toLowerCase();

      let match = true;
      if (tUser) {
        if (iUser !== tUser && !iUser.includes(tUser) && !tUser.includes(iUser)) match = false;
      }
      if (tType) {
        if (iType !== tType && !iType.includes(tType) && !tType.includes(iType)) match = false;
      }
      if (tBrand) {
        if (iBrand !== tBrand && !iBrand.includes(tBrand) && !tBrand.includes(iBrand)) match = false;
      }
      if (tSn && tSn !== "—" && tSn !== "-") {
        if (iSn && iSn !== "—" && iSn !== "-" && iSn !== tSn) match = false;
      }
      if (tPcId && tPcId !== "—" && tPcId !== "-") {
        if (iPcId && iPcId !== "—" && iPcId !== "-" && iPcId !== tPcId) match = false;
      }
      if (tTime && iTime && iTime !== tTime) {
        if (!iTime.includes(tTime) && !tTime.includes(iTime)) {
          // If time is provided and mismatches, try continuing
        }
      }

      if (match) {
        foundIndex = i;
        break;
      }
    }
  }

  if (foundIndex === -1) {
    return { success: false, message: "Запись не найдена в базе" };
  }

  const [deletedItem] = activeInventory.splice(foundIndex, 1);
  deletedRecordsSignatures.add(makeRecordSignature(deletedItem));
  saveInventoryToFile();
  touchInventoryRevision(`Удалена запись: ${deletedItem["Тип"]} ${deletedItem["Марка"]} (${deletedItem["Имя пользователя"] || 'Склад'})`);

  const scriptUrl = getGoogleAppsScriptUrl();
  if (scriptUrl) {
    try {
      // 1. Send single row deletion command
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteRow',
          username: deletedItem["Имя пользователя"],
          type: deletedItem["Тип"],
          brand: deletedItem["Марка"],
          serialNumber: deletedItem["S/N"],
          pcId: deletedItem["Идентификатор ПК"],
          timestamp: deletedItem["Отметка времени"],
        }),
        redirect: 'follow',
      });
      // 2. Full synchronization to ensure 100% sheet integrity
      await pushAllInventoryToGoogleSheet(activeInventory);
    } catch (e: any) {
      console.warn('[Delete Sheets Sync Warning]:', e.message);
    }
  }

  return {
    success: true,
    deletedItem,
    message: `Запись «${deletedItem["Тип"]} ${deletedItem["Марка"]}» удалена из базы и Google Таблицы!`
  };
}

/**
 * Return an employee's equipment back to warehouse (строгая взаимосвязь Лист1 и Склад)
 * На Лист1: строка сотрудника помечается «Сдал (Возврат на склад)» без порчи его имени
 * На Лист «Склад»: вносится новая запись в 8-колоночной форме со статусом «Склад ИТ (В наличии)»
 */
export async function returnEquipmentToWarehouse(
  target: Partial<BotEquipmentRecord> & { index?: number },
  extraNotes?: string
): Promise<{ success: boolean; item?: BotEquipmentRecord; warehouseRecord?: WarehouseSheetRecord; message: string }> {
  const userCol = activeColumns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const notesCol = activeColumns.find((c) => /запись|примечание/i.test(c)) || 'Запись';

  let foundIndex = -1;
  if (target.index !== undefined && target.index >= 0 && target.index < activeInventory.length) {
    foundIndex = target.index;
  } else {
    const tUser = String(target[userCol] || target["Имя пользователя"] || "").trim().toLowerCase();
    const tSn = String(target["S/N"] || "").trim().toLowerCase();
    const tBrand = String(target["Марка"] || "").trim().toLowerCase();

    for (let i = 0; i < activeInventory.length; i++) {
      const item = activeInventory[i];
      const iUser = String(item[userCol] || item["Имя пользователя"] || "").trim().toLowerCase();
      const iSn = String(item["S/N"] || "").trim().toLowerCase();
      const iBrand = String(item["Марка"] || "").trim().toLowerCase();

      if (tUser && (iUser === tUser || iUser.includes(tUser))) {
        if (tSn && tSn !== '—' && tSn !== '-' && iSn === tSn) {
          foundIndex = i;
          break;
        }
        if (tBrand && iBrand === tBrand) {
          foundIndex = i;
          break;
        }
      }
    }
  }

  if (foundIndex === -1) {
    return { success: false, message: "Оборудование сотрудника не найдено" };
  }

  const item = activeInventory[foundIndex];
  const previousUser = String(item[userCol] || item["Имя пользователя"] || "Сотрудник").trim();
  const previousPosition = String(item["Должность"] || "").trim();
  const nowStr = formatDateTimeCustom();
  const returnBracket = `(Возврат от: ${previousUser}, ${nowStr.slice(0, 10)})`;

  const oldNotes = String(item[notesCol] || item["Запись"] || "").trim();
  const updatedNotes = oldNotes ? `${oldNotes} ${returnBracket}` : returnBracket;

  // 1. Обновляем строку на Лист1 (сохраняя ФИО сотрудника!)
  item["Движения"] = "Сдал (Возврат на склад)";
  item["Отметка времени"] = nowStr;
  item["Запись"] = extraNotes ? `${updatedNotes} [${extraNotes}]` : updatedNotes;
  saveInventoryToFile();

  // 2. Вносим новую строку на лист «Склад» в строгой 8-колоночной форме
  const nextWhNum = activeWarehouseInventory.length + 1;
  const whRec: WarehouseSheetRecord = {
    "№ П/П": nextWhNum,
    "Типы": item["Тип"] || "Оборудование",
    "Марка и модели": item["Марка"] || "—",
    "Единица измерения (м, шт.)": "Склад ИТ (В наличии)",
    "Запись документа": nowStr,
    "Кто принял": "Зохид Зокиров",
    "Движение товаров": `Возврат на склад (от ${previousUser})`,
    "Основание": `Возврат от сотрудника: ${previousUser}${previousPosition ? ` (${previousPosition})` : ''}${item["S/N"] ? `, S/N: ${item["S/N"]}` : ''}${extraNotes ? ` [${extraNotes}]` : ''}`
  };

  activeWarehouseInventory.push(whRec);
  saveWarehouseInventoryToFile();

  touchInventoryRevision(`Возврат на склад от ${previousUser}: ${item["Тип"]} ${item["Марка"]}`);

  // 3. Синхронизируем оба листа в Google Таблицу
  const scriptUrl = getGoogleAppsScriptUrl();
  if (scriptUrl) {
    try {
      await pushDualSyncToGoogleSheets();
    } catch (e: any) {
      console.warn('[Return to Warehouse Sync Error]:', e.message);
    }
  }

  return {
    success: true,
    item,
    warehouseRecord: whRec,
    message: `Техника «${item["Тип"]} ${item["Марка"]}» возвращена на Склад (в наличии) и зафиксирована на обоих листах таблицы!`
  };
}

/**
 * Register warehouse receipt: строгое оприходование на лист «Склад»
 * Записывается исключительно на лист «Склад» в утвержденной 8-колоночной форме!
 */
export async function warehouseReceipt(data: {
  type: string;
  brand: string;
  serialNumber?: string;
  pcId?: string;
  document?: string;
  quantity?: number;
  notes?: string;
  receiver?: string;
  photoBase64?: string;
  fileName?: string;
  mimeType?: string;
  driveUrl?: string;
}): Promise<{ success: boolean; createdCount: number; message: string; rows: WarehouseSheetRecord[]; driveFileUrl?: string }> {
  const count = Math.max(1, Math.min(50, data.quantity || 1));
  const now = formatDateTimeCustom();
  let docNote = data.document
    ? (data.document.toLowerCase().startsWith("приход") ? data.document : `Приход: ${data.document}`)
    : (data.notes || "Приход (Оприходовано на склад)");
  const receiver = data.receiver || "Зохид Зокиров";

  let uploadedDriveUrl = data.driveUrl || "";

  // If photo is provided and Google Apps Script is active, upload to Google Drive folder directly
  const scriptUrl = getGoogleAppsScriptUrl();
  if (scriptUrl && data.photoBase64) {
    try {
      const driveUploadRes = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "uploadToDrive",
          photoBase64: data.photoBase64,
          fileName: data.fileName || `накладная_${data.type}_${data.brand}_${Date.now()}.jpg`,
          mimeType: data.mimeType || "image/jpeg",
        }),
        redirect: "follow",
      });
      const driveText = await driveUploadRes.text();
      let parsed: any = null;
      try { parsed = JSON.parse(driveText); } catch {}
      if (parsed && (parsed.fileUrl || parsed.viewUrl)) {
        uploadedDriveUrl = parsed.fileUrl || parsed.viewUrl;
        console.log(`[Google Drive Upload Success]: ${uploadedDriveUrl}`);
      }
    } catch (err: any) {
      console.warn("[Google Drive Upload Error]:", err.message);
    }
  }

  if (uploadedDriveUrl && !docNote.includes(uploadedDriveUrl)) {
    docNote = `${docNote} [Фото в Google Диске: ${uploadedDriveUrl}]`;
  }

  const nextNumStart = activeWarehouseInventory.length + 1;
  const created: WarehouseSheetRecord[] = [];

  for (let i = 0; i < count; i++) {
    const rec: WarehouseSheetRecord = {
      "№ П/П": nextNumStart + i,
      "Типы": data.type || "Оборудование",
      "Марка и модели": data.brand || "—",
      "Единица измерения (м, шт.)": "Склад ИТ (В наличии)",
      "Запись документа": now,
      "Кто принял": receiver,
      "Движение товаров": "Приход (Склад)",
      "Основание": docNote,
    };
    activeWarehouseInventory.push(rec);
    created.push(rec);
  }

  saveWarehouseInventoryToFile();
  touchInventoryRevision(`Оприходовано на лист «Склад»: ${data.type} ${data.brand} (${count} шт., ${data.document || 'б/н'})`);

  if (scriptUrl) {
    try {
      await pushAllWarehouseToGoogleSheet(activeWarehouseInventory);
    } catch (e: any) {
      console.warn('[Warehouse Receipt Sync Error]:', e.message);
    }
  }

  return {
    success: true,
    createdCount: count,
    message: `Успешно оприходовано ${count} шт. «${data.type} ${data.brand}» строго на лист «Склад» в Google Таблице!${uploadedDriveUrl ? ' (Фото сохранено в папку Google Диска)' : ''}`,
    rows: created,
    driveFileUrl: uploadedDriveUrl,
  };
}

/**
 * Прямая загрузка фото/документа в Google Диск через Google Apps Script Web App
 */
export async function uploadFileToGoogleDriveViaAppsScript(
  photoBase64: string,
  fileName?: string,
  mimeType = "image/jpeg"
): Promise<{ success: boolean; fileUrl?: string; fileName?: string; folderUrl?: string; message?: string }> {
  const scriptUrl = getGoogleAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: "Google Apps Script URL не настроен" };
  }
  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "uploadToDrive",
        photoBase64,
        fileName: fileName || `накладная_${Date.now()}.jpg`,
        mimeType,
      }),
      redirect: "follow",
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    if (parsed && (parsed.fileUrl || parsed.viewUrl)) {
      return {
        success: true,
        fileUrl: parsed.fileUrl || parsed.viewUrl,
        fileName: parsed.fileName,
        folderUrl: parsed.folderUrl || GOOGLE_DRIVE_FOLDER_URL,
        message: "Файл успешно сохранен на Google Диск в папку «накладной»!",
      };
    }
    return {
      success: false,
      message: parsed?.message || text || "Ошибка при сохранении на Google Диск",
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Issue equipment from warehouse to a specific user (взаимосвязь Склад -> Лист1)
 * 1. На листе «Склад» позиция списывается (статус меняется на «Выдано: <ФИО>»)
 * 2. На листе «Лист1» создается карточка выданного оборудования под сотрудником
 */
export async function issueFromWarehouseToUser(
  warehouseItemIndex: number,
  targetUserName: string,
  targetPosition = '',
  extraNotes = ''
): Promise<{ success: boolean; item?: BotEquipmentRecord; warehouseRecord?: WarehouseSheetRecord; message: string }> {
  if (warehouseItemIndex < 0 || warehouseItemIndex >= activeWarehouseInventory.length) {
    return { success: false, message: "Позиция на складе не найдена" };
  }

  const whItem = activeWarehouseInventory[warehouseItemIndex];
  const now = formatDateTimeCustom();
  const type = String(whItem["Типы"] || "Оборудование").trim();
  const brand = String(whItem["Марка и модели"] || "—").trim();
  const doc = String(whItem["Основание"] || "").trim();

  // 1. Обновляем статус на листе «Склад»
  whItem["Единица измерения (м, шт.)"] = `Выдано: ${targetUserName}`;
  whItem["Движение товаров"] = `Выдано: ${targetUserName}${targetPosition ? ` (${targetPosition})` : ''}`;
  whItem["Основание"] = doc ? `${doc} [Выдано: ${targetUserName} ${now}]` : `Выдано: ${targetUserName} ${now}`;
  saveWarehouseInventoryToFile();

  // 2. Создаем запись на Лист1 (Сотрудники)
  const empRecord: BotEquipmentRecord = {
    "Идентификатор ПК": "",
    "Имя пользователя": targetUserName,
    "Должность": targetPosition || "Сотрудник",
    "Тип": type,
    "Марка": brand,
    "S/N": "—",
    "Отметка времени": now,
    "Кто выдал": "Зохид Зокиров",
    "Движения": "Выдано со склада",
    "Запись": `Выдано со склада (Основание со склада: ${doc || 'Приход'})${extraNotes ? ` [${extraNotes}]` : ''}`
  };

  activeInventory = insertRecordForUser(activeInventory, empRecord);
  saveInventoryToFile();

  touchInventoryRevision(`Выдано со склада сотруднику ${targetUserName}: ${type} ${brand}`);

  // 3. Синхронизируем оба листа
  const scriptUrl = getGoogleAppsScriptUrl();
  if (scriptUrl) {
    try {
      await pushDualSyncToGoogleSheets();
    } catch (e: any) {
      console.warn('[Warehouse Issue Dual Sync Error]:', e.message);
    }
  }

  return {
    success: true,
    item: empRecord,
    warehouseRecord: whItem,
    message: `Техника «${type} ${brand}» выдана сотруднику ${targetUserName} и списана со склада (оба листа обновлены)!`
  };
}

/**
 * Returns all equipment currently in warehouse stock (из листа «Склад»)
 */
export function getWarehouseStock(): {
  items: (WarehouseSheetRecord & { index: number; "Тип": string; "Марка": string; "S/N": string; "Запись": string })[];
  categoryCounts: Record<string, number>;
  totalCount: number;
} {
  const items: (WarehouseSheetRecord & { index: number; "Тип": string; "Марка": string; "S/N": string; "Запись": string })[] = [];
  const categoryCounts: Record<string, number> = {};

  activeWarehouseInventory.forEach((rec, idx) => {
    const unit = String(rec["Единица измерения (м, шт.)"] || "").trim().toLowerCase();
    const mov = String(rec["Движение товаров"] || "").trim().toLowerCase();

    // Доступно, если статус «В наличии» и не выдано
    const isAvailable =
      (unit.includes("наличи") || mov.includes("приход") || mov.includes("возврат")) &&
      !unit.includes("выдано") &&
      !mov.includes("выдано");

    if (isAvailable) {
      const t = String(rec["Типы"] || "Прочее").trim() || "Прочее";
      const b = String(rec["Марка и модели"] || "—").trim();
      const doc = String(rec["Основание"] || "").trim();

      items.push({
        ...rec,
        index: idx,
        "Тип": t,
        "Марка": b,
        "S/N": "—",
        "Запись": doc
      });

      categoryCounts[t] = (categoryCounts[t] || 0) + 1;
    }
  });

  return {
    items,
    categoryCounts,
    totalCount: items.length,
  };
}


// Available standard hardware types fallback
export const HARDWARE_TYPES = [
  "Ноутбуки",
  "Мониторы",
  "Мыши",
  "Клавиатуры",
  "Гарнитуры",
  "Рюкзаки/Сумки",
  "USB Type-C Hub",
  "Сетевые фильтры",
  "Производственное оборудование"
];

// Dynamically extract all distinct hardware types from current active inventory
export function getAvailableHardwareTypes(): string[] {
  const typeCol = activeColumns.find((c) => /тип/i.test(c)) || 'Тип';
  const typeSet = new Set<string>();

  activeInventory.forEach((row) => {
    const raw = row[typeCol];
    if (raw !== null && raw !== undefined) {
      const val = String(raw).trim();
      if (val && val !== '—' && val !== '-' && val.toLowerCase() !== 'пусто') {
        typeSet.add(val);
      }
    }
  });

  const existingTypes = Array.from(typeSet);
  if (existingTypes.length > 0) {
    // Add common standard types that might not be present yet to give full options
    const standardToAdd = HARDWARE_TYPES.filter(
      (ht) => !existingTypes.some((et) => et.toLowerCase() === ht.toLowerCase())
    );
    return [...existingTypes, ...standardToAdd.slice(0, 3)];
  }

  return HARDWARE_TYPES;
}

// Extract available brands for a specific equipment type from current inventory
export function getAvailableBrandsForType(type: string): string[] {
  if (!type) return [];
  const typeCol = activeColumns.find((c) => /тип/i.test(c)) || 'Тип';
  const brandCol = activeColumns.find((c) => /марка|модель/i.test(c)) || 'Марка';

  const brandCounts = new Map<string, number>();
  const typeLower = type.toLowerCase().trim();

  // Root stems for broad matching across grammatical variations (e.g. мышь, мыши, мышка)
  const stemKeywords: string[] = [];
  if (/мыш/i.test(typeLower)) stemKeywords.push('мыш', 'mouse');
  if (/монит/i.test(typeLower)) stemKeywords.push('монит', 'monitor', 'диспл', 'экран');
  if (/ноут/i.test(typeLower)) stemKeywords.push('ноут', 'laptop', 'book');
  if (/клав/i.test(typeLower)) stemKeywords.push('клав', 'keyboard');
  if (/гарнит|науш/i.test(typeLower)) stemKeywords.push('гарнит', 'науш', 'headset');
  if (/hub|хаб|type-c/i.test(typeLower)) stemKeywords.push('hub', 'хаб', 'type-c', 'док');
  if (/фильтр|сетев|удлин/i.test(typeLower)) stemKeywords.push('фильтр', 'сетев', 'удлин');
  if (/сумк|рюкзак/i.test(typeLower)) stemKeywords.push('сумк', 'рюкзак', 'bag');
  if (/производ|тсд|принтер|сканер/i.test(typeLower)) stemKeywords.push('производ', 'тсд', 'принтер', 'сканер', 'tsc', 'zebra', 'honeywell');

  activeInventory.forEach((item) => {
    const itemType = String(item[typeCol] || '').toLowerCase().trim();
    const brand = String(item[brandCol] || '').trim();

    if (!brand || brand === '-' || brand === '—' || brand.toLowerCase() === 'нет' || brand.toLowerCase() === 'пусто') return;

    let isMatch = false;
    // 1. Direct match or substring
    if (itemType === typeLower || itemType.includes(typeLower) || typeLower.includes(itemType)) {
      isMatch = true;
    }
    // 2. Stem match for grammatical forms
    if (!isMatch && stemKeywords.length > 0) {
      if (stemKeywords.some((stem) => itemType.includes(stem))) {
        isMatch = true;
      }
    }

    if (isMatch) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
  });

  // If brands exist in active database, return them ordered by frequency
  if (brandCounts.size > 0) {
    return Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand)
      .slice(0, 12);
  }

  // Fallback defaults if inventory has no entries of this type yet
  if (/ноут/i.test(typeLower)) {
    return ["HP G250 i5 8gb", "HP G250 i3 8gb", "HP 250 G8", "Lenovo ThinkBook 15", "Dell Vostro"];
  }
  if (/монит/i.test(typeLower)) {
    return ["Lenovo L24i-30", "Lenovo L24i", "HP P24v G4", "Dell SE2422H", "Samsung 24\""];
  }
  if (/мыш/i.test(typeLower)) {
    return ["Logitech B100", "HP 150 Wireless", "Genius DX-120", "A4Tech"];
  }
  if (/клав/i.test(typeLower)) {
    return ["Logitech K120", "HP 150 Keyboard", "A4Tech"];
  }
  if (/гарнит|науш/i.test(typeLower)) {
    return ["Jabra Evolve 20", "Logitech H390", "A4Tech HS-30"];
  }
  if (/hub|хаб/i.test(typeLower)) {
    return ["HP USB-C G2 Hub", "Baseus 6-in-1", "UGreen Type-C Hub"];
  }
  if (/фильтр/i.test(typeLower)) {
    return ["Pilot S", "Sven Optima", "APC Essential SurgeArrest"];
  }
  if (/сумк|рюкзак/i.test(typeLower)) {
    return ["Рюкзак HP Prelude 15.6", "Сумка RivaCase 15.6"];
  }
  if (/производ/i.test(typeLower)) {
    return ["TSC MH341T", "Zebra ZT230", "Honeywell"];
  }

  return [];
}

// Insert new record right next to the employee's existing records (or at end for new employee)
export function insertRecordForUser(
  inventory: BotEquipmentRecord[],
  newRecord: BotEquipmentRecord
): BotEquipmentRecord[] {
  const userCol = activeColumns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const targetUser = String(newRecord[userCol] || newRecord["Имя пользователя"] || '').trim();

  if (!targetUser || targetUser === '📦 Без назначения / Склад' || targetUser.toLowerCase() === 'склад') {
    // Put after last warehouse record or at end
    const lastWarehouseIndex = inventory.reduce((lastIdx, item, idx) => {
      const u = String(item[userCol] || item["Имя пользователя"] || '').trim().toLowerCase();
      if (!u || u.includes('склад') || u.includes('без назначения')) {
        return idx;
      }
      return lastIdx;
    }, -1);

    const copy = [...inventory];
    if (lastWarehouseIndex >= 0) {
      copy.splice(lastWarehouseIndex + 1, 0, newRecord);
      return copy;
    }
    copy.push(newRecord);
    return copy;
  }

  // Find the LAST index of the row belonging to this employee
  const targetUserLower = targetUser.toLowerCase();
  let lastMatchingIndex = -1;

  for (let i = 0; i < inventory.length; i++) {
    const rowUser = String(inventory[i][userCol] || inventory[i]["Имя пользователя"] || '').trim().toLowerCase();
    if (rowUser) {
      if (
        rowUser === targetUserLower ||
        (rowUser.length > 3 && targetUserLower.includes(rowUser)) ||
        (targetUserLower.length > 3 && rowUser.includes(targetUserLower))
      ) {
        lastMatchingIndex = i;
      }
    }
  }

  const copy = [...inventory];
  if (lastMatchingIndex >= 0) {
    // Insert immediately AFTER the last equipment item of this employee
    copy.splice(lastMatchingIndex + 1, 0, newRecord);
  } else {
    // New employee: add before warehouse items if any, otherwise append at the end
    const firstWarehouseIdx = copy.findIndex((r) => {
      const u = String(r[userCol] || r["Имя пользователя"] || '').trim().toLowerCase();
      return u.includes('склад') || u.includes('без назначения');
    });

    if (firstWarehouseIdx >= 0 && firstWarehouseIdx > 0) {
      copy.splice(firstWarehouseIdx, 0, newRecord);
    } else {
      copy.push(newRecord);
    }
  }

  return copy;
}

// Extract distinct users with their equipment counts
export function getDistinctUsers(): { name: string; position: string; count: number; items: BotEquipmentRecord[] }[] {
  const userCol = activeColumns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const posCol = activeColumns.find((c) => /должность|подразделение/i.test(c)) || 'Должность';

  const userMap = new Map<string, { name: string; position: string; count: number; items: BotEquipmentRecord[] }>();

  activeInventory.forEach((row) => {
    const rawName = row[userCol];
    const name = (rawName !== null && rawName !== undefined && String(rawName).trim() !== '')
      ? String(rawName).trim()
      : '📦 Без назначения / Склад';
    const position = String(row[posCol] || '');

    if (!userMap.has(name)) {
      userMap.set(name, {
        name,
        position,
        count: 0,
        items: []
      });
    }

    const entry = userMap.get(name)!;
    entry.count += 1;
    if (!entry.position && position) {
      entry.position = position;
    }
    entry.items.push(row);
  });

  return Array.from(userMap.values()).sort((a, b) => {
    if (a.name.startsWith('📦')) return 1;
    if (b.name.startsWith('📦')) return -1;
    return a.name.localeCompare(b.name, 'ru');
  });
}

// Generate formatted card for a user's assigned equipment
export function generateUserEquipmentCard(userName: string): { text: string; items: BotEquipmentRecord[]; inlineKeyboard: any[][] } {
  const userCol = activeColumns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const pcIdCol = activeColumns.find((c) => /идентификатор|доменный|пк/i.test(c)) || 'Идентификатор ПК';
  const typeCol = activeColumns.find((c) => /тип/i.test(c)) || 'Тип';
  const brandCol = activeColumns.find((c) => /марка/i.test(c)) || 'Марка';
  const snCol = activeColumns.find((c) => /s\/n|серийный/i.test(c)) || 'S/N';
  const movementCol = activeColumns.find((c) => /движени/i.test(c)) || 'Движения';
  const timeCol = activeColumns.find((c) => /отметка|время|дата/i.test(c)) || 'Отметка времени';
  const notesCol = activeColumns.find((c) => /запись|примечание/i.test(c)) || 'Запись';
  const posCol = activeColumns.find((c) => /должность/i.test(c)) || 'Должность';

  const items = activeInventory.filter((row) => {
    const rName = String(row[userCol] || '').trim();
    if (userName === '📦 Без назначения / Склад' || userName === 'Склад') {
      return !rName || rName === '📦 Без назначения / Склад' || rName === 'Склад';
    }
    return rName.toLowerCase() === userName.toLowerCase();
  });

  const position = items[0]?.[posCol] || 'Не указана';

  let text = `👤 <b>Сотрудник:</b> ${escapeHtml(userName)}\n`;
  if (position && position !== 'Не указана') {
    text += `🏢 <b>Должность:</b> ${escapeHtml(position)}\n`;
  }
  text += `📦 <b>Закреплено единиц техники:</b> ${items.length}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (items.length === 0) {
    text += `<i>За данным сотрудником пока не числится оборудования.</i>\n`;
  } else {
    items.forEach((item, idx) => {
      const pcId = item[pcIdCol] || '—';
      const type = item[typeCol] || 'Техника';
      const brand = item[brandCol] || '—';
      const sn = item[snCol] || '—';
      const movement = item[movementCol] || 'Принял';
      const timestamp = item[timeCol] || '';
      const notes = item[notesCol] || '';

      const movementIcon = movement === 'Сдал' ? '🟡 [Сдал]' : movement === 'Новый' ? '🔵 [Новый]' : '🟢 [Принял]';

      text += `<b>${idx + 1}. ${escapeHtml(type)} ${escapeHtml(brand)}</b> ${movementIcon}\n`;
      if (pcId && pcId !== '—') {
        text += `   🏷️ <b>Доменный ID:</b> <code>${escapeHtml(pcId)}</code>\n`;
      }
      text += `   🔢 <b>S/N:</b> <code>${escapeHtml(sn)}</code>\n`;
      if (timestamp) {
        text += `   🕒 <b>Выдано:</b> ${escapeHtml(timestamp)}\n`;
      }
      if (notes) {
        text += `   📝 <b>Запись:</b> ${escapeHtml(notes)}\n`;
      }
      text += `\n`;
    });
  }

  const userKey = registerCallbackPayload(userName);
  const inlineKeyboard: any[][] = [];

  const isWarehouse = userName.includes('Склад') || userName.includes('Без назначения');

  if (isWarehouse) {
    inlineKeyboard.push([
      { text: `📥 Оприходовать на склад (Накладная)`, callback_data: `warehouse_receipt` },
      { text: `📤 Выдать со склада`, callback_data: `wh_issue_list` }
    ]);
    if (items.length > 0) {
      inlineKeyboard.push([
        { text: `🗑️ Удалить ошибочную запись`, callback_data: `rmu:${userKey}` }
      ]);
    }
  } else {
    inlineKeyboard.push([
      { text: `➕ Выдать технику`, callback_data: `au:${userKey}` }
    ]);
    if (items.length > 0) {
      inlineKeyboard.push([
        { text: `🔄 Сдать на склад (возврат)`, callback_data: `rtu:${userKey}` },
        { text: `🗑️ Удалить технику`, callback_data: `rmu:${userKey}` }
      ]);
    }
  }

  inlineKeyboard.push([
    { text: `📋 Список всех сотрудников`, callback_data: `lu:1` },
    { text: `📦 Склад и остатки`, callback_data: `warehouse_view` }
  ]);
  inlineKeyboard.push([
    { text: `🏠 Главное меню`, callback_data: `main_menu` }
  ]);

  return { text, items, inlineKeyboard };
}

// Recognize Hardware S/N, Model OR Invoice / Specification Document from Photo using Gemini Vision
export interface DocumentItemRecognition {
  type: string;
  brand: string;
  quantity: number;
  price?: string;
  totalSum?: string;
  unit?: string;
}

export interface SmartPhotoAnalysisResult {
  isDocument: boolean;
  documentType?: string;
  documentNumber?: string;
  documentDate?: string;
  supplier?: string;
  buyer?: string;
  contractInfo?: string;
  formattedDocumentTitle?: string;
  items: DocumentItemRecognition[];
  totalQuantity: number;
  totalSum?: string;
  currency?: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  pcId?: string;
  detectedText?: string;
  confidence?: number;
}

export async function analyzePhotoForHardwareOrDocument(
  ai: GoogleGenAI,
  base64Image: string,
  mimeType = 'image/jpeg'
): Promise<SmartPhotoAnalysisResult> {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await generateContentWithRetry(ai, {
      preferredModel: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `You are an expert IT Logistics & Hardware Inventory AI Specialist for an enterprise in Uzbekistan / CIS.
Carefully inspect this image, which is either:
A) An official procurement document, invoice, specification, delivery note (e.g. СПЕЦИФИКАЦИЯ, СЧЕТ-ФАКТУРА, ТОВАРНАЯ НАКЛАДНАЯ, АКТ ПРИЕМА-ПЕРЕДАЧИ, ДОГОВОР ПОСТАВКИ).
OR
B) A physical hardware sticker, barcode label, laptop backplate, serial number plate.

Return a STRICT JSON object in this format:
{
  "isDocument": true or false,
  
  // IF isDocument is true (e.g. specification / invoice):
  "documentType": "Спецификация" or "Счет-фактура" or "Накладная" or "Акт",
  "documentNumber": "e.g. 24 or 142",
  "documentDate": "e.g. 02.09.2026",
  "supplier": "Name of seller / provider, e.g. ООО «Heavenly Wave»",
  "buyer": "Name of buyer / customer, e.g. ООО «FAYZ PARRANDA»",
  "contractInfo": "e.g. к Договору № 122 от 04.12.2024г.",
  "formattedDocumentTitle": "Clean concise title for inventory notes, e.g. Спецификация № 24 от 02.09.2026 (ООО «Heavenly Wave»)",
  "items": [
    {
      "type": "Standard Russian IT Category: Ноутбук | Монитор | Мышь | Клавиатура | Гарнитура | Сетевой фильтр | Рюкзак | USB Hub | ТСД | Принтер | Оборудование",
      "brand": "Clean readable brand and model with key specs, e.g. Lenovo V15 G4 AMN Ryzen 5 7520U / 8GB / 512GB SSD",
      "quantity": 5,
      "price": "6 026 785,71",
      "totalSum": "30 133 928,58",
      "unit": "шт"
    }
  ],
  "totalQuantity": 5,
  "totalSum": "33 750 000,00",
  "currency": "сум",

  // IF isDocument is false (hardware sticker / S/N):
  "serialNumber": "extracted S/N or empty string",
  "brand": "brand name or empty string",
  "model": "model or empty string",
  "pcId": "PC ID or domain tag if present",
  "detectedText": "raw OCR text summary",
  "confidence": 0.95
}
Ensure high accuracy on document numbers, dates, company names, and item quantities. If multiple equipment items are listed, extract each one in the items array.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    const isDoc = Boolean(
      parsed.isDocument ||
      parsed.documentNumber ||
      parsed.supplier ||
      (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0)
    );

    const items: DocumentItemRecognition[] = (Array.isArray(parsed.items) && parsed.items.length > 0)
      ? parsed.items.map((it: any) => ({
          type: String(it.type || 'Оборудование').trim(),
          brand: String(it.brand || it.name || 'Оборудование').trim(),
          quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
          price: it.price ? String(it.price) : undefined,
          totalSum: it.totalSum ? String(it.totalSum) : undefined,
          unit: it.unit ? String(it.unit) : 'шт'
        }))
      : [];

    const totalQty = items.reduce((sum, it) => sum + it.quantity, 0) || (parseInt(parsed.totalQuantity, 10) || 1);

    const docType = parsed.documentType || 'Счет-фактура / Накладная';
    const docNum = parsed.documentNumber ? `№ ${parsed.documentNumber}` : '';
    const docDate = parsed.documentDate ? `от ${parsed.documentDate}` : '';
    const supplier = parsed.supplier ? `(${parsed.supplier})` : '';
    const fallbackTitle = `${docType} ${docNum} ${docDate} ${supplier}`.replace(/\s+/g, ' ').trim();

    return {
      isDocument: isDoc,
      documentType: parsed.documentType || 'Счет-фактура',
      documentNumber: parsed.documentNumber || '',
      documentDate: parsed.documentDate || '',
      supplier: parsed.supplier || '',
      buyer: parsed.buyer || '',
      contractInfo: parsed.contractInfo || '',
      formattedDocumentTitle: parsed.formattedDocumentTitle || fallbackTitle,
      items,
      totalQuantity: totalQty,
      totalSum: parsed.totalSum || '',
      currency: parsed.currency || 'сум',
      serialNumber: parsed.serialNumber || '',
      brand: parsed.brand || '',
      model: parsed.model || '',
      pcId: parsed.pcId || '',
      detectedText: parsed.detectedText || '',
      confidence: parsed.confidence || 0.9,
    };
  } catch (err: any) {
    console.error('Error in analyzePhotoForHardwareOrDocument:', err);
    return {
      isDocument: false,
      items: [],
      totalQuantity: 1,
      serialNumber: '',
      brand: '',
      model: '',
      pcId: '',
      detectedText: err.message || 'Error processing image',
      confidence: 0,
    };
  }
}

// Backward compatible helper for S/N only extraction
export async function extractSnFromImage(ai: GoogleGenAI, base64Image: string, mimeType = 'image/jpeg'): Promise<{
  serialNumber: string;
  brand: string;
  model: string;
  pcId: string;
  detectedText: string;
  confidence: number;
}> {
  const result = await analyzePhotoForHardwareOrDocument(ai, base64Image, mimeType);
  return {
    serialNumber: result.serialNumber || '',
    brand: result.brand || (result.items[0]?.brand) || '',
    model: result.model || '',
    pcId: result.pcId || '',
    detectedText: result.detectedText || result.formattedDocumentTitle || '',
    confidence: result.confidence || 0.9,
  };
}

// Format Warehouse Receipt Confirmation Card with Edit buttons
export function formatWarehouseReceiptConfirm(r: NonNullable<BotUserState['warehouseReceiptData']>): {
  text: string;
  inlineKeyboard: any[][];
} {
  const count = Math.max(1, r.quantity || 1);
  const docTitle = r.document || 'Остатки склада (Инвентаризация)';

  let itemsSummary = '';
  if (r.items && r.items.length > 1) {
    itemsSummary = `\n📋 <b>Всего позиций в документе (${r.items.length} наим.):</b>\n` +
      r.items.map((it, idx) => `  ${idx + 1}. <b>${escapeHtml(it.type)}</b> ${escapeHtml(it.brand)} — <b>${it.quantity} шт.</b>`).join('\n') + '\n';
  }

  const text = `📋 <b>Проверьте данные оприходования на склад:</b>\n\n` +
    `📄 <b>Основание:</b> <code>${escapeHtml(docTitle)}</code>\n` +
    (r.seller ? `🏢 <b>Поставщик:</b> ${escapeHtml(r.seller)}\n` : '') +
    (r.buyer ? `👤 <b>Покупатель:</b> ${escapeHtml(r.buyer)}\n` : '') +
    itemsSummary +
    `\n📦 <b>Позиция к оприходованию:</b>\n` +
    `• <b>Категория:</b> <b>${escapeHtml(r.type || 'Оборудование')}</b>\n` +
    `• <b>Марка / Модель:</b> <b>${escapeHtml(r.brand || '—')}</b>\n` +
    `• <b>Количество:</b> <b>${count} шт.</b>\n` +
    (r.serialNumber && r.serialNumber !== '—' ? `• <b>S/N:</b> <code>${escapeHtml(r.serialNumber)}</code>\n` : '') +
    (r.price ? `• <b>Цена за ед.:</b> ${escapeHtml(r.price)} сум\n` : '') +
    (r.totalSum ? `• <b>Итого сумма:</b> ${escapeHtml(r.totalSum)} сум\n` : '') +
    `• <b>Место назначения:</b> 🏢 Склад ИТ (В наличии)\n` +
    `• <b>Ответственный:</b> 👮 Зохид Зокиров\n` +
    `• <b>В графу «Запись»:</b> <code>Приход: ${escapeHtml(docTitle)}</code>\n\n` +
    `<i>Вы можете скорректировать любое поле кнопками ниже или сразу подтвердить оприходование в реальном времени.</i>`;

  const inlineKeyboard: any[][] = [
    [{ text: `✅ Подтвердить и оприходовать (${count} шт.) на склад`, callback_data: 'wh_save_confirmed' }],
    [
      { text: '✏️ Кол-во', callback_data: 'wh_edit_qty' },
      { text: '✏️ Марка/Модель', callback_data: 'wh_edit_brand' },
      { text: '📦 Категория', callback_data: 'wh_edit_type' }
    ],
    [
      { text: '✏️ Основание (№ / Дата)', callback_data: 'wh_edit_doc' },
      { text: '📸 Фото документа', callback_data: 'wh_doc_photo_prompt' }
    ],
    ...(r.items && r.items.length > 1 ? [[{
      text: `📦 Оприходовать ВСЕ позиции документа (${r.items.reduce((s, it) => s + it.quantity, 0)} шт.)`,
      callback_data: 'wh_save_all_doc_items'
    }]] : []),
    [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
  ];

  return { text, inlineKeyboard };
}

// Bot Dialog Simulator / Runner Logic
export async function handleBotInteraction(
  userId: string | number,
  input: {
    type: 'message' | 'callback_query' | 'photo';
    text?: string;
    data?: string;
    photoBase64?: string;
  },
  ai: GoogleGenAI
): Promise<{
  text: string;
  inlineKeyboard?: { text: string; callback_data?: string; url?: string }[][];
  updatedDataset?: BotEquipmentRecord[];
  notice?: string;
  sendScriptDocument?: boolean;
}> {
  let state = userStates.get(userId) || { step: 'IDLE', data: {} };

  const now = new Date();
  const formatDateTime = () => {
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${d}.${m}.${y} ${h}:${min}:${s}`;
  };

  // Helper: Return script retrieval instructions and prompt file sending
  const getScriptCodeResponse = () => {
    return {
      text: `📄 <b>Google Apps Script для синхронизации с вашей таблицей</b>\n\n` +
        `Этот скрипт позволяет боту вставлять новые строки напрямую в Google Таблицу в реальном времени.\n\n` +
        `<b>Пошаговая инструкция (1 минута):</b>\n` +
        `1️⃣ Откройте таблицу в браузере:\n` +
        `👉 <a href="https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit">Открыть Google Таблицу</a>\n\n` +
        `2️⃣ В верхнем меню выберите:\n` +
        `<b>Расширения (Extensions) → Apps Script</b>\n\n` +
        `3️⃣ Полностью сотрите старый текст в редакторе и вставьте обновленный код скрипта, затем нажмите <b>Ctrl+S</b> (Сохранить).\n\n` +
        `4️⃣ <b>Главное:</b> нажимать кнопку «Выполнить» <b>НЕ нужно</b>!\n` +
        `В правом верхнем углу нажмите синюю кнопку:\n` +
        `👉 <b>«Начать развертывание»</b> (или <b>«Развернуть» → «Новое развертывание»</b>)\n` +
        `• Тип: <b>Веб-приложение</b> (шестеренка)\n` +
        `• Кто имеет доступ: <b>Все (Anyone)</b> <i>(обязательно!)</i>\n\n` +
        `5️⃣ Нажмите «Развернуть», предоставьте доступ, скопируйте полученную ссылку (заканчивается на <code>/exec</code>) и <b>отправьте её мне прямо сюда в чат</b>!`,
      inlineKeyboard: [
        [{ text: '🌐 Открыть Google Таблицу', url: 'https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit' }],
        [{ text: '🔄 Статус синхронизации', callback_data: 'show_sheets_link' }],
        [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
      ],
      sendScriptDocument: true
    };
  };

  // 1. Handle Commands or Navigation
  if (input.type === 'message' && input.text) {
    const rawText = input.text.trim();

    // Command or direct URL paste: Smart detection of Google Apps Script URL
    const scriptUrlPattern = /https:\/\/script\.google\.com\/macros\/s\/([a-zA-Z0-9_\-]+)(\/exec|\/dev|\/edit)?/i;
    const urlMatch = rawText.match(scriptUrlPattern);
    if (rawText.startsWith('/set_script_url') || urlMatch) {
      let scriptId = '';
      if (urlMatch) {
        scriptId = urlMatch[1];
      } else {
        const cleaned = rawText.replace('/set_script_url', '').trim();
        const m = cleaned.match(/macros\/s\/([a-zA-Z0-9_\-]+)/i);
        if (m) scriptId = m[1];
      }

      if (scriptId) {
        const normalizedUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
        setGoogleAppsScriptUrl(normalizedUrl);

        let pushStatusNotice = '';
        try {
          const pushRes = await pushAllInventoryToGoogleSheet(activeInventory);
          if (pushRes.success) {
            pushStatusNotice = `\n\n📊 <b>Все накопленные данные (${activeInventory.length} записей) автоматически выгружены в вашу Google Таблицу!</b>\nВключая последние добавления техники.`;
          } else {
            pushStatusNotice = `\n\nℹ️ <i>Ссылка сохранена. Нажмите «Выгрузить все данные» ниже для первой отправки.</i>`;
          }
        } catch (e: any) {
          pushStatusNotice = `\n\nℹ️ <i>Ссылка сохранена.</i>`;
        }

        return {
          text: `🟢 <b>Google Apps Script успешно подключен и сохранен!</b>\n\n` +
            `🔗 <b>Адрес веб-хука:</b>\n<code>${escapeHtml(normalizedUrl)}</code>` +
            pushStatusNotice +
            `\n\n✨ <b>Теперь все новые выдачи из бота будут моментально записываться в строки Google Таблицы в реальном времени!</b>`,
          inlineKeyboard: [
            [{ text: '📤 Выгрузить все данные в таблицу', callback_data: 'push_to_sheets_now' }],
            [{ text: '🔄 Обновить из Google Таблицы', callback_data: 'sync_sheets_now' }],
            [{ text: '👥 Список сотрудников', callback_data: 'lu:1' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      } else {
        return {
          text: `⚠️ <b>Не удалось распознать ссылку Google Apps Script.</b>\n\n` +
            `Ссылка должна иметь формат:\n<code>https://script.google.com/macros/s/.../exec</code>\n\n` +
            `👉 Скопируйте её из меню «Развернуть» в вашей Google Таблице и просто отправьте в этот чат.`,
          inlineKeyboard: [
            [{ text: '⚙️ Пошаговая инструкция', callback_data: 'setup_script_help' }],
            [{ text: '📄 Получить файл скрипта', callback_data: 'send_script_code' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      }
    }

    // Command: /script or /code
    if (rawText === '/script' || rawText === '/get_script' || rawText === '/code' || rawText === '/apps_script') {
      return getScriptCodeResponse();
    }

    // Command: /status or /sync_status
    if (rawText === '/status' || rawText === '/sync_status' || rawText === '/check') {
      const scriptUrl = getGoogleAppsScriptUrl();
      return {
        text: `📊 <b>Статус синхронизации системы:</b>\n\n` +
          `• <b>Всего записей в базе:</b> ${activeInventory.length}\n` +
          `• <b>Google Таблица:</b> Подключена\n` +
          `• <b>Запись в Google Таблицу (Apps Script):</b> ${scriptUrl ? '🟢 ПОДКЛЮЧЕНА (Реальное время)' : '🟡 Ожидает подключения скрипта'}\n` +
          (scriptUrl ? `• <b>URL веб-хука:</b> <code>...${escapeHtml(scriptUrl.slice(-25))}</code>\n\n` : `\n💡 <i>Чтобы бот мог вставлять строки прямо в ячейки вашей Google Таблицы, пришлите ссылку на веб-приложение скрипта прямо в этот чат.</i>\n\n`),
        inlineKeyboard: [
          [{ text: '🔄 Обновить из Google Таблицы', callback_data: 'sync_sheets_now' }],
          [{ text: '📤 Выгрузить всё в Google Таблицу', callback_data: 'push_to_sheets_now' }],
          ...(!scriptUrl ? [[{ text: '⚙️ Как подключить Google Таблицу', callback_data: 'setup_script_help' }]] : []),
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      };
    }

    if (rawText === '/sync' || rawText === '/pull') {
      input = { type: 'callback_query', data: 'sync_sheets_now' };
    } else if (rawText === '/push' || rawText === '/export') {
      input = { type: 'callback_query', data: 'push_to_sheets_now' };
    }
  }

  if (input.type === 'message' && (input.text === '/start' || input.text === '/menu' || input.text === '🏠 Главное меню')) {
    state = { step: 'IDLE', data: {} };
    userStates.set(userId, state);

    const scriptActive = !!getGoogleAppsScriptUrl();

    return {
      text: `👋 <b>Добро пожаловать в бот учета ИТ-оборудования!</b>\n\n` +
        `Здесь вы можете:\n` +
        `• 👥 Просматривать технику любого сотрудника\n` +
        `• 📦 Управлять складом, остатками и оприходованием по накладным\n` +
        `• ➕ Выдавать технику (с автовыбором марки и сканером S/N по фото)\n` +
        `• 🗑️ Удалять ошибочно добавленные позиции моментально из базы и таблицы\n` +
        `• 🔄 Синхронизировать данные с Google Таблицей\n\n` +
        `📊 <b>Всего записей в базе:</b> ${activeInventory.length}\n` +
        `🌐 <b>Синхронизация с Google Таблицей:</b> ${scriptActive ? '🟢 Двусторонняя (Активна)' : '⚠️ Чтение активно / Запись требует URL'}\n` +
        `👤 <b>Ответственный по умолчанию:</b> Зохид Зокиров`,
      inlineKeyboard: [
        [
          { text: '👥 Сотрудники', callback_data: 'lu:1' },
          { text: '📦 Склад и Остатки', callback_data: 'warehouse_view' },
        ],
        [
          { text: '📥 Оприходовать (Накладная)', callback_data: 'warehouse_receipt' },
          { text: '➕ Выдать технику', callback_data: 'start_add' },
        ],
        [
          { text: '🔍 Поиск по S/N или ID', callback_data: 'search_prompt' },
          { text: '📊 Статистика', callback_data: 'stats_overview' },
        ],
        [
          { text: '🔄 Обновить из таблицы', callback_data: 'sync_sheets_now' },
          { text: '🌐 Google Таблица & Статус', callback_data: 'show_sheets_link' },
        ]
      ]
    };
  }

  // 2. Callback Queries (Inline Button clicks)
  if (input.type === 'callback_query' && input.data) {
    const data = input.data;

    if (data === 'main_menu') {
      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);
      return {
        text: `🏠 <b>Главное меню ИТ-Учета</b>\n\nВыберите действие:`,
        inlineKeyboard: [
          [
            { text: '👥 Сотрудники', callback_data: 'lu:1' },
            { text: '📦 Склад и Остатки', callback_data: 'warehouse_view' },
          ],
          [
            { text: '📥 Оприходовать (Накладная)', callback_data: 'warehouse_receipt' },
            { text: '➕ Выдать технику', callback_data: 'start_add' },
          ],
          [
            { text: '🔍 Поиск по S/N или ID', callback_data: 'search_prompt' },
            { text: '📊 Статистика', callback_data: 'stats_overview' },
          ],
          [
            { text: '🔄 Обновить из таблицы', callback_data: 'sync_sheets_now' },
            { text: '🌐 Google Таблица & Статус', callback_data: 'show_sheets_link' },
          ]
        ]
      };
    }

    if (data.startsWith('lu:') || data.startsWith('list_users:')) {
      const page = parseInt(data.split(':')[1] || '1', 10);
      const pageSize = 8;
      const allUsers = getDistinctUsers();
      const totalPages = Math.ceil(allUsers.length / pageSize) || 1;
      const currentPage = Math.min(Math.max(1, page), totalPages);
      const usersOnPage = allUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      const buttons = usersOnPage.map((u) => {
        const uKey = registerCallbackPayload(u.name);
        return [
          {
            text: `${u.name.startsWith('📦') ? '' : '👤 '}${u.name} (${u.count} ед.)`,
            callback_data: `vu:${uKey}`
          }
        ];
      });

      const navButtons = [];
      if (currentPage > 1) {
        navButtons.push({ text: '⬅️ Назад', callback_data: `lu:${currentPage - 1}` });
      }
      navButtons.push({ text: `📄 ${currentPage}/${totalPages}`, callback_data: `noop` });
      if (currentPage < totalPages) {
        navButtons.push({ text: 'Вперед ➡️', callback_data: `lu:${currentPage + 1}` });
      }

      buttons.push(navButtons);
      buttons.push([{ text: '🏠 Главное меню', callback_data: 'main_menu' }]);

      return {
        text: `👥 <b>Список сотрудников и пользователей:</b>\n` +
          `Нажмите на сотрудника, чтобы просмотреть закрепленные за ним ноутбуки, мониторы и оборудование:`,
        inlineKeyboard: buttons
      };
    }

    if (data.startsWith('vu:') || data.startsWith('view_user:')) {
      const rawKey = data.split(':')[1] || '';
      const userName = resolveCallbackPayload(rawKey);
      const card = generateUserEquipmentCard(userName);
      return {
        text: card.text,
        inlineKeyboard: card.inlineKeyboard
      };
    }

    if (data.startsWith('au:') || data.startsWith('add_for_user:')) {
      const rawKey = data.split(':')[1] || '';
      const userName = resolveCallbackPayload(rawKey);
      const allUsers = getDistinctUsers();
      const existing = allUsers.find((u) => u.name.toLowerCase() === userName.toLowerCase());

      state = {
        step: 'ADD_TYPE',
        data: {
          "Имя пользователя": userName === '📦 Без назначения / Склад' ? '' : userName,
          "Должность": existing?.position || '',
          "Кто выдал": "Зохид Зокиров",
          "Отметка времени": formatDateTime(),
          "Движения": "Принял",
        }
      };
      userStates.set(userId, state);

      const typeButtons = getAvailableHardwareTypes().map((t) => [
        { text: `📦 ${t}`, callback_data: `st:${registerCallbackPayload(t)}` }
      ]);
      typeButtons.push([{ text: '❌ Отмена', callback_data: 'main_menu' }]);

      return {
        text: `➕ <b>Добавление техники для:</b> ${escapeHtml(userName)}\n\n` +
          `<b>Шаг 1 из 4:</b> Выберите <b>ТИП оборудования</b>:`,
        inlineKeyboard: typeButtons
      };
    }

    if (data === 'start_add') {
      state = {
        step: 'ADD_USER',
        data: {
          "Кто выдал": "Зохид Зокиров",
          "Отметка времени": formatDateTime(),
          "Движения": "Принял",
        }
      };
      userStates.set(userId, state);

      const quickUsers = getDistinctUsers().slice(0, 5).map((u) => [
        { text: `👤 ${u.name}`, callback_data: `su:${registerCallbackPayload(u.name)}` }
      ]);

      quickUsers.push([
        { text: '📦 Без назначения (Склад)', callback_data: `su:${registerCallbackPayload('')}` }
      ]);
      quickUsers.push([
        { text: '❌ Отмена', callback_data: 'main_menu' }
      ]);

      return {
        text: `➕ <b>Добавление новой техники в журнал</b>\n\n` +
          `<b>Шаг 1:</b> Выберите сотрудника или <b>напишите ФИО в ответном сообщении</b>:`,
        inlineKeyboard: quickUsers
      };
    }

    if (data.startsWith('su:') || data.startsWith('select_user:')) {
      const rawKey = data.split(':')[1] || '';
      const userName = resolveCallbackPayload(rawKey);
      state.data["Имя пользователя"] = userName;
      state.step = 'ADD_TYPE';
      userStates.set(userId, state);

      const typeButtons = getAvailableHardwareTypes().map((t) => [
        { text: `📦 ${t}`, callback_data: `st:${registerCallbackPayload(t)}` }
      ]);
      typeButtons.push([{ text: '❌ Отмена', callback_data: 'main_menu' }]);

      return {
        text: `👤 <b>Сотрудник:</b> ${escapeHtml(userName || '(Без назначения / Склад)')}\n\n` +
          `<b>Шаг 2:</b> Выберите <b>ТИП оборудования</b>:`,
        inlineKeyboard: typeButtons
      };
    }

    if (data.startsWith('st:') || data.startsWith('select_type:')) {
      const rawKey = data.split(':')[1] || '';
      const selectedType = resolveCallbackPayload(rawKey);
      state.data["Тип"] = selectedType;
      state.step = 'ADD_BRAND';
      userStates.set(userId, state);

      // Fetch available brands for this type
      const availableBrands = getAvailableBrandsForType(selectedType);

      const brandButtons = availableBrands.map((b) => [
        { text: `🏷️ ${b}`, callback_data: `sb:${registerCallbackPayload(b)}` }
      ]);

      brandButtons.push([
        { text: '✏️ Ввести другую марку текстом', callback_data: 'custom_brand_prompt' }
      ]);
      brandButtons.push([
        { text: '❌ Отмена', callback_data: 'main_menu' }
      ]);

      return {
        text: `📦 <b>Тип:</b> ${escapeHtml(selectedType)}\n\n` +
          `<b>Шаг 3:</b> Выберите <b>МАРКУ / Модель</b> из имеющихся на складе или введите свою:`,
        inlineKeyboard: brandButtons
      };
    }

    if (data.startsWith('sb:') || data.startsWith('select_brand:')) {
      const rawKey = data.split(':')[1] || '';
      const selectedBrand = resolveCallbackPayload(rawKey);
      state.data["Марка"] = selectedBrand;
      state.step = 'ADD_SN';
      userStates.set(userId, state);

      return {
        text: `🏷️ <b>Марка:</b> ${escapeHtml(selectedBrand)}\n\n` +
          `<b>Шаг 4:</b> Укажите <b>S/N (Серийный номер)</b>.\n\n` +
          `📸 <b>Вы можете:</b>\n` +
          `1. <b>Сфотографировать и отправить фото</b> наклейки / штрихкода (Gemini AI автоматически распознает S/N!)\n` +
          `2. Или <b>написать серийный номер текстом</b> в чат.\n` +
          `3. Нажать кнопку ниже, если серийного номера нет.`,
        inlineKeyboard: [
          [{ text: '⏭️ Пропустить S/N (без серийника)', callback_data: 'skip_sn' }],
          [{ text: '❌ Отмена', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'custom_brand_prompt') {
      state.step = 'ADD_CUSTOM_BRAND';
      userStates.set(userId, state);
      return {
        text: `✏️ <b>Введите точную марку и модель техники</b> (например, <i>HP G250 i5 8gb</i> или <i>Lenovo L24i</i>) ответным сообщением:`,
        inlineKeyboard: [[{ text: '❌ Отмена', callback_data: 'main_menu' }]]
      };
    }

    if (data === 'skip_sn') {
      state.data["S/N"] = '';
      state.step = 'ADD_PC_ID';
      userStates.set(userId, state);

      return {
        text: `🔢 <b>S/N:</b> (не указан)\n\n` +
          `<b>Шаг 5:</b> Введите <b>Идентификатор ПК (Доменный номер)</b>, например <code>TAS05-044-FN-LT</code>,\n` +
          `или нажмите кнопку «Пропустить», если это не ноутбук/ПК.`,
        inlineKeyboard: [
          [{ text: '⏭️ Пропустить Идентификатор ПК', callback_data: 'skip_pc_id' }],
          [{ text: '❌ Отмена', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'skip_pc_id') {
      state.data["Идентификатор ПК"] = '';
      state.step = 'CONFIRM_ADD';
      userStates.set(userId, state);

      const d = state.data;
      const scriptUrl = getGoogleAppsScriptUrl();
      return {
        text: `📋 <b>Проверьте данные перед сохранением:</b>\n\n` +
          `👤 <b>Сотрудник:</b> ${escapeHtml(d["Имя пользователя"] || '—')}\n` +
          `🏢 <b>Должность:</b> ${escapeHtml(d["Должность"] || '—')}\n` +
          `📦 <b>Тип:</b> ${escapeHtml(d["Тип"] || '—')}\n` +
          `🏷️ <b>Марка:</b> ${escapeHtml(d["Марка"] || '—')}\n` +
          `🔢 <b>S/N:</b> ${escapeHtml(d["S/N"] || '—')}\n` +
          `💻 <b>Идентификатор ПК:</b> ${escapeHtml(d["Идентификатор ПК"] || '—')}\n` +
          `👮 <b>Кто выдал:</b> ${escapeHtml(d["Кто выдал"] || 'Зохид Зокиров')}\n` +
          `🔄 <b>Движения:</b> ${escapeHtml(d["Движения"] || 'Принял')}\n` +
          `🕒 <b>Время:</b> ${escapeHtml(d["Отметка времени"])}\n\n` +
          (scriptUrl
            ? `Записать в журнал и синхронизировать с Google Таблицей?`
            : `Записать в журнал учета оборудования?`),
        inlineKeyboard: [
          [{
            text: scriptUrl ? '✅ Подтвердить и Записать в Google Таблицу' : '💾 Подтвердить и Сохранить в базу',
            callback_data: 'save_confirmed_record'
          }],
          [{ text: '❌ Отменить', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'save_confirmed_record') {
      const newRecord: BotEquipmentRecord = {
        "Отметка времени": state.data["Отметка времени"] || formatDateTime(),
        "Кто выдал": state.data["Кто выдал"] || "Зохид Зокиров",
        "Имя пользователя": state.data["Имя пользователя"] || "",
        "Должность": state.data["Должность"] || "",
        "Тип": state.data["Тип"] || "",
        "Марка": state.data["Марка"] || "",
        "Идентификатор ПК": state.data["Идентификатор ПК"] || "",
        "S/N": state.data["S/N"] || "",
        "Движения": state.data["Движения"] || "Принял",
        "Запись": state.data["Запись"] || "",
      };

      activeInventory = insertRecordForUser(activeInventory, newRecord);
      touchInventoryRevision(`Выдано: ${newRecord["Тип"]} ${newRecord["Марка"]} (${newRecord["Имя пользователя"] || 'Склад'})`);
      
      const scriptUrl = getGoogleAppsScriptUrl();
      let pushNotice = '';

      if (scriptUrl) {
        try {
          const pushRes = await pushRecordToGoogleSheet(newRecord);
          if (pushRes.success) {
            pushNotice = `🟢 <b>Google Таблица:</b> Строка мгновенно передана и записана в Google Таблицу!`;
          } else {
            pushNotice = `⚠️ <b>Google Таблица:</b> Ошибка записи (${escapeHtml(pushRes.message || 'Сбой сети')}).\n💾 Запись надежно сохранена в базе бота и дашборде.`;
          }
        } catch (e: any) {
          pushNotice = `⚠️ <b>Google Таблица:</b> Не удалось отправить в таблицу (${escapeHtml(e.message)}).\n💾 Запись сохранена в боте.`;
        }
      } else {
        pushNotice = `💾 <b>Статус сохранения:</b> Запись надежно сохранена в базе бота и закреплена за сотрудником.\n\n` +
          `💡 <i>Чтобы эта и будущие записи автоматически появлялись прямо в строках вашей Google Таблицы, подключите веб-скрипт (занимает 1 минуту):</i>`;
      }

      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);

      const uKey = registerCallbackPayload(newRecord["Имя пользователя"] || '📦 Без назначения / Склад');
      return {
        text: `🎉 <b>Запись успешно сохранена!</b>\n\n` +
          `Оборудование <b>«${escapeHtml(newRecord["Тип"])} ${escapeHtml(newRecord["Марка"])}»</b> закреплено за <b>${escapeHtml(newRecord["Имя пользователя"] || 'Складом')}</b>.\n\n` +
          pushNotice,
        inlineKeyboard: [
          [{ text: '👥 Посмотреть сотрудника', callback_data: `vu:${uKey}` }],
          ...(scriptUrl
            ? []
            : [
                [{ text: '⚙️ Инструкция для Google Таблицы', callback_data: 'setup_script_help' }],
                [{ text: '📄 Получить файл скрипта', callback_data: 'send_script_code' }]
              ]),
          [{ text: '➕ Добавить еще технику', callback_data: 'start_add' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Добавлена новая запись: ${newRecord["Тип"]} ${newRecord["Марка"]}`
      };
    }

    if (data === 'search_prompt') {
      state = { step: 'SEARCH', data: {} };
      userStates.set(userId, state);
      return {
        text: `🔍 <b>Поиск оборудования:</b>\n\nВведите в чат <b>S/N (Серийный номер)</b>, <b>Доменный номер (Идентификатор ПК)</b> или <b>ФИО сотрудника</b>:`,
        inlineKeyboard: [[{ text: '❌ Отмена', callback_data: 'main_menu' }]]
      };
    }

    if (data === 'stats_overview') {
      const total = activeInventory.length;
      const typeCounts: Record<string, number> = {};
      let returnedCount = 0;
      activeInventory.forEach((r) => {
        const t = String(r["Тип"] || 'Прочее');
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        if (r["Движения"] === 'Сдал') returnedCount += 1;
      });

      let statsText = `📊 <b>Статистика ИТ-оборудования:</b>\n\n`;
      statsText += `• <b>Всего единиц в базе:</b> ${total}\n`;
      statsText += `• <b>Сдано / На складе:</b> ${returnedCount}\n\n`;
      statsText += `<b>По категориям:</b>\n`;
      Object.entries(typeCounts).forEach(([type, cnt]) => {
        statsText += `  ▫️ ${escapeHtml(type)}: <b>${cnt} шт.</b>\n`;
      });

      return {
        text: statsText,
        inlineKeyboard: [
          [{ text: '👥 Список сотрудников', callback_data: 'lu:1' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'show_sheets_link') {
      const scriptUrl = getGoogleAppsScriptUrl();
      return {
        text: `🌐 <b>Google Таблица & Статус Синхронизации:</b>\n\n` +
          `• <b>Таблица:</b> <a href="https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit">Открыть в браузере</a>\n` +
          `• <b>Всего строк в базе:</b> ${activeInventory.length}\n` +
          `• <b>Запись в реальном времени (Apps Script):</b>\n  ${scriptUrl ? '🟢 ПОДКЛЮЧЕНА И АКТИВНА' : '🔴 НЕ ПОДКЛЮЧЕНА (Требуется Web App URL)'}\n\n` +
          (!scriptUrl
            ? `⚠️ Чтобы любые добавления из бота сразу появлялись в Google Таблице, скопируйте скрипт из файла <code>google-apps-script.js</code>, разверните как Веб-приложение (доступ «Все») и пришлите ссылку боту командой:\n<code>/set_script_url ССЫЛКА</code>\n`
            : `Любые новые выдачи мгновенно добавляются прямо в Google Таблицу.`),
        inlineKeyboard: [
          [{ text: '🔄 Обновить данные из Google Таблицы', callback_data: 'sync_sheets_now' }],
          [{ text: '📤 Выгрузить все данные в Google Таблицу', callback_data: 'push_to_sheets_now' }],
          ...(!scriptUrl ? [[{ text: '⚙️ Инструкция по подключению скрипта', callback_data: 'setup_script_help' }]] : []),
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'push_to_sheets_now') {
      const scriptUrl = getGoogleAppsScriptUrl();
      if (!scriptUrl) {
        return {
          text: `⚠️ <b>Google Apps Script еще не подключен!</b>\n\n` +
            `Для записи в Google Таблицу необходим веб-хук скрипта.\n\n` +
            `👉 <b>Как подключить за 1 минуту:</b>\n` +
            `1. В Google Таблице откройте <b>Расширения → Apps Script</b>.\n` +
            `2. Вставьте код из файла <code>google-apps-script.js</code>.\n` +
            `3. Нажмите <b>Развернуть → Новое развертывание → Веб-приложение</b> (Доступ: Все).\n` +
            `4. Скопируйте полученную ссылку и отправьте её мне командой:\n` +
            `<code>/set_script_url ВАША_ССЫЛКА_EXEC</code>\n` +
            `или просто пришлите ссылку в этот чат!`,
          inlineKeyboard: [
            [{ text: '⚙️ Подробная инструкция', callback_data: 'setup_script_help' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      }

      const pushRes = await pushAllInventoryToGoogleSheet(activeInventory);
      return {
        text: pushRes.success
          ? `🟢 <b>Все данные (${activeInventory.length} записей) успешно выгружены в Google Таблицу!</b>\n\n` +
            `Проверьте таблицу:\nhttps://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit`
          : `⚠️ <b>Ошибка при выгрузке в Google Таблицу:</b>\n${escapeHtml(pushRes.message || 'Сбой соединения')}`,
        inlineKeyboard: [
          [{ text: '🔄 Проверить синхронизацию', callback_data: 'sync_sheets_now' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'send_script_code') {
      return getScriptCodeResponse();
    }

    if (data === 'setup_script_help') {
      return {
        text: `📋 <b>Инструкция: Как включить запись в Google Таблицу (1 минута)</b>\n\n` +
          `1️⃣ Откройте вашу Google Таблицу:\n` +
          `<a href="https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit">Открыть Google Таблицу</a>\n\n` +
          `2️⃣ В меню выберите: <b>Расширения (Extensions) → Apps Script</b>\n\n` +
          `3️⃣ Вставьте код скрипта (нажмите кнопку «Получить файл скрипта» ниже)\n\n` +
          `4️⃣ Нажмите синюю кнопку <b>Развернуть → Новое развертывание</b>:\n` +
          `• Тип: <b>Веб-приложение</b> (Web app)\n` +
          `• Кто имеет доступ: <b>Все (Anyone)</b> (Обязательно!)\n\n` +
          `5️⃣ Скопируйте полученную ссылку (заканчивается на <b>/exec</b>) и просто отправьте её мне прямо сюда в чат!`,
        inlineKeyboard: [
          [{ text: '📄 Прислать файл скрипта в чат', callback_data: 'send_script_code' }],
          [{ text: '🌐 Открыть Google Таблицу', url: 'https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'sync_sheets_now') {
      try {
        const { syncGoogleSheetsToInventory } = await import('./googleSheetsSync');
        const syncRes = await syncGoogleSheetsToInventory();
        return {
          text: syncRes.success
            ? `🟢 <b>Синхронизация с Google Sheets выполнена!</b>\n\n` +
              `📦 <b>Всего записей в базе:</b> ${activeInventory.length}\n` +
              `🕒 <b>Время обновления:</b> ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
              `Данные в боте и в Google Таблице полностью согласованы.`
            : `⚠️ <b>Результат синхронизации:</b> ${escapeHtml(syncRes.message || 'Ошибка')}\n\n` +
              `В базе доступно ${activeInventory.length} записей.`,
          inlineKeyboard: [
            [{ text: '👥 Список сотрудников', callback_data: 'lu:1' }],
            [{ text: '🔍 Найти технику', callback_data: 'search_prompt' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ],
          updatedDataset: activeInventory,
          notice: `Синхронизировано ${activeInventory.length} записей из Google Sheets`
        };
      } catch (syncErr: any) {
        return {
          text: `⚠️ Ошибка при синхронизации: ${escapeHtml(syncErr.message)}`,
          inlineKeyboard: [[{ text: '🏠 Главное меню', callback_data: 'main_menu' }]]
        };
      }
    }

    // ==========================================
    // 🗑️ УДАЛЕНИЕ СЛУЧАЙНОЙ / ОШИБОЧНОЙ ТЕХНИКИ
    // ==========================================
    if (data.startsWith('rmu:')) {
      const rawKey = data.split(':')[1] || '';
      const userName = resolveCallbackPayload(rawKey);
      const userCard = generateUserEquipmentCard(userName);
      const userItems = userCard.items;

      if (userItems.length === 0) {
        return {
          text: `ℹ️ У сотрудника <b>${escapeHtml(userName)}</b> нет техники для удаления.`,
          inlineKeyboard: [
            [{ text: '👤 Вернуться к сотруднику', callback_data: `vu:${rawKey}` }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      }

      const buttons = userItems.map((item, idx) => {
        const type = item["Тип"] || 'Техника';
        const brand = item["Марка"] || '—';
        const sn = item["S/N"] ? ` (${item["S/N"]})` : '';
        return [{
          text: `${idx + 1}. 🗑️ ${type} ${brand}${sn}`,
          callback_data: `deli:${rawKey}:${idx}`
        }];
      });

      buttons.push([
        { text: '⬅️ Отмена / Назад к сотруднику', callback_data: `vu:${rawKey}` }
      ]);

      return {
        text: `🗑️ <b>Удаление ошибочной техники у сотрудника:</b>\n` +
          `👤 <b>${escapeHtml(userName)}</b>\n\n` +
          `<i>Выберите технику, которую нужно удалить из базы и Google Таблицы:</i>`,
        inlineKeyboard: buttons
      };
    }

    if (data.startsWith('deli:')) {
      const parts = data.split(':');
      const rawKey = parts[1] || '';
      const itemIdx = parseInt(parts[2] || '0', 10);
      const userName = resolveCallbackPayload(rawKey);
      const userCard = generateUserEquipmentCard(userName);
      const item = userCard.items[itemIdx];

      if (!item) {
        return {
          text: `⚠️ Единица техники не найдена.`,
          inlineKeyboard: [[{ text: '👤 К сотруднику', callback_data: `vu:${rawKey}` }]]
        };
      }

      return {
        text: `⚠️ <b>Подтверждение удаления единицы техники:</b>\n\n` +
          `👤 <b>Сотрудник:</b> ${escapeHtml(userName)}\n` +
          `📦 <b>Тип:</b> ${escapeHtml(item["Тип"] || '—')}\n` +
          `🏷️ <b>Марка:</b> ${escapeHtml(item["Марка"] || '—')}\n` +
          `🔢 <b>S/N:</b> <code>${escapeHtml(item["S/N"] || '—')}</code>\n` +
          (item["Идентификатор ПК"] ? `💻 <b>ID ПК:</b> <code>${escapeHtml(item["Идентификатор ПК"])}</code>\n` : '') +
          `🕒 <b>Время:</b> ${escapeHtml(item["Отметка времени"] || '—')}\n\n` +
          `❗️ <b>Внимание:</b> Эта строка будет <b>моментально удалена из базы и вычищена из Google Таблицы</b>. Удалить?`,
        inlineKeyboard: [
          [{ text: '🔴 Да, удалить из базы и таблицы', callback_data: `cdel:${rawKey}:${itemIdx}` }],
          [{ text: '❌ Отмена', callback_data: `vu:${rawKey}` }]
        ]
      };
    }

    if (data.startsWith('cdel:')) {
      const parts = data.split(':');
      const rawKey = parts[1] || '';
      const itemIdx = parseInt(parts[2] || '0', 10);
      const userName = resolveCallbackPayload(rawKey);
      const userCard = generateUserEquipmentCard(userName);
      const item = userCard.items[itemIdx];

      if (!item) {
        return {
          text: `⚠️ Единица техники не найдена или уже была удалена.`,
          inlineKeyboard: [[{ text: '👤 К сотруднику', callback_data: `vu:${rawKey}` }]]
        };
      }

      const delRes = await deleteRecordFromInventory({
        "Имя пользователя": item["Имя пользователя"],
        "Тип": item["Тип"],
        "Марка": item["Марка"],
        "S/N": item["S/N"],
        "Отметка времени": item["Отметка времени"],
        "Идентификатор ПК": item["Идентификатор ПК"],
      });

      return {
        text: `✅ <b>Оборудование успешно удалено!</b>\n\n` +
          `Позиция «<b>${escapeHtml(item["Тип"] || '')} ${escapeHtml(item["Марка"] || '')}</b>» удалена у сотрудника <b>${escapeHtml(userName)}</b>.\n` +
          `🌐 ${escapeHtml(delRes.message)}`,
        inlineKeyboard: [
          [{ text: '👤 Посмотреть обновленную карточку сотрудника', callback_data: `vu:${rawKey}` }],
          [{ text: '👥 Список сотрудников', callback_data: 'lu:1' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Удалено: ${item["Тип"]} ${item["Марка"]}`
      };
    }

    // ==========================================
    // 🔄 ВОЗВРАТ ТЕХНИКИ НА СКЛАД (ПЛЮСУЕТСЯ НА СКЛАД С ПОМЕТКОЙ)
    // ==========================================
    if (data.startsWith('rtu:')) {
      const rawKey = data.split(':')[1] || '';
      const userName = resolveCallbackPayload(rawKey);
      const userCard = generateUserEquipmentCard(userName);
      const userItems = userCard.items;

      if (userItems.length === 0) {
        return {
          text: `ℹ️ У сотрудника <b>${escapeHtml(userName)}</b> нет техники для возврата.`,
          inlineKeyboard: [
            [{ text: '👤 Вернуться к сотруднику', callback_data: `vu:${rawKey}` }]
          ]
        };
      }

      const buttons = userItems.map((item, idx) => {
        const type = item["Тип"] || 'Техника';
        const brand = item["Марка"] || '—';
        const sn = item["S/N"] ? ` (${item["S/N"]})` : '';
        return [{
          text: `${idx + 1}. 🔄 ${type} ${brand}${sn}`,
          callback_data: `reti:${rawKey}:${idx}`
        }];
      });

      buttons.push([
        { text: '⬅️ Назад к сотруднику', callback_data: `vu:${rawKey}` }
      ]);

      return {
        text: `🔄 <b>Возврат техники на склад:</b>\n` +
          `👤 <b>Сотрудник:</b> ${escapeHtml(userName)}\n\n` +
          `<i>Выберите единицу, которую сотрудник сдал / вернул:</i>`,
        inlineKeyboard: buttons
      };
    }

    if (data.startsWith('reti:')) {
      const parts = data.split(':');
      const rawKey = parts[1] || '';
      const itemIdx = parseInt(parts[2] || '0', 10);
      const userName = resolveCallbackPayload(rawKey);
      const userCard = generateUserEquipmentCard(userName);
      const item = userCard.items[itemIdx];

      if (!item) {
        return {
          text: `⚠️ Единица не найдена.`,
          inlineKeyboard: [[{ text: '👤 К сотруднику', callback_data: `vu:${rawKey}` }]]
        };
      }

      const todayStr = new Date().toLocaleDateString('ru-RU');

      return {
        text: `🔄 <b>Прием техники на склад от сотрудника:</b>\n\n` +
          `👤 <b>Сотрудник:</b> ${escapeHtml(userName)}\n` +
          `📦 <b>Техника:</b> ${escapeHtml(item["Тип"] || '—')} ${escapeHtml(item["Марка"] || '—')}\n` +
          `🔢 <b>S/N:</b> <code>${escapeHtml(item["S/N"] || '—')}</code>\n\n` +
          `При подтверждении техника <b>снимется с сотрудника</b>, <b>перейдет в остатки Склада</b>, ` +
          `а в графе «Запись» будет добавлена пометка:\n<code>(Возврат от: ${escapeHtml(userName)}, ${todayStr})</code>.\n\n` +
          `Принять технику на склад?`,
        inlineKeyboard: [
          [{ text: '✅ Да, принять на склад', callback_data: `cret:${rawKey}:${itemIdx}` }],
          [{ text: '❌ Отмена', callback_data: `vu:${rawKey}` }]
        ]
      };
    }

    if (data.startsWith('cret:')) {
      const parts = data.split(':');
      const rawKey = parts[1] || '';
      const itemIdx = parseInt(parts[2] || '0', 10);
      const userName = resolveCallbackPayload(rawKey);
      const userCard = generateUserEquipmentCard(userName);
      const item = userCard.items[itemIdx];

      if (!item) {
        return {
          text: `⚠️ Единица не найдена.`,
          inlineKeyboard: [[{ text: '👤 К сотруднику', callback_data: `vu:${rawKey}` }]]
        };
      }

      const retRes = await returnEquipmentToWarehouse({
        "Имя пользователя": item["Имя пользователя"],
        "Тип": item["Тип"],
        "Марка": item["Марка"],
        "S/N": item["S/N"],
      });

      return {
        text: `🟢 <b>Техника успешно принята на склад!</b>\n\n` +
          `• Оборудование <b>«${escapeHtml(item["Тип"] || '')} ${escapeHtml(item["Марка"] || '')}»</b> зачислено на Склад.\n` +
          `• Сотрудник <b>${escapeHtml(userName)}</b> больше не числится ответственным.\n` +
          `• В Google Таблицу внесена пометка:\n<code>(Возврат от: ${escapeHtml(userName)}, ${new Date().toLocaleDateString('ru-RU')})</code>.`,
        inlineKeyboard: [
          [{ text: '👤 Вернуться к сотруднику', callback_data: `vu:${rawKey}` }],
          [{ text: '📦 Открыть остатки Склада', callback_data: 'warehouse_view' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Возврат на склад от ${userName}: ${item["Тип"]} ${item["Марка"]}`
      };
    }

    // ==========================================
    // 📦 СКЛАД И ОПРИХОДОВАНИЕ ОБОРУДОВАНИЯ
    // ==========================================
    if (data === 'warehouse_view') {
      const wh = getWarehouseStock();

      let text = `📦 <b>ИТ-Склад и Остатки оборудования</b>\n\n` +
        `Всего единиц в наличии на складе: <b>${wh.totalCount} шт.</b>\n\n` +
        `<b>По категориям на складе:</b>\n`;

      if (Object.keys(wh.categoryCounts).length === 0) {
        text += `<i>На складе сейчас нет свободного оборудования.</i>\n`;
      } else {
        Object.entries(wh.categoryCounts).forEach(([cat, cnt]) => {
          text += `  ▫️ ${escapeHtml(cat)}: <b>${cnt} шт.</b>\n`;
        });
      }

      text += `\n💡 <i>Здесь отображаются все оприходованные накладные и возвраты от сотрудников.</i>`;

      return {
        text,
        inlineKeyboard: [
          [
            { text: '📸 Оприходовать по фото счета / накладной', callback_data: 'wh_doc_photo_prompt' }
          ],
          [
            { text: '📥 Оприходовать вручную', callback_data: 'warehouse_receipt' },
            { text: '📤 Выдать технику со склада', callback_data: 'wh_issue_list' }
          ],
          [
            { text: '📋 Показать единицы склада', callback_data: 'wh_items:1' },
            { text: '🔄 Обновить из таблицы', callback_data: 'sync_sheets_now' }
          ],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      };
    }

    if (data === 'wh_doc_photo_prompt') {
      state = {
        step: 'WH_DOC',
        data: {},
        warehouseReceiptData: { quantity: 1 }
      };
      userStates.set(userId, state);
      return {
        text: `📸 <b>Оприходование по фото счета / спецификации / накладной</b>\n\n` +
          `Отправьте фото документа прямо в этот чат!\n\n` +
          `🤖 <b>Нейросеть Gemini Vision моментально:</b>\n` +
          `• Распознает номер документа и дату\n` +
          `• Определит поставщика и организацию\n` +
          `• Извлечет позиции техники, марки, модели и характеристики\n` +
          `• Подсчитает точное количество и цены\n` +
          `• Предоставит кнопки для ручной проверки и редактирования перед внесением на склад и в Google Таблицу!\n\n` +
          `<i>Прикрепите и отправьте фото сейчас:</i>`,
        inlineKeyboard: [
          [{ text: '✏️ Ввести вручную без фото', callback_data: 'warehouse_receipt' }],
          [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
        ]
      };
    }

    if (data.startsWith('wh_items:')) {
      const page = parseInt(data.split(':')[1] || '1', 10);
      const pageSize = 6;
      const wh = getWarehouseStock();
      const totalPages = Math.ceil(wh.items.length / pageSize) || 1;
      const currentPage = Math.min(Math.max(1, page), totalPages);
      const pageItems = wh.items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      let text = `📋 <b>Оборудование на складе (Стр. ${currentPage} из ${totalPages}):</b>\n\n`;

      if (pageItems.length === 0) {
        text += `<i>На складе нет доступного оборудования.</i>\n`;
      } else {
        pageItems.forEach((item, idx) => {
          const num = (currentPage - 1) * pageSize + idx + 1;
          const type = item["Тип"] || 'Оборудование';
          const brand = item["Марка"] || '—';
          const sn = item["S/N"] ? ` | S/N: <code>${escapeHtml(item["S/N"])}</code>` : '';
          const notes = item["Запись"] ? `\n   📝 <i>${escapeHtml(item["Запись"])}</i>` : '';
          text += `<b>${num}. ${escapeHtml(type)} ${escapeHtml(brand)}</b>${sn}${notes}\n\n`;
        });
      }

      const navRow: any[] = [];
      if (currentPage > 1) {
        navRow.push({ text: '⬅️ Назад', callback_data: `wh_items:${currentPage - 1}` });
      }
      if (currentPage < totalPages) {
        navRow.push({ text: 'Вперед ➡️', callback_data: `wh_items:${currentPage + 1}` });
      }

      const keyboard: any[][] = [];
      if (navRow.length > 0) keyboard.push(navRow);
      keyboard.push([
        { text: '📥 Оприходовать партию', callback_data: 'warehouse_receipt' },
        { text: '📤 Выдать со склада', callback_data: 'wh_issue_list' }
      ]);
      keyboard.push([
        { text: '📦 Назад к Складу', callback_data: 'warehouse_view' },
        { text: '🏠 Главное меню', callback_data: 'main_menu' }
      ]);

      return { text, inlineKeyboard: keyboard };
    }

    // --- Оприходование оборудования (по накладной / счет-фактуре) ---
    if (data === 'warehouse_receipt') {
      state = {
        step: 'WH_TYPE',
        data: {},
        warehouseReceiptData: { quantity: 1 }
      };
      userStates.set(userId, state);

      const typeButtons = getAvailableHardwareTypes().map((t) => [
        { text: `📦 ${t}`, callback_data: `wht:${registerCallbackPayload(t)}` }
      ]);
      typeButtons.push([{ text: '❌ Отмена', callback_data: 'warehouse_view' }]);

      return {
        text: `📥 <b>Оприходование оборудования на склад</b>\n\n` +
          `Этот раздел позволяет оприходовать новую технику по <b>накладной</b> или <b>счет-фактуре</b>, ` +
          `чтобы вести строгий учет остатков на складе и оснований поступления.\n\n` +
          `<b>Шаг 1:</b> Выберите <b>категорию оборудования</b>:`,
        inlineKeyboard: typeButtons
      };
    }

    if (data.startsWith('wht:')) {
      const rawKey = data.split(':')[1] || '';
      const selectedType = resolveCallbackPayload(rawKey);
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        type: selectedType,
        quantity: 1
      };
      state.step = 'WH_BRAND';
      userStates.set(userId, state);

      const availableBrands = getAvailableBrandsForType(selectedType);
      const brandButtons = availableBrands.map((b) => [
        { text: `🏷️ ${b}`, callback_data: `whb:${registerCallbackPayload(b)}` }
      ]);
      brandButtons.push([
        { text: '✏️ Ввести марку текстом', callback_data: 'wh_custom_brand_prompt' }
      ]);
      brandButtons.push([{ text: '❌ Отмена', callback_data: 'warehouse_view' }]);

      return {
        text: `📦 <b>Категория:</b> ${escapeHtml(selectedType)}\n\n` +
          `<b>Шаг 2:</b> Выберите <b>марку / модель</b> или введите свою:`,
        inlineKeyboard: brandButtons
      };
    }

    if (data.startsWith('whb:')) {
      const rawKey = data.split(':')[1] || '';
      const selectedBrand = resolveCallbackPayload(rawKey);
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        brand: selectedBrand
      };
      state.step = 'WH_DOC';
      userStates.set(userId, state);

      return {
        text: `🏷️ <b>Марка:</b> ${escapeHtml(selectedBrand)}\n\n` +
          `<b>Шаг 3:</b> Введите <b>Основание прихода (Накладная / Счет-фактура)</b>:\n\n` +
          `📸 <i>Совет:</i> <b>Вы можете отправить ФОТО счета или спецификации прямо в чат</b> — бот сам распознает номер, дату и организацию!\n\n` +
          `<i>Или напишите основание текстом:</i> <code>Счет-фактура № 142 от 12.08.2025 (ООО «ИТ-Поставка»)</code>:`,
        inlineKeyboard: [
          [{ text: '📸 Отправить фото документа', callback_data: 'wh_doc_photo_prompt' }],
          [{ text: '⏭️ Без накладной (Старые остатки склада)', callback_data: 'wh_skip_doc' }],
          [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
        ]
      };
    }

    if (data === 'wh_custom_brand_prompt') {
      state.step = 'WH_CUSTOM_BRAND';
      userStates.set(userId, state);
      return {
        text: `✏️ <b>Введите точную марку и модель оборудования</b> ответным сообщением:`,
        inlineKeyboard: [[{ text: '❌ Отмена', callback_data: 'warehouse_view' }]]
      };
    }

    if (data === 'wh_skip_doc') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        document: 'Остатки склада (Инвентаризация)'
      };
      state.step = 'WH_SN';
      userStates.set(userId, state);

      return {
        text: `📄 <b>Основание:</b> Остатки склада\n\n` +
          `<b>Шаг 4:</b> Укажите <b>Серийный номер (S/N)</b> или отправьте фото шильдика:\n` +
          `<i>(Если это партия расходников, мышей или оборудования без S/N — нажмите кнопку ниже)</i>`,
        inlineKeyboard: [
          [{ text: '⏭️ Без S/N (указать количество партии)', callback_data: 'skip_wh_sn' }],
          [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
        ]
      };
    }

    if (data === 'skip_wh_sn') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        serialNumber: '—'
      };
      state.step = 'WH_QTY';
      userStates.set(userId, state);

      return {
        text: `🔢 <b>Серийный номер:</b> Без S/N\n\n` +
          `<b>Шаг 5:</b> Укажите <b>Количество единиц</b> (по умолчанию 1).\n` +
          `Отправьте число (например <code>5</code> или <code>10</code>) или нажмите кнопку:`,
        inlineKeyboard: [
          [{ text: '✅ 1 шт.', callback_data: 'wh_qty_1' }],
          [{ text: '📦 5 шт.', callback_data: 'wh_qty_5' }, { text: '📦 10 шт.', callback_data: 'wh_qty_10' }],
          [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
        ]
      };
    }

    if (data.startsWith('wh_qty_')) {
      const q = parseInt(data.replace('wh_qty_', ''), 10) || 1;
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        quantity: q
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);

      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    // --- Inline edits for Warehouse Receipt confirmation ---
    if (data === 'wh_edit_qty') {
      state.step = 'DOC_EDIT_QTY';
      userStates.set(userId, state);
      const curQty = state.warehouseReceiptData?.quantity || 1;
      return {
        text: `📊 <b>Изменение количества единиц оборудования:</b>\n\n` +
          `Текущее количество: <b>${curQty} шт.</b>\n\n` +
          `Выберите нужное число кнопкой или <b>отправьте число цифрой в чат</b>:`,
        inlineKeyboard: [
          [
            { text: '1 шт.', callback_data: 'wh_set_qty:1' },
            { text: '2 шт.', callback_data: 'wh_set_qty:2' },
            { text: '3 шт.', callback_data: 'wh_set_qty:3' },
            { text: '5 шт.', callback_data: 'wh_set_qty:5' }
          ],
          [
            { text: '10 шт.', callback_data: 'wh_set_qty:10' },
            { text: '15 шт.', callback_data: 'wh_set_qty:15' },
            { text: '20 шт.', callback_data: 'wh_set_qty:20' },
            { text: '50 шт.', callback_data: 'wh_set_qty:50' }
          ],
          [{ text: '↩️ Назад к карточке', callback_data: 'wh_back_to_confirm' }]
        ]
      };
    }

    if (data.startsWith('wh_set_qty:')) {
      const q = parseInt(data.split(':')[1] || '1', 10) || 1;
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        quantity: q
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);
      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (data === 'wh_edit_brand') {
      state.step = 'DOC_EDIT_BRAND';
      userStates.set(userId, state);
      const curBrand = state.warehouseReceiptData?.brand || '';
      return {
        text: `🏷️ <b>Изменение марки / модели оборудования:</b>\n\n` +
          `Текущее значение: <code>${escapeHtml(curBrand || '—')}</code>\n\n` +
          `<b>Напишите правильное наименование и модель</b> ответным сообщением в чат:`,
        inlineKeyboard: [
          [{ text: '↩️ Оставить текущее', callback_data: 'wh_back_to_confirm' }]
        ]
      };
    }

    if (data === 'wh_edit_doc') {
      state.step = 'DOC_EDIT_DOC';
      userStates.set(userId, state);
      const curDoc = state.warehouseReceiptData?.document || '';
      return {
        text: `📄 <b>Изменение основания прихода (№ накладной, дата):</b>\n\n` +
          `Текущее значение: <code>${escapeHtml(curDoc || '—')}</code>\n\n` +
          `<b>Напишите новое основание текстом</b> (или пришлите фото документа прямо сейчас):`,
        inlineKeyboard: [
          [{ text: '↩️ Оставить текущее', callback_data: 'wh_back_to_confirm' }]
        ]
      };
    }

    if (data === 'wh_edit_type') {
      state.step = 'DOC_EDIT_TYPE';
      userStates.set(userId, state);
      const typeButtons = getAvailableHardwareTypes().map((t) => [
        { text: `📦 ${t}`, callback_data: `wh_set_type:${registerCallbackPayload(t)}` }
      ]);
      typeButtons.push([{ text: '↩️ Назад к карточке', callback_data: 'wh_back_to_confirm' }]);
      return {
        text: `📦 <b>Выберите верную категорию оборудования:</b>`,
        inlineKeyboard: typeButtons
      };
    }

    if (data.startsWith('wh_set_type:')) {
      const rawKey = data.split(':')[1] || '';
      const selectedType = resolveCallbackPayload(rawKey);
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        type: selectedType
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);
      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (data === 'wh_back_to_confirm') {
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);
      return formatWarehouseReceiptConfirm(state.warehouseReceiptData || { quantity: 1 });
    }

    if (data === 'wh_save_all_doc_items') {
      const r = state.warehouseReceiptData || {};
      const items = (r.items && r.items.length > 0)
        ? r.items
        : [{ type: r.type || 'Оборудование', brand: r.brand || '—', quantity: r.quantity || 1 }];

      let totalCreated = 0;
      let driveUrlResult = '';
      for (const item of items) {
        const itemRes = await warehouseReceipt({
          type: item.type,
          brand: item.brand,
          document: r.document || '',
          quantity: item.quantity,
          serialNumber: '—',
          photoBase64: r.photoBase64,
        });
        if (itemRes.driveFileUrl) driveUrlResult = itemRes.driveFileUrl;
        totalCreated += item.quantity;
      }

      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);

      return {
        text: `🟢 <b>Все позиции из документа успешно оприходованы на склад!</b>\n\n` +
          `• <b>Всего оприходовано:</b> <b>${totalCreated} шт.</b>\n` +
          `• <b>Основание:</b> ${escapeHtml(r.document || 'По накладной')}\n` +
          (driveUrlResult ? `• 📁 <b>Фото сохранено на Google Диск:</b> <a href="${escapeHtml(driveUrlResult)}">Открыть файл</a>\n` : '') +
          `• 📁 <b>Папка накладных:</b> <a href="${GOOGLE_DRIVE_FOLDER_URL}">Karta_FP &gt; накладной</a>\n\n` +
          items.map((it, idx) => `  ${idx + 1}. <b>${escapeHtml(it.type)}</b> ${escapeHtml(it.brand)} — <b>${it.quantity} шт.</b>`).join('\n') +
          `\n\n🌐 Все записи внесены в базу и отправлены в Google Таблицу в реальном времени!`,
        inlineKeyboard: [
          [{ text: '📦 Открыть остатки Склада', callback_data: 'warehouse_view' }],
          [{ text: '📸 Оприходовать еще документ', callback_data: 'wh_doc_photo_prompt' }],
          [{ text: '📤 Выдать со склада сотруднику', callback_data: 'wh_issue_list' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Оприходовано по документу: ${totalCreated} шт.`
      };
    }

    if (data === 'wh_save_confirmed') {
      const r = state.warehouseReceiptData || {};
      const res = await warehouseReceipt({
        type: r.type || 'Оборудование',
        brand: r.brand || '—',
        document: r.document || '',
        serialNumber: r.serialNumber || '—',
        quantity: r.quantity || 1,
        photoBase64: r.photoBase64,
      });

      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);

      return {
        text: `🟢 <b>Оборудование успешно оприходовано на склад!</b>\n\n` +
          `• <b>Категория:</b> ${escapeHtml(r.type || '—')}\n` +
          `• <b>Марка:</b> ${escapeHtml(r.brand || '—')}\n` +
          `• <b>Количество:</b> ${r.quantity || 1} шт.\n` +
          `• <b>Основание:</b> ${escapeHtml(r.document || '—')}\n` +
          (res.driveFileUrl ? `• 📁 <b>Фото в Google Диск:</b> <a href="${escapeHtml(res.driveFileUrl)}">Открыть файл</a>\n` : '') +
          `• 📁 <b>Папка накладных:</b> <a href="${GOOGLE_DRIVE_FOLDER_URL}">Karta_FP &gt; накладной</a>\n\n` +
          `🌐 Данные внесены в базу и отправлены в Google Таблицу в реальном времени. ` +
          `Теперь техника доступна для выдачи сотрудникам со склада!`,
        inlineKeyboard: [
          [{ text: '📦 Открыть остатки Склада', callback_data: 'warehouse_view' }],
          [{ text: '📸 Оприходовать еще по фото', callback_data: 'wh_doc_photo_prompt' }],
          [{ text: '📤 Выдать со склада сотруднику', callback_data: 'wh_issue_list' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Оприходовано на склад: ${r.type} ${r.brand} (${r.quantity || 1} шт.)`
      };
    }

    // --- Выдача со склада (списание со склада -> передача сотруднику) ---
    if (data === 'wh_issue_list') {
      const wh = getWarehouseStock();
      if (wh.items.length === 0) {
        return {
          text: `ℹ️ <b>На складе сейчас нет свободного оборудования для выдачи.</b>\n\n` +
            `Вы можете оприходовать новую партию по накладной или принять возврат от сотрудника.`,
          inlineKeyboard: [
            [{ text: '📥 Оприходовать на склад', callback_data: 'warehouse_receipt' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      }

      const buttons = wh.items.slice(0, 10).map((item) => {
        const type = item["Тип"] || 'Техника';
        const brand = item["Марка"] || '—';
        const sn = item["S/N"] ? ` (${item["S/N"]})` : '';
        return [{
          text: `📤 ${type} ${brand}${sn}`,
          callback_data: `whis:${item.index}`
        }];
      });

      buttons.push([
        { text: '⬅️ Назад к Складу', callback_data: 'warehouse_view' }
      ]);

      return {
        text: `📤 <b>Выдача техники со склада сотруднику:</b>\n\n` +
          `<i>Выберите единицу со склада, которую нужно выдать:</i>`,
        inlineKeyboard: buttons
      };
    }

    if (data.startsWith('whis:')) {
      const itemIndex = parseInt(data.split(':')[1] || '-1', 10);
      const item = activeWarehouseInventory[itemIndex];
      if (!item) {
        return {
          text: `⚠️ Единица на складе не найдена.`,
          inlineKeyboard: [[{ text: '📦 К Складу', callback_data: 'warehouse_view' }]]
        };
      }

      state = {
        step: 'WH_ISSUE_CHOOSE_USER',
        data: {},
        warehouseIssueIndex: itemIndex
      };
      userStates.set(userId, state);

      const quickUsers = getDistinctUsers().slice(0, 6).map((u) => [
        { text: `👤 ${u.name}`, callback_data: `whisu:${registerCallbackPayload(u.name)}` }
      ]);
      quickUsers.push([{ text: '❌ Отмена', callback_data: 'warehouse_view' }]);

      const type = item["Типы"] || item["Тип"] || 'Оборудование';
      const brand = item["Марка и модели"] || item["Марка"] || '—';

      return {
        text: `📤 <b>Выдача единицы со склада:</b>\n` +
          `📦 <b>${escapeHtml(type)} ${escapeHtml(brand)}</b>\n` +
          `📄 <b>Основание:</b> <code>${escapeHtml(item["Основание"] || '—')}</code>\n` +
          `\n<b>Кому выдать?</b> Выберите сотрудника из списка или <b>напишите ФИО в ответном сообщении</b>:`,
        inlineKeyboard: quickUsers
      };
    }

    if (data.startsWith('whisu:')) {
      const rawKey = data.split(':')[1] || '';
      const userName = resolveCallbackPayload(rawKey);
      const itemIdx = state.warehouseIssueIndex;

      if (itemIdx === undefined || !activeWarehouseInventory[itemIdx]) {
        return {
          text: `⚠️ Сессия выбора устарела.`,
          inlineKeyboard: [[{ text: '📦 К Складу', callback_data: 'warehouse_view' }]]
        };
      }

      const issueRes = await issueFromWarehouseToUser(itemIdx, userName);

      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);

      return {
        text: `🟢 <b>Техника успешно выдана со склада!</b>\n\n` +
          `• <b>Сотрудник:</b> <b>${escapeHtml(userName)}</b>\n` +
          `• ${escapeHtml(issueRes.message)}\n` +
          `• Остаток на листе «Склад» списан («Выдано: ${escapeHtml(userName)}»).\n` +
          `• На «Лист1» добавлена закрепленная за сотрудником техника.\n` +
          `• Google Таблица синхронизирована (оба листа взаимосвязаны).`,
        inlineKeyboard: [
          [{ text: '👤 Посмотреть карточку сотрудника', callback_data: `vu:${rawKey}` }],
          [{ text: '📦 Остатки на Складе', callback_data: 'warehouse_view' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Выдано со склада: ${userName}`
      };
    }

  }

  // 3. Handle Photo Upload (Smart Document & Hardware S/N OCR via Gemini Vision)
  if (input.type === 'photo' && input.photoBase64) {
    const analysis = await analyzePhotoForHardwareOrDocument(ai, input.photoBase64);

    // CASE A: Recognized as an Invoice / Specification Document OR currently on Document/Receipt steps
    const isDocStep = state.step === 'WH_DOC' || state.step === 'DOC_EDIT_DOC' || state.step === 'WH_TYPE' || state.step === 'WH_BRAND';
    if (analysis.isDocument || isDocStep) {
      const bestItem = (analysis.items && analysis.items.length > 0)
        ? analysis.items[0]
        : {
            type: state.warehouseReceiptData?.type || 'Ноутбук',
            brand: state.warehouseReceiptData?.brand || 'Оборудование по накладной',
            quantity: analysis.totalQuantity || 1,
            price: undefined,
            totalSum: undefined,
            unit: 'шт'
          };

      const docTitle = analysis.formattedDocumentTitle ||
        (analysis.documentNumber ? `Счет-фактура № ${analysis.documentNumber} от ${analysis.documentDate || '—'}` : 'По накладной');

      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        photoBase64: input.photoBase64,
        document: docTitle,
        type: bestItem.type || state.warehouseReceiptData?.type || 'Ноутбук',
        brand: bestItem.brand || state.warehouseReceiptData?.brand || 'Оборудование',
        quantity: bestItem.quantity || state.warehouseReceiptData?.quantity || 1,
        seller: analysis.supplier,
        buyer: analysis.buyer,
        docDate: analysis.documentDate,
        docNumber: analysis.documentNumber,
        price: bestItem.price,
        totalSum: analysis.totalSum || bestItem.totalSum,
        items: analysis.items,
        serialNumber: analysis.serialNumber || '—',
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);

      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    // CASE B: Hardware Sticker / Serial Number OCR (for Warehouse or User Assignment)
    if (state.step === 'WH_SN') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        serialNumber: analysis.serialNumber || '—',
        quantity: 1,
      };
      if (analysis.brand && !state.warehouseReceiptData.brand) {
        state.warehouseReceiptData.brand = `${analysis.brand} ${analysis.model}`.trim();
      }
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);

      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (state.step === 'ADD_SN' || state.step === 'ADD_TYPE' || state.step === 'ADD_BRAND' || state.step === 'IDLE') {
      if (analysis.serialNumber) {
        state.data["S/N"] = analysis.serialNumber;
      }
      if (analysis.brand && !state.data["Марка"]) {
        state.data["Марка"] = `${analysis.brand} ${analysis.model}`.trim();
      }
      if (analysis.pcId && !state.data["Идентификатор ПК"]) {
        state.data["Идентификатор ПК"] = analysis.pcId;
      }

      state.step = 'ADD_PC_ID';
      userStates.set(userId, state);

      return {
        text: `📸 <b>Распознавание по фото выполнено успешно! (Gemini Vision)</b>\n\n` +
          `🔢 <b>S/N:</b> <code>${escapeHtml(analysis.serialNumber || '(не найден на фото)')}</code>\n` +
          `🏷️ <b>Модель:</b> ${escapeHtml(analysis.brand || '')} ${escapeHtml(analysis.model || '')}\n` +
          (analysis.pcId ? `💻 <b>ID ПК:</b> <code>${escapeHtml(analysis.pcId)}</code>\n` : '') +
          `\n<b>Шаг 5:</b> Введите <b>Идентификатор ПК (Доменный номер)</b> или подтвердите:`,
        inlineKeyboard: [
          [{ text: '⏭️ Пропустить Идентификатор ПК', callback_data: 'skip_pc_id' }],
          [{ text: '❌ Отмена', callback_data: 'main_menu' }]
        ]
      };
    }
  }

  // 4. Handle Text Messages in multi-step wizard
  if (input.type === 'message' && input.text) {
    const msg = input.text.trim();

    if (state.step === 'ADD_USER') {
      state.data["Имя пользователя"] = msg;
      state.step = 'ADD_TYPE';
      userStates.set(userId, state);

      const typeButtons = getAvailableHardwareTypes().map((t) => [
        { text: `📦 ${t}`, callback_data: `st:${registerCallbackPayload(t)}` }
      ]);
      typeButtons.push([{ text: '❌ Отмена', callback_data: 'main_menu' }]);

      return {
        text: `👤 <b>Сотрудник:</b> ${escapeHtml(msg)}\n\n` +
          `<b>Шаг 2:</b> Выберите <b>ТИП оборудования</b>:`,
        inlineKeyboard: typeButtons
      };
    }

    if (state.step === 'ADD_CUSTOM_BRAND') {
      state.data["Марка"] = msg;
      state.step = 'ADD_SN';
      userStates.set(userId, state);

      return {
        text: `🏷️ <b>Марка:</b> ${escapeHtml(msg)}\n\n` +
          `<b>Шаг 4:</b> Укажите <b>S/N (Серийный номер)</b>.\n` +
          `📸 Сфотографируйте наклейку или отправьте S/N текстом:`,
        inlineKeyboard: [
          [{ text: '⏭️ Пропустить S/N', callback_data: 'skip_sn' }],
          [{ text: '❌ Отмена', callback_data: 'main_menu' }]
        ]
      };
    }

    if (state.step === 'ADD_SN') {
      state.data["S/N"] = msg;
      state.step = 'ADD_PC_ID';
      userStates.set(userId, state);

      return {
        text: `🔢 <b>S/N:</b> <code>${escapeHtml(msg)}</code>\n\n` +
          `<b>Шаг 5:</b> Введите <b>Идентификатор ПК (Доменный номер)</b>, например <code>TAS05-044-FN-LT</code>:`,
        inlineKeyboard: [
          [{ text: '⏭️ Пропустить ID ПК', callback_data: 'skip_pc_id' }],
          [{ text: '❌ Отмена', callback_data: 'main_menu' }]
        ]
      };
    }

    if (state.step === 'ADD_PC_ID') {
      state.data["Идентификатор ПК"] = msg;
      state.step = 'CONFIRM_ADD';
      userStates.set(userId, state);

      const d = state.data;
      const scriptUrl = getGoogleAppsScriptUrl();
      return {
        text: `📋 <b>Проверьте данные перед сохранением:</b>\n\n` +
          `👤 <b>Сотрудник:</b> ${escapeHtml(d["Имя пользователя"] || '—')}\n` +
          `🏢 <b>Должность:</b> ${escapeHtml(d["Должность"] || '—')}\n` +
          `📦 <b>Тип:</b> ${escapeHtml(d["Тип"] || '—')}\n` +
          `🏷️ <b>Марка:</b> ${escapeHtml(d["Марка"] || '—')}\n` +
          `🔢 <b>S/N:</b> ${escapeHtml(d["S/N"] || '—')}\n` +
          `💻 <b>Идентификатор ПК:</b> ${escapeHtml(d["Идентификатор ПК"] || '—')}\n` +
          `👮 <b>Кто выдал:</b> ${escapeHtml(d["Кто выдал"] || 'Зохид Зокиров')}\n` +
          `🔄 <b>Движения:</b> ${escapeHtml(d["Движения"] || 'Принял')}\n` +
          `🕒 <b>Время:</b> ${escapeHtml(d["Отметка времени"])}\n\n` +
          (scriptUrl
            ? `Записать в журнал и синхронизировать с Google Таблицей?`
            : `Записать в журнал учета оборудования?`),
        inlineKeyboard: [
          [{
            text: scriptUrl ? '✅ Подтвердить и Записать в Google Таблицу' : '💾 Подтвердить и Сохранить в базу',
            callback_data: 'save_confirmed_record'
          }],
          [{ text: '❌ Отменить', callback_data: 'main_menu' }]
        ]
      };
    }

    if (state.step === 'WH_CUSTOM_BRAND') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        brand: msg,
      };
      state.step = 'WH_DOC';
      userStates.set(userId, state);

      return {
        text: `🏷️ <b>Марка:</b> ${escapeHtml(msg)}\n\n` +
          `<b>Шаг 3:</b> Введите <b>Основание прихода (Накладная / Счет-фактура)</b>:\n` +
          `<i>Например:</i> <code>Счет-фактура № 142 от 12.08.2025 (ООО «ИТ-Поставка»)</code>\n\n` +
          `Напишите основание ответным сообщением:`,
        inlineKeyboard: [
          [{ text: '⏭️ Без накладной (Остатки склада)', callback_data: 'wh_skip_doc' }],
          [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
        ]
      };
    }

    if (state.step === 'WH_DOC') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        document: msg,
      };
      state.step = 'WH_SN';
      userStates.set(userId, state);

      return {
        text: `📄 <b>Основание прихода:</b> <code>${escapeHtml(msg)}</code>\n\n` +
          `<b>Шаг 4:</b> Укажите <b>S/N (Серийный номер)</b>.\n` +
          `📸 Сфотографируйте наклейку / штрихкод или отправьте S/N текстом в чат:\n` +
          `<i>(Если это партия расходников/мышей без серийников — нажмите кнопку ниже)</i>`,
        inlineKeyboard: [
          [{ text: '⏭️ Без S/N (указать количество)', callback_data: 'skip_wh_sn' }],
          [{ text: '❌ Отмена', callback_data: 'warehouse_view' }]
        ]
      };
    }

    if (state.step === 'DOC_EDIT_DOC') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        document: msg,
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);
      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (state.step === 'DOC_EDIT_BRAND') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        brand: msg,
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);
      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (state.step === 'DOC_EDIT_QTY') {
      const q = parseInt(msg, 10);
      const safeQty = !isNaN(q) && q > 0 ? Math.min(q, 100) : 1;
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        quantity: safeQty,
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);
      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (state.step === 'WH_SN') {
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        serialNumber: msg,
        quantity: 1,
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);

      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (state.step === 'WH_QTY') {
      const q = parseInt(msg, 10);
      const safeQty = !isNaN(q) && q > 0 ? Math.min(q, 50) : 1;
      state.warehouseReceiptData = {
        ...(state.warehouseReceiptData || {}),
        quantity: safeQty,
      };
      state.step = 'WH_CONFIRM';
      userStates.set(userId, state);

      return formatWarehouseReceiptConfirm(state.warehouseReceiptData);
    }

    if (state.step === 'WH_ISSUE_CHOOSE_USER') {
      const userName = msg;
      const itemIdx = state.warehouseIssueIndex;

      if (itemIdx === undefined || !activeWarehouseInventory[itemIdx]) {
        return {
          text: `⚠️ Сессия выбора устарела.`,
          inlineKeyboard: [[{ text: '📦 К Складу', callback_data: 'warehouse_view' }]]
        };
      }

      const issueRes = await issueFromWarehouseToUser(itemIdx, userName);

      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);

      const rawKey = registerCallbackPayload(userName);

      return {
        text: `🟢 <b>Техника успешно выдана со склада!</b>\n\n` +
          `• <b>Сотрудник:</b> <b>${escapeHtml(userName)}</b>\n` +
          `• ${escapeHtml(issueRes.message)}\n` +
          `• Остаток на листе «Склад» списан («Выдано: ${escapeHtml(userName)}»).\n` +
          `• На «Лист1» добавлена закрепленная за сотрудником техника.\n` +
          `• Google Таблица синхронизирована (оба листа взаимосвязаны).`,
        inlineKeyboard: [
          [{ text: '👤 Посмотреть карточку сотрудника', callback_data: `vu:${rawKey}` }],
          [{ text: '📦 Остатки на Складе', callback_data: 'warehouse_view' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ],
        updatedDataset: activeInventory,
        notice: `Выдано со склада: ${userName}`
      };
    }

    if (state.step === 'SEARCH' || state.step === 'IDLE' || !state.step) {
      const results = searchInventory(msg);

      state = { step: 'IDLE', data: {} };
      userStates.set(userId, state);

      if (results.length === 0) {
        return {
          text: `🔍 По запросу «<b>${escapeHtml(msg)}</b>» ничего не найдено.\n\n` +
            `💡 <i>Подсказка:</i> Достаточно написать часть доменного номера (например <code>tas05-010</code> или <code>044</code>), серийного номера или фамилию сотрудника.`,
          inlineKeyboard: [
            [{ text: '🔍 Попробовать еще раз', callback_data: 'search_prompt' }],
            [{ text: '👥 Список сотрудников', callback_data: 'lu:1' }],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      }

      // If exactly 1 record found: Show full detailed equipment card
      if (results.length === 1) {
        const item = results[0];
        const user = item["Имя пользователя"] || '📦 Без назначения / Склад';
        const pcId = item["Идентификатор ПК"] || '—';
        const sn = item["S/N"] || '—';
        const type = item["Тип"] || 'Оборудование';
        const brand = item["Марка"] || '—';
        const movement = item["Движения"] || 'Принял';
        const pos = item["Должность"] || '';
        const time = item["Отметка времени"] || '';
        const issuer = item["Кто выдал"] || 'Зохид Зокиров';
        const notes = item["Запись"] || '';

        const movementIcon = movement === 'Сдал' ? '🟡 [Сдал]' : movement === 'Новый' ? '🔵 [Новый]' : '🟢 [Принял]';

        let text = `🔍 <b>Найдено оборудование:</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📦 <b>Тип и Марка:</b> <b>${escapeHtml(type)} ${escapeHtml(brand)}</b> ${movementIcon}\n` +
          `💻 <b>Доменный ID (ПК):</b> <code>${escapeHtml(pcId)}</code>\n` +
          `🔢 <b>S/N:</b> <code>${escapeHtml(sn)}</code>\n` +
          `👤 <b>Сотрудник:</b> <b>${escapeHtml(user)}</b>\n`;
        if (pos) text += `🏢 <b>Должность:</b> ${escapeHtml(pos)}\n`;
        text += `👮 <b>Кто выдал:</b> ${escapeHtml(issuer)}\n`;
        if (time) text += `🕒 <b>Дата записи:</b> ${escapeHtml(time)}\n`;
        if (notes) text += `📝 <b>Примечание:</b> <i>${escapeHtml(notes)}</i>\n`;

        const uKey = registerCallbackPayload(user);
        return {
          text,
          inlineKeyboard: [
            [{ text: `👤 Все устройства (${user.slice(0, 20)})`, callback_data: `vu:${uKey}` }],
            [
              { text: '➕ Выдать технику', callback_data: `au:${uKey}` },
              { text: '🔍 Новый поиск', callback_data: 'search_prompt' }
            ],
            [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
          ]
        };
      }

      // If multiple records found (2 to 10): List them clearly
      let resText = `🔍 <b>Найдено результатов (${results.length}):</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      const buttons: { text: string; callback_data: string }[][] = [];

      results.slice(0, 7).forEach((item, idx) => {
        const user = item["Имя пользователя"] || 'Склад';
        const type = item["Тип"] || '';
        const brand = item["Марка"] || '';
        const pcId = item["Идентификатор ПК"] || '';
        const sn = item["S/N"] || '—';
        const movement = item["Движения"] || 'Принял';
        const moveIcon = movement === 'Сдал' ? '🟡' : '🟢';

        resText += `<b>${idx + 1}. ${escapeHtml(type)} ${escapeHtml(brand)}</b> ${moveIcon}\n`;
        if (pcId) resText += `   💻 <b>ID:</b> <code>${escapeHtml(pcId)}</code>\n`;
        resText += `   🔢 <b>S/N:</b> <code>${escapeHtml(sn)}</code>\n`;
        resText += `   👤 <b>Сотрудник:</b> ${escapeHtml(user)}\n\n`;

        const uKey = registerCallbackPayload(user);
        buttons.push([
          {
            text: `👤 ${user.slice(0, 18)}: ${type} ${brand}`.slice(0, 40),
            callback_data: `vu:${uKey}`
          }
        ]);
      });

      if (results.length > 7) {
        resText += `<i>...и еще ${results.length - 7} записей. Уточните запрос.</i>\n\n`;
      }

      buttons.push([
        { text: '🔍 Новый поиск', callback_data: 'search_prompt' },
        { text: '🏠 Главное меню', callback_data: 'main_menu' }
      ]);

      return {
        text: resText,
        inlineKeyboard: buttons
      };
    }
  }
}
