import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (rows: Record<string, any>[], columns: string[], title: string, sourceType: 'file_upload' | 'pasted') => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onImportData }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setErrorMsg('Файл не содержит данных или не может быть распознан как CSV/таблица');
          return;
        }

        const rows = results.data as Record<string, any>[];
        const columns = results.meta.fields || Object.keys(rows[0] || {});
        const title = customTitle.trim() || file.name.replace(/\.[^/.]+$/, '');

        onImportData(rows, columns, title, 'file_upload');
        onClose();
      },
      error: (error) => {
        setErrorMsg(`Ошибка чтения файла: ${error.message}`);
      },
    });
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg('Пожалуйста, вставьте текст таблицы или CSV');
      return;
    }

    setErrorMsg(null);
    const parsed = Papa.parse(pastedText.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (parsed.data.length === 0) {
      setErrorMsg('Не удалось распознать структуру таблицы из текста');
      return;
    }

    const rows = parsed.data as Record<string, any>[];
    const columns = parsed.meta.fields || Object.keys(rows[0] || {});
    const title = customTitle.trim() || 'Импортированная таблица';

    onImportData(rows, columns, title, 'pasted');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Импорт данных</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="p-4 space-y-4">
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('file')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'file' ? 'bg-slate-800 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Загрузить файл (.csv, .tsv, .txt)
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'paste' ? 'bg-slate-800 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Вставить текст / CSV
            </button>
          </div>

          {/* Dataset Title Input */}
          <div>
            <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Название набора (опционально)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Например: Продажи за 2025 год"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tab 1: File upload */}
          {activeTab === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-xs font-medium text-slate-200">
                Нажмите для выбора файла или перетащите сюда
              </div>
              <div className="text-2xs text-slate-500 mt-1">Поддерживаются форматы: .csv, .tsv, .txt</div>
            </div>
          ) : (
            <div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Вставьте сюда CSV или строки таблицы с заголовками..."
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handlePasteSubmit}
                className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                Распознать и загрузить
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
