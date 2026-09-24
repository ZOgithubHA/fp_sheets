import React from 'react';
import { Database, Columns, Hash, AlertTriangle, Download, ArrowUpRight, CheckCircle } from 'lucide-react';
import { Dataset } from '../types';
import { exportDatasetToCsv } from '../utils/dataProcessor';

interface MetricsBarProps {
  dataset: Dataset;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ dataset, activeTab, setActiveTab }) => {
  const numericCols = Object.values(dataset.columnMeta).filter(
    (c) => c.type === 'number' || c.type === 'currency' || c.type === 'percentage'
  ).length;

  const totalCells = dataset.totalRows * dataset.columns.length;
  const totalNulls = Object.values(dataset.columnMeta).reduce((acc, col) => acc + col.nullCount, 0);
  const fillRate = totalCells > 0 ? Math.round(((totalCells - totalNulls) / totalCells) * 100) : 100;

  const tabs = [
    { id: 'telegram', label: 'Telegram Бот', icon: '🤖', highlight: true },
    { id: 'table', label: 'Лист1: Сотрудники', icon: '📋' },
    { id: 'warehouse', label: 'Лист «Склад»', icon: '🏢', highlight: true },
    { id: 'profile', label: 'Профиль колонок', icon: '📊' },
    { id: 'charts', label: 'Графики & Диаграммы', icon: '📈' },
    { id: 'pivot', label: 'Сводные итоги', icon: '🧮' },
    { id: 'ai', label: 'AI Аналитик', icon: '✨' },
    { id: 'github', label: 'GitHub Экспорт', icon: '🐙', highlight: true },
  ];

  return (
    <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        {/* Metric badges */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 whitespace-nowrap">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Строк:</span>
            <strong className="text-white font-semibold">{dataset.totalRows.toLocaleString()}</strong>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 whitespace-nowrap">
            <Columns className="w-3.5 h-3.5 text-emerald-400" />
            <span>Колонок:</span>
            <strong className="text-white font-semibold">{dataset.columns.length}</strong>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 whitespace-nowrap">
            <Hash className="w-3.5 h-3.5 text-purple-400" />
            <span>Числовых метрик:</span>
            <strong className="text-white font-semibold">{numericCols}</strong>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
            <span>Заполненность:</span>
            <strong className="text-white font-semibold">{fillRate}%</strong>
          </div>

          <button
            onClick={() => exportDatasetToCsv(dataset, `${dataset.title || 'dataset'}.csv`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors ml-auto lg:ml-0"
            title="Экспорт в CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV</span>
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? tab.highlight
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
};
