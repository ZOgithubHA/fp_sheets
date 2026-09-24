import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  ArrowRightLeft,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building,
  UserCheck,
  Send,
  FileSpreadsheet,
  Layers,
  Sparkles,
  UploadCloud,
  FileText,
  Camera,
  Image as ImageIcon,
  Folder,
  Copy,
  Check,
  Settings,
  HelpCircle,
  X,
  Link as LinkIcon
} from 'lucide-react';

export interface WarehouseRow {
  "№ П/П": number | string;
  "Типы": string;
  "Марка и модели": string;
  "Единица измерения (м, шт.)": string;
  "Запись документа": string;
  "Кто принял": string;
  "Движение товаров": string;
  "Основание": string;
}

interface WarehouseTableViewProps {
  onRowIssuedToUser?: () => void;
  spreadsheetUrl?: string;
}

const DEFAULT_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ?hl=ru";

export const WarehouseTableView: React.FC<WarehouseTableViewProps> = ({
  onRowIssuedToUser,
  spreadsheetUrl
}) => {
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [columns, setColumns] = useState<string[]>([
    "№ П/П",
    "Типы",
    "Марка и модели",
    "Единица измерения (м, шт.)",
    "Запись документа",
    "Кто принял",
    "Движение товаров",
    "Основание"
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'issued'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google Apps Script Webhook State
  const [scriptUrl, setScriptUrl] = useState<string>('');
  const [isScriptConfigured, setIsScriptConfigured] = useState<boolean>(false);
  const [isAppsScriptModalOpen, setIsAppsScriptModalOpen] = useState<boolean>(false);
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState<string>('');
  const [appsScriptCode, setAppsScriptCode] = useState<string>('');
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);
  const [isTestingScript, setIsTestingScript] = useState<boolean>(false);
  const [scriptTestResult, setScriptTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Google Drive folder URL
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(DEFAULT_DRIVE_FOLDER_URL);

  // Modals state
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
  const [selectedIssueItem, setSelectedIssueItem] = useState<WarehouseRow | null>(null);

  // Receipt form
  const [receiptType, setReceiptType] = useState<string>('Ноутбук');
  const [receiptBrand, setReceiptBrand] = useState<string>('');
  const [receiptDocument, setReceiptDocument] = useState<string>('');
  const [receiptQuantity, setReceiptQuantity] = useState<number>(1);
  const [receiptReceiver, setReceiptReceiver] = useState<string>('Зохид Зокиров');
  const [receiptPhotoBase64, setReceiptPhotoBase64] = useState<string | null>(null);
  const [receiptPhotoName, setReceiptPhotoName] = useState<string>('');
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Issue form
  const [issueToUser, setIssueToUser] = useState<string>('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState<boolean>(false);
  const [knownUsers, setKnownUsers] = useState<string[]>([]);

  // Load warehouse data from backend
  const loadWarehouseData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory/warehouse-all');
      const data = await res.json();
      if (data.success && Array.isArray(data.rows)) {
        setRows(data.rows);
        if (data.columns && data.columns.length > 0) {
          setColumns(data.columns);
        }
      }
    } catch (e: any) {
      console.warn('Failed to load warehouse inventory:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load users list for easy issuing
  const loadUsers = async () => {
    try {
      const res = await fetch('/api/inventory/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setKnownUsers(data.users);
      }
    } catch (e) {}
  };

  // Load Apps Script status & code
  const loadAppsScriptInfo = async () => {
    try {
      const res = await fetch('/api/sheets/script-url');
      const data = await res.json();
      if (data.url) {
        setScriptUrl(data.url);
        setAppsScriptUrlInput(data.url);
        setIsScriptConfigured(true);
      } else {
        setIsScriptConfigured(false);
      }
    } catch (e) {}

    try {
      const res = await fetch('/api/sheets/apps-script-code');
      const data = await res.json();
      if (data.code) {
        setAppsScriptCode(data.code);
      }
    } catch (e) {}

    try {
      const res = await fetch('/api/drive/folder-info');
      const data = await res.json();
      if (data.folderUrl) {
        setDriveFolderUrl(data.folderUrl);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadWarehouseData();
    loadUsers();
    loadAppsScriptInfo();
  }, []);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const search = searchTerm.toLowerCase();
      const matchSearch =
        !search ||
        String(row["Марка и модели"] || '').toLowerCase().includes(search) ||
        String(row["Типы"] || '').toLowerCase().includes(search) ||
        String(row["Основание"] || '').toLowerCase().includes(search) ||
        String(row["Кто принял"] || '').toLowerCase().includes(search) ||
        String(row["Единица измерения (м, шт.)"] || '').toLowerCase().includes(search);

      if (!matchSearch) return false;

      if (filterType !== 'all') {
        if (!String(row["Типы"] || '').toLowerCase().includes(filterType.toLowerCase())) {
          return false;
        }
      }

      const statusText = String(row["Единица измерения (м, шт.)"] || '');
      const isIssued = /выдано/i.test(statusText);
      if (filterStatus === 'in_stock' && isIssued) return false;
      if (filterStatus === 'issued' && !isIssued) return false;

      return true;
    });
  }, [rows, searchTerm, filterType, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    let inStock = 0;
    let issued = 0;
    rows.forEach((r) => {
      const st = String(r["Единица измерения (м, шт.)"] || '');
      if (/выдано/i.test(st)) {
        issued++;
      } else {
        inStock++;
      }
    });
    return { total: rows.length, inStock, issued };
  }, [rows]);

  // Handle Photo File Selection
  const handlePhotoSelect = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotification({ type: 'error', text: 'Пожалуйста, выберите файл изображения (JPG, PNG)' });
      return;
    }
    setReceiptPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptPhotoBase64(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle receipt submit
  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptBrand.trim()) {
      setNotification({ type: 'error', text: 'Укажите марку и модель оборудования' });
      return;
    }

    setIsSubmittingReceipt(true);
    try {
      const res = await fetch('/api/inventory/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: receiptType,
          brand: receiptBrand.trim(),
          document: receiptDocument.trim(),
          quantity: receiptQuantity,
          receiver: receiptReceiver,
          photoBase64: receiptPhotoBase64 || undefined,
          fileName: receiptPhotoName || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          text: `Оприходовано ${receiptQuantity} шт. «${receiptBrand}» на лист «Склад»!${data.driveFileUrl ? ' Фото сохранено в Google Диск.' : ' Данные отправлены в Google Таблицу.'}`
        });
        setIsReceiptModalOpen(false);
        setReceiptBrand('');
        setReceiptDocument('');
        setReceiptQuantity(1);
        setReceiptPhotoBase64(null);
        setReceiptPhotoName('');
        await loadWarehouseData();
      } else {
        setNotification({ type: 'error', text: data.message || 'Ошибка оприходования' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  // Open issue modal
  const handleOpenIssueModal = (index: number, row: WarehouseRow) => {
    setSelectedIssueIndex(index);
    setSelectedIssueItem(row);
    setIssueToUser('');
    setIsIssueModalOpen(true);
  };

  // Handle issue submit
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIssueIndex === null || !issueToUser.trim()) {
      setNotification({ type: 'error', text: 'Укажите сотрудника для выдачи' });
      return;
    }

    setIsSubmittingIssue(true);
    try {
      const res = await fetch('/api/inventory/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIndex: selectedIssueIndex,
          toUser: issueToUser.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          text: `Оборудование успешно выдано сотруднику ${issueToUser}! Запись переведена в статус «Выдано» на листе «Склад» и внесена в Лист1 сотрудников.`
        });
        setIsIssueModalOpen(false);
        setSelectedIssueIndex(null);
        setSelectedIssueItem(null);
        await loadWarehouseData();
        if (onRowIssuedToUser) {
          onRowIssuedToUser();
        }
      } else {
        setNotification({ type: 'error', text: data.message || 'Ошибка при выдаче' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Handle delete row
  const handleDeleteRow = async (index: number) => {
    if (!window.confirm(`Удалить позицию #${index + 1} со склада?`)) return;
    try {
      const res = await fetch('/api/inventory/warehouse-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', text: 'Строка удалена из листа «Склад»' });
        await loadWarehouseData();
      } else {
        setNotification({ type: 'error', text: data.message || 'Ошибка удаления' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    }
  };

  // Synchronize with Google Sheet
  const handleSyncToSheets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sheets/push-warehouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          text: `Лист «Склад» успешно синхронизирован с Google Таблицей (${rows.length} записей)!`
        });
      } else {
        setNotification({
          type: 'error',
          text: data.message || 'Проверьте подключение Google Apps Script Web App'
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Save Apps Script Web App URL
  const handleSaveScriptUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = appsScriptUrlInput.trim();
    if (!cleanUrl) {
      setScriptTestResult({ success: false, message: 'Введите URL веб-приложения' });
      return;
    }

    try {
      const res = await fetch('/api/sheets/script-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setScriptUrl(cleanUrl);
        setIsScriptConfigured(true);
        // Run test immediately
        handleTestScriptUrl(cleanUrl);
      }
    } catch (err: any) {
      setScriptTestResult({ success: false, message: err.message });
    }
  };

  // Test script URL
  const handleTestScriptUrl = async (urlToTest?: string) => {
    const target = urlToTest || scriptUrl || appsScriptUrlInput;
    if (!target) return;

    setIsTestingScript(true);
    setScriptTestResult(null);

    try {
      const res = await fetch(target + '?action=ping');
      const data = await res.json();
      if (data.status === 'success') {
        setScriptTestResult({
          success: true,
          message: `✅ Связь установлена! Лист «${data.warehouseSheet || 'Склад'}» и Google Диск (ID: ${data.driveFolderId || 'OK'}) активны!`
        });
        setIsScriptConfigured(true);
        setScriptUrl(target);
      } else {
        setScriptTestResult({
          success: false,
          message: `Ответ скрипта: ${data.message || 'Ошибка выполнения'}`
        });
      }
    } catch (err: any) {
      // Sometimes CORS blocks GET in browser, try POST via backend
      try {
        const pingRes = await fetch('/api/sheets/push-warehouse', { method: 'POST' });
        const pingData = await pingRes.json();
        if (pingData.success) {
          setScriptTestResult({
            success: true,
            message: '✅ Синхронизация через сервер успешно проверена!'
          });
          setIsScriptConfigured(true);
        } else {
          setScriptTestResult({
            success: false,
            message: `⚠️ Проверьте права развертывания: выберите «Доступ: ВСЕ (Anyone)» при развертывании в Apps Script!`
          });
        }
      } catch (e2: any) {
        setScriptTestResult({
          success: false,
          message: `Ошибка связи: ${err.message}. Убедитесь, что Web App развернут с доступом «Все (Anyone)».`
        });
      }
    } finally {
      setIsTestingScript(false);
    }
  };

  // Copy updated Apps Script code
  const handleCopyCode = () => {
    if (!appsScriptCode) return;
    navigator.clipboard.writeText(appsScriptCode);
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 3000);
  };

  // Render "Основание" cell with smart link parsing
  const renderDocumentCell = (docText: string) => {
    if (!docText) return <span className="text-slate-500">—</span>;

    // Detect Google Drive URL or standard URL
    const driveMatch = docText.match(/https?:\/\/[^\s\]\)\"]+/i);
    if (driveMatch) {
      const url = driveMatch[0];
      const cleanTitle = docText.replace(url, '').replace(/\[Фото в Google Диске:\s*\]?/i, '').replace(/[\[\]]/g, '').trim();

      return (
        <div className="flex flex-col gap-1 max-w-xs">
          {cleanTitle && <span className="text-slate-200 text-2xs truncate" title={cleanTitle}>{cleanTitle}</span>}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 text-3xs font-semibold w-fit transition-colors"
            title="Открыть накладную в Google Диске"
          >
            <Folder className="w-3 h-3 text-emerald-400" />
            <span>Накладная в Drive ↗</span>
          </a>
        </div>
      );
    }

    return (
      <span className="text-slate-300 text-2xs max-w-xs truncate block" title={docText}>
        {docText}
      </span>
    );
  };

  return (
    <div className="space-y-4" id="warehouse-management-view">
      {/* Top Banner: Header + Quick Actions */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-950 border border-emerald-800/80 rounded-xl text-emerald-400 shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-100">
                Лист «Склад»: Оприходование и движение техники
              </h2>
              <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300">
                8 колонок
              </span>
              <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-950 border border-blue-700 text-blue-300">
                Связь с Лист1
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Все новые поступления техники по накладным фиксируются на отдельном листе <strong>«Склад»</strong>, 
              а фотографии документов автоматически сохраняются в вашей папке Google Диска.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Direct Google Drive Folder Button */}
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/60 shadow-sm transition-colors"
            title="Открыть папку «накладной» в Google Диске"
          >
            <Folder className="w-4 h-4 text-emerald-400" />
            <span>Папка накладных (Drive) ↗</span>
          </a>

          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Оприходовать на Склад</span>
          </button>

          <button
            onClick={handleSyncToSheets}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Синхронизировать данные склада с Google Таблицей"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Синхронизировать</span>
          </button>
        </div>
      </div>

      {/* Google Apps Script Status / Configuration Banner */}
      {!isScriptConfigured ? (
        <div className="p-3.5 rounded-xl border bg-amber-950/40 border-amber-800/80 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-amber-100">
                Google Apps Script Webhook не настроен для мгновенной синхронизации и загрузки накладных в Google Диск
              </div>
              <div className="text-amber-300/80 text-2xs">
                Скрипт настроен под оба листа («Лист1» + «Склад») и автоматически складывает фото в вашу папку Google Диска.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAppsScriptModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-colors inline-flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Подключить Webhook и Скрипт</span>
            </button>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-colors inline-flex items-center gap-1.5"
              title="Скопировать готовый код скрипта"
            >
              {isCopiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopiedCode ? 'Скопировано!' : 'Скопировать код'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3.5 py-2 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center justify-between gap-2 text-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">Google Apps Script Webhook подключен:</span>
            <span className="text-slate-400 font-mono truncate max-w-sm">{scriptUrl}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTestScriptUrl()}
              disabled={isTestingScript}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline inline-flex items-center gap-1"
            >
              {isTestingScript && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Проверить связь</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setIsAppsScriptModalOpen(true)}
              className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              <span>Настройки</span>
            </button>
          </div>
        </div>
      )}

      {/* Notification banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-2 shadow ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 font-bold text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Bar for Warehouse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-2xs font-semibold uppercase text-slate-400 tracking-wider">Всего записей на листе «Склад»</div>
            <div className="text-xl font-bold text-slate-100">{stats.total}</div>
          </div>
          <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-2xs font-semibold uppercase text-emerald-400 tracking-wider">В наличии на Складе ИТ</div>
            <div className="text-xl font-bold text-emerald-300">{stats.inStock}</div>
          </div>
          <div className="p-2 bg-emerald-950/80 border border-emerald-800/80 rounded-lg text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-2xs font-semibold uppercase text-blue-400 tracking-wider">Выдано сотрудникам (Лист1)</div>
            <div className="text-xl font-bold text-blue-300">{stats.issued}</div>
          </div>
          <div className="p-2 bg-blue-950/80 border border-blue-800/80 rounded-lg text-blue-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по листу Склад (модель, накладная, тип, кто принял)..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status filter */}
          <div className="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md text-2xs font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Все ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('in_stock')}
              className={`px-2.5 py-1 rounded-md text-2xs font-medium transition-colors ${
                filterStatus === 'in_stock' ? 'bg-emerald-900/80 text-emerald-200 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              В наличии ({stats.inStock})
            </button>
            <button
              onClick={() => setFilterStatus('issued')}
              className={`px-2.5 py-1 rounded-md text-2xs font-medium transition-colors ${
                filterStatus === 'issued' ? 'bg-blue-900/80 text-blue-200 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Выдано ({stats.issued})
            </button>
          </div>
        </div>
      </div>

      {/* Main Table: Exact 8 columns as requested */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-300 text-2xs uppercase tracking-wider">
                <th className="p-3 w-14 text-center font-bold text-slate-400 border-r border-slate-800/80">№ П/П</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Типы</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Марка и модели</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Единица измерения (м, шт.) / Статус</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Запись документа</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Кто принял</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Движение товаров</th>
                <th className="p-3 font-semibold border-r border-slate-800/80">Основание</th>
                <th className="p-3 text-center w-28 font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                      <span>Загрузка данных листа «Склад»...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-slate-600" />
                      <span className="text-slate-400 font-medium">Нет записей по заданным фильтрам</span>
                      <button
                        onClick={() => setIsReceiptModalOpen(true)}
                        className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                      >
                        Оприходовать первую партию
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const statusVal = String(row["Единица измерения (м, шт.)"] || '');
                  const isIssued = /выдано/i.test(statusVal);
                  const originalIndex = rows.indexOf(row);

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* 1. № П/П */}
                      <td className="p-3 text-center font-mono text-slate-400 font-bold border-r border-slate-800/60">
                        {row["№ П/П"] || idx + 1}
                      </td>

                      {/* 2. Типы */}
                      <td className="p-3 font-medium text-slate-200 border-r border-slate-800/60">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium text-2xs">
                          {row["Типы"] || 'Оборудование'}
                        </span>
                      </td>

                      {/* 3. Марка и модели */}
                      <td className="p-3 font-semibold text-slate-100 border-r border-slate-800/60">
                        {row["Марка и модели"] || '—'}
                      </td>

                      {/* 4. Единица измерения (м, шт.) */}
                      <td className="p-3 border-r border-slate-800/60">
                        {isIssued ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-blue-950 border border-blue-700 text-blue-300">
                            <UserCheck className="w-3 h-3 text-blue-400" />
                            {statusVal}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {statusVal || 'Склад ИТ (В наличии)'}
                          </span>
                        )}
                      </td>

                      {/* 5. Запись документа */}
                      <td className="p-3 text-slate-400 text-2xs font-mono border-r border-slate-800/60">
                        {row["Запись документа"] || '—'}
                      </td>

                      {/* 6. Кто принял */}
                      <td className="p-3 text-slate-300 border-r border-slate-800/60">
                        {row["Кто принял"] || 'Зохид Зокиров'}
                      </td>

                      {/* 7. Движение товаров */}
                      <td className="p-3 border-r border-slate-800/60">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold ${
                            /приход/i.test(row["Движение товаров"] || '')
                              ? 'bg-emerald-950/80 border border-emerald-700/80 text-emerald-300'
                              : 'bg-amber-950/80 border border-amber-700/80 text-amber-300'
                          }`}
                        >
                          {row["Движение товаров"] || 'Приход (Склад)'}
                        </span>
                      </td>

                      {/* 8. Основание (с авто-детекцией ссылок на Google Диск) */}
                      <td className="p-3 border-r border-slate-800/60">
                        {renderDocumentCell(row["Основание"] || '')}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {!isIssued ? (
                            <button
                              onClick={() => handleOpenIssueModal(originalIndex, row)}
                              className="px-2 py-1 rounded bg-blue-900/70 hover:bg-blue-800 text-blue-200 border border-blue-700 text-2xs font-semibold transition-colors inline-flex items-center gap-1"
                              title="Выдать сотруднику и перенести в Лист1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Выдать</span>
                            </button>
                          ) : (
                            <span className="text-slate-600 text-3xs italic">Выдано</span>
                          )}
                          <button
                            onClick={() => handleDeleteRow(originalIndex)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            title="Удалить позицию со склада"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Оприходование на Склад (с прикреплением фото в Google Диск) */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-950 rounded-lg text-emerald-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                    Оприходование на лист «Склад»
                  </h3>
                  <p className="text-2xs text-slate-400">
                    Запись будет внесена в форму листа «Склад» + фото в Google Диск
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReceiptSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Тип оборудования
                </label>
                <select
                  value={receiptType}
                  onChange={(e) => setReceiptType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Ноутбук">Ноутбук</option>
                  <option value="Монитор">Монитор</option>
                  <option value="Клавиатура">Клавиатура</option>
                  <option value="Мышь">Мышь</option>
                  <option value="Гарнитура">Гарнитура</option>
                  <option value="Рюкзак / Сумка">Рюкзак / Сумка</option>
                  <option value="USB Type-C Hub">USB Type-C Hub</option>
                  <option value="Сетевой фильтр">Сетевой фильтр</option>
                  <option value="Производственное оборудование">Производственное оборудование</option>
                  <option value="Расходные материалы">Расходные материалы</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Марка и модель *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Lenovo ThinkPad E15 Gen 4"
                  value={receiptBrand}
                  onChange={(e) => setReceiptBrand(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Количество (шт.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={receiptQuantity}
                    onChange={(e) => setReceiptQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Кто принял
                  </label>
                  <input
                    type="text"
                    value={receiptReceiver}
                    onChange={(e) => setReceiptReceiver(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Основание / Номер документа прихода
                </label>
                <input
                  type="text"
                  placeholder="Спецификация № 24 от 02.09.2026 или Счет-фактура"
                  value={receiptDocument}
                  onChange={(e) => setReceiptDocument(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                />
              </div>

              {/* Photo Upload for Invoice / Document (Saved to Google Drive) */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Фото накладной / акта прихода</span>
                  </label>
                  <span className="text-3xs font-medium text-emerald-400">
                    ☁️ Сохраняется в Google Диск
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelect(file);
                  }}
                />

                {!receiptPhotoBase64 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-emerald-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-900/40"
                  >
                    <UploadCloud className="w-7 h-7 text-slate-500 mx-auto mb-1.5" />
                    <div className="text-slate-300 font-medium text-xs">
                      Нажмите, чтобы прикрепить фото накладной
                    </div>
                    <div className="text-slate-500 text-3xs mt-0.5">
                      JPG, PNG или фото с камеры смартфона
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2.5 truncate">
                      <img
                        src={receiptPhotoBase64}
                        alt="Превью"
                        className="w-12 h-12 object-cover rounded border border-slate-700 shrink-0"
                      />
                      <div className="truncate">
                        <div className="text-slate-200 font-medium truncate text-xs">
                          {receiptPhotoName || 'Фото накладной прикреплено'}
                        </div>
                        <div className="text-emerald-400 text-3xs">
                          Готово к отправке в папку Google Диска
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptPhotoBase64(null);
                        setReceiptPhotoName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Удалить фото"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="text-3xs text-slate-400 leading-normal flex items-start gap-1 pt-1">
                  <Folder className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Файл автоматически загрузится в вашу папку Google Диска{' '}
                    <strong className="text-slate-200">«накладной»</strong> и прикрепится кликабельной ссылкой в графу «Основание».
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReceipt}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-md inline-flex items-center gap-1.5"
                >
                  {isSubmittingReceipt ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Сохранение и загрузка...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Оприходовать</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Выдача со склада сотруднику */}
      {isIssueModalOpen && selectedIssueItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-950 rounded-lg text-blue-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                    Выдать со склада сотруднику
                  </h3>
                  <p className="text-2xs text-slate-400">
                    Связывает лист «Склад» и «Лист1» (Сотрудники)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="text-slate-400 text-2xs uppercase">Позиция со склада:</div>
              <div className="font-semibold text-slate-100">
                {selectedIssueItem["Типы"]}: {selectedIssueItem["Марка и модели"]}
              </div>
              {selectedIssueItem["Основание"] && (
                <div className="text-slate-400 text-2xs">
                  Основание: {selectedIssueItem["Основание"]}
                </div>
              )}
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ФИО сотрудника (получателя) *
                </label>
                <input
                  type="text"
                  required
                  list="known-users-list"
                  placeholder="Введите ФИО сотрудника"
                  value={issueToUser}
                  onChange={(e) => setIssueToUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                />
                <datalist id="known-users-list">
                  {knownUsers.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              <p className="text-2xs text-slate-400 leading-relaxed">
                ℹ️ После выдачи на листе «Склад» статус изменится на «Выдано: {issueToUser || '...'}»,
                а в основной ведомости «Лист1» появится новая запись на имя сотрудника с отметкой «Принял».
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-md inline-flex items-center gap-1.5"
                >
                  {isSubmittingIssue ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Выдача...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Подтвердить выдачу</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Настройка Google Apps Script Webhook (Пошаговая инструкция для пользователя) */}
      {isAppsScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950 rounded-lg text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    Настройка Google Apps Script Web App
                  </h3>
                  <p className="text-2xs text-slate-400">
                    Синхронизация Лист1, Склад + Сохранение фото в Google Диск
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAppsScriptModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            {/* Step-by-step visual guide */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-slate-200">
                📌 Куда скопировать и вставить обновленный код:
              </div>

              <div className="space-y-2 text-slate-300">
                <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 text-emerald-300 font-bold text-2xs flex items-center justify-center shrink-0">1</span>
                  <span>
                    Откройте вашу Google Таблицу в браузере и в верхнем меню выберите:{' '}
                    <strong className="text-emerald-300">«Расширения» → «Apps Script»</strong>.
                  </span>
                </div>

                <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 text-emerald-300 font-bold text-2xs flex items-center justify-center shrink-0">2</span>
                  <div className="space-y-1">
                    <span>
                      Удалите там старый код (нажмите <strong>Ctrl + A</strong>, затем <strong>Delete</strong>) и вставьте скопированный ниже обновленный код:
                    </span>
                    <div>
                      <button
                        onClick={handleCopyCode}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5 shadow"
                      >
                        {isCopiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopiedCode ? 'Код успешно скопирован в буфер!' : '📋 Скопировать весь код Apps Script'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 text-emerald-300 font-bold text-2xs flex items-center justify-center shrink-0">3</span>
                  <span>
                    Сохраните (<strong>Ctrl + S</strong>), нажмите справа вверху синюю кнопку{' '}
                    <strong className="text-slate-100">«Развернуть» → «Новое развертывание»</strong>.<br />
                    Выберите тип: <strong>«Веб-приложение»</strong>.<br />
                    ⚠️ <strong>Очень важно:</strong> в поле «У кого есть доступ» выберите <strong className="text-emerald-400">«Все» (Anyone)</strong>, затем нажмите «Развернуть».
                  </span>
                </div>

                <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 text-emerald-300 font-bold text-2xs flex items-center justify-center shrink-0">4</span>
                  <span>
                    Скопируйте полученный URL (заканчивается на <code className="text-emerald-300">/exec</code>) и вставьте в поле ниже:
                  </span>
                </div>
              </div>

              {/* URL Input Form */}
              <div className="pt-2 space-y-2">
                <label className="block text-slate-200 font-bold">
                  URL Веб-приложения Google Apps Script:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={appsScriptUrlInput}
                    onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveScriptUrl()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow inline-flex items-center gap-1.5 shrink-0"
                  >
                    <span>Сохранить и проверить</span>
                  </button>
                </div>
              </div>

              {/* Test Result Callout */}
              {scriptTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    scriptTestResult.success
                      ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-800 text-rose-200'
                  }`}
                >
                  {scriptTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{scriptTestResult.message}</span>
                </div>
              )}

              {/* Google Drive Folder Confirmation */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-2xs">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Папка Google Диска для накладных:</span>
                  <span className="text-slate-400 font-mono">1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ</span>
                </div>
                <a
                  href={driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
                >
                  Открыть на Google Диске ↗
                </a>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAppsScriptModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
