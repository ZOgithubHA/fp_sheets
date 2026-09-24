import React, { useState } from 'react';
import { Table, Search, Sparkles, Upload, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Github } from 'lucide-react';
import { SAMPLE_DATASETS } from '../utils/dataProcessor';

interface HeaderProps {
  sheetUrl: string;
  setSheetUrl: (url: string) => void;
  onFetchSheet: (url: string) => void;
  isLoading: boolean;
  onLoadSample: (index: number) => void;
  onOpenUpload: () => void;
  onOpenGitHub?: () => void;
  datasetTitle: string;
  rowCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  sheetUrl,
  setSheetUrl,
  onFetchSheet,
  isLoading,
  onLoadSample,
  onOpenUpload,
  onOpenGitHub,
  datasetTitle,
  rowCount,
}) => {
  const [showSamplesDropdown, setShowSamplesDropdown] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetUrl.trim()) {
      onFetchSheet(sheetUrl.trim());
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo & App Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-inner text-white font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-lg text-slate-50 tracking-tight">Sheets & Data Analyzer</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Gemini AI
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700" title="Автоматическая синхронизация с Google Sheets каждые 30 секунд">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Google Sheets Live 30s</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {datasetTitle} • <span className="text-emerald-400 font-medium">{rowCount} строк</span>
              </p>
            </div>
          </div>

          {/* URL Search / Input Form */}
          <div className="flex-1 max-w-2xl">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="Вставьте ссылку на Google Sheets (например, https://docs.google.com/spreadsheets/d/...)"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all pr-24"
                />
                {sheetUrl.includes('docs.google.com') && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    title="Открыть в Google Sheets"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !sheetUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs sm:text-sm font-medium rounded-lg shadow transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Загрузка...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Изучить</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Actions & Sample Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSamplesDropdown(!showSamplesDropdown)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                <span>Примеры данных</span>
                <span className="text-slate-400">▾</span>
              </button>

              {showSamplesDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-40">
                  <div className="px-3 py-1.5 text-2xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Демонстрационные наборы
                  </div>
                  {SAMPLE_DATASETS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onLoadSample(idx);
                        setShowSamplesDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-emerald-300 transition-colors flex flex-col"
                    >
                      <span className="font-medium">{sample.name}</span>
                      <span className="text-2xs text-slate-400 truncate">{sample.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              title="Загрузить CSV файл или вставить текст"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Импорт</span>
            </button>

            {onOpenGitHub && (
              <button
                type="button"
                onClick={onOpenGitHub}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-750 hover:border-slate-600 rounded-lg border border-slate-700 transition-colors shadow-sm"
                title="Экспортировать и запушить проект в GitHub"
              >
                <Github className="w-3.5 h-3.5 text-white" />
                <span>GitHub</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
