import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { TableView } from './components/TableView';
import { ColumnProfileView } from './components/ColumnProfileView';
import { ChartStudio } from './components/ChartStudio';
import { AiAnalyst } from './components/AiAnalyst';
import { PivotView } from './components/PivotView';
import { TelegramBotView } from './components/TelegramBotView';
import { WarehouseTableView } from './components/WarehouseTableView';
import { UploadModal } from './components/UploadModal';
import { GitHubModal } from './components/GitHubModal';
import { GitHubView } from './components/GitHubView';
import { Dataset } from './types';
import { analyzeDataset, SAMPLE_DATASETS } from './utils/dataProcessor';
import { AlertCircle, CheckCircle2, Sparkles, RefreshCw, FileSpreadsheet, ExternalLink } from 'lucide-react';

const INITIAL_SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/17mxs3jdsSjeQQtDWmxUuQ72s7F9QmJMU12Am0uKPs6Q/edit?usp=sharing';

export default function App() {
  const [sheetUrl, setSheetUrl] = useState(INITIAL_SPREADSHEET_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('table');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);

  // Initialize with the first rich sample dataset
  const [dataset, setDataset] = useState<Dataset>(() => {
    const sample = SAMPLE_DATASETS[0];
    const columns = Object.keys(sample.data[0]);
    return analyzeDataset(
      sample.data,
      columns,
      'sample-0',
      sample.name,
      INITIAL_SPREADSHEET_URL,
      'sample'
    );
  });

  const handleFetchSheet = async (urlToFetch: string) => {
    if (!urlToFetch.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const response = await fetch('/api/sheets/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Не удалось загрузить таблицу по указанной ссылке');
      }

      const analyzed = analyzeDataset(
        data.rows,
        data.columns,
        data.sheetId || `sheet-${Date.now()}`,
        `Google Таблица (${data.sheetId?.slice(0, 10)}...)`,
        urlToFetch,
        'google_sheets'
      );

      setDataset(analyzed);
      setSuccessNotice(`Таблица успешно загружена: ${analyzed.totalRows} строк, ${analyzed.columns.length} колонок!`);
    } catch (err: any) {
      console.warn('Google sheet fetch error:', err.message);
      setErrorMessage(
        `Не удалось напрямую прочитать таблицу из Google Sheets (${err.message}). Проверьте, открыт ли доступ «Все, у кого есть ссылка могут просматривать», либо загрузите CSV файл или выберите демонстрационный набор данных.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Attempt to fetch the target spreadsheet on initial load
  useEffect(() => {
    handleFetchSheet(INITIAL_SPREADSHEET_URL);
  }, []);

  // Poll server for live inventory state updates (e.g. from Telegram bot or Google Apps Script sync)
  useEffect(() => {
    let lastRevision = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/inventory/state');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.revision !== undefined && Array.isArray(data.rows)) {
          if (lastRevision > 0 && data.revision > lastRevision) {
            setDataset((prev) => {
              return analyzeDataset(
                data.rows,
                data.columns && data.columns.length > 0 ? data.columns : prev.columns,
                prev.id,
                prev.title,
                prev.sourceUrl,
                prev.sourceType
              );
            });
            if (data.lastNotice) {
              setSuccessNotice(`⚡ Обновление в реальном времени: ${data.lastNotice}`);
            }
          }
          lastRevision = data.revision;
        }
      } catch (err) {
        // silent background check
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const handleLoadSample = (index: number) => {
    const sample = SAMPLE_DATASETS[index] || SAMPLE_DATASETS[0];
    const columns = Object.keys(sample.data[0]);
    const analyzed = analyzeDataset(
      sample.data,
      columns,
      `sample-${index}`,
      sample.name,
      undefined,
      'sample'
    );
    setDataset(analyzed);
    setErrorMessage(null);
    setSuccessNotice(`Загружен демонстрационный набор: «${sample.name}»`);
  };

  const handleImportData = (
    rows: Record<string, any>[],
    columns: string[],
    title: string,
    sourceType: 'file_upload' | 'pasted'
  ) => {
    const analyzed = analyzeDataset(
      rows,
      columns,
      `import-${Date.now()}`,
      title,
      undefined,
      sourceType
    );
    setDataset(analyzed);
    setErrorMessage(null);
    setSuccessNotice(`Данные успешно импортированы: ${analyzed.totalRows} строк, ${analyzed.columns.length} колонок!`);
  };

  const handleUpdateRows = (updatedRows: Record<string, any>[]) => {
    const analyzed = analyzeDataset(
      updatedRows,
      dataset.columns,
      dataset.id,
      dataset.title,
      dataset.sourceUrl,
      dataset.sourceType
    );
    setDataset(analyzed);
    setSuccessNotice(`Журнал оборудования обновлен: всего ${analyzed.totalRows} записей.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Top Navigation Bar */}
      <Header
        sheetUrl={sheetUrl}
        setSheetUrl={setSheetUrl}
        onFetchSheet={handleFetchSheet}
        isLoading={isLoading}
        onLoadSample={handleLoadSample}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenGitHub={() => setIsGitHubOpen(true)}
        datasetTitle={dataset.title}
        rowCount={dataset.totalRows}
      />

      {/* Metrics & Tab Switcher Bar */}
      <MetricsBar dataset={dataset} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Status Alerts */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-800/80 text-amber-200 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-md">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-300">Внимание к доступу таблицы</div>
                <div className="text-amber-200/90 leading-relaxed">{errorMessage}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-2xs">
                  <button
                    onClick={() => handleLoadSample(0)}
                    className="px-2.5 py-1 bg-amber-900/80 hover:bg-amber-800 rounded font-medium text-amber-100 transition-colors"
                  >
                    Показать демо «Аналитика продаж»
                  </button>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-2.5 py-1 bg-slate-900/80 hover:bg-slate-800 rounded font-medium text-slate-200 transition-colors"
                  >
                    Загрузить файл CSV / Excel
                  </button>
                  {sheetUrl.includes('docs.google.com') && (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-300 underline hover:text-amber-100"
                    >
                      <span>Открыть таблицу в новой вкладке</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-400 hover:text-amber-200 p-1 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {successNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-2 shadow">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-400 hover:text-emerald-200 p-1 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* View switching based on active tab */}
        {activeTab === 'telegram' && (
          <TelegramBotView
            dataset={dataset}
            onUpdateRows={handleUpdateRows}
            spreadsheetUrl={sheetUrl}
          />
        )}
        {activeTab === 'table' && <TableView dataset={dataset} onUpdateRows={handleUpdateRows} />}
        {activeTab === 'warehouse' && (
          <WarehouseTableView
            spreadsheetUrl={sheetUrl}
            onRowIssuedToUser={() => {
              fetch('/api/inventory/state')
                .then(r => r.json())
                .then(d => {
                  if (d.success && d.rows) handleUpdateRows(d.rows);
                })
                .catch(() => {});
            }}
          />
        )}
        {activeTab === 'profile' && <ColumnProfileView dataset={dataset} />}
        {activeTab === 'charts' && <ChartStudio dataset={dataset} />}
        {activeTab === 'pivot' && <PivotView dataset={dataset} />}
        {activeTab === 'ai' && <AiAnalyst dataset={dataset} />}
        {activeTab === 'github' && <GitHubView onOpenModal={() => setIsGitHubOpen(true)} />}

      </main>

      {/* Upload / Import Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onImportData={handleImportData}
      />

      {/* GitHub Export / Sync Modal */}
      <GitHubModal
        isOpen={isGitHubOpen}
        onClose={() => setIsGitHubOpen(false)}
      />

    </div>
  );
}
