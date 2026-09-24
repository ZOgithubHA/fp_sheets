import React from 'react';
import { Hash, Calendar, Type, CheckSquare, AlertCircle, TrendingUp, BarChart3, Layers } from 'lucide-react';
import { Dataset, ColumnMetadata } from '../types';

interface ColumnProfileViewProps {
  dataset: Dataset;
}

export const ColumnProfileView: React.FC<ColumnProfileViewProps> = ({ dataset }) => {
  return (
    <div className="space-y-6">
      
      {/* Intro header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Профилирование и статистика колонок
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Детальная структура данных, типы значений, распределения и агрегации для всех {dataset.columns.length} колонок
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          Всего записей: <strong className="text-slate-100">{dataset.totalRows}</strong>
        </div>
      </div>

      {/* Grid of Column Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dataset.columns.map((colName) => {
          const meta = dataset.columnMeta[colName];
          if (!meta) return null;

          const isNumeric = meta.type === 'number' || meta.type === 'currency' || meta.type === 'percentage';
          const fillPercentage = Math.round(((dataset.totalRows - meta.nullCount) / dataset.totalRows) * 100);

          return (
            <div
              key={colName}
              className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors"
            >
              <div>
                {/* Column header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="overflow-hidden">
                    <span className="text-xs text-slate-400 font-mono block">Поле</span>
                    <h3 className="text-sm font-semibold text-slate-100 truncate" title={colName}>
                      {colName}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-2xs font-semibold uppercase tracking-wider ${
                      isNumeric
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                        : meta.type === 'date'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                        : meta.type === 'boolean'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                    }`}
                  >
                    {meta.type}
                  </span>
                </div>

                {/* Completeness Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-2xs text-slate-400 mb-1">
                    <span>Заполненность</span>
                    <span className="font-semibold text-slate-200">
                      {dataset.totalRows - meta.nullCount} / {dataset.totalRows} ({fillRateString(fillPercentage)})
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        fillPercentage === 100
                          ? 'bg-emerald-500'
                          : fillPercentage > 80
                          ? 'bg-teal-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${fillPercentage}%` }}
                    />
                  </div>
                  {meta.nullCount > 0 && (
                    <div className="flex items-center gap-1 text-2xs text-amber-400/90 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{meta.nullCount} пропущенных значений</span>
                    </div>
                  )}
                </div>

                {/* Numeric Stats */}
                {isNumeric && meta.stats && (
                  <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/80 mb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-2xs text-slate-500 block">Минимум</span>
                        <span className="font-mono text-slate-200 font-medium">
                          {meta.stats.min?.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs text-slate-500 block">Максимум</span>
                        <span className="font-mono text-slate-200 font-medium">
                          {meta.stats.max?.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs text-slate-500 block">Среднее (Avg)</span>
                        <span className="font-mono text-emerald-400 font-medium">
                          {meta.stats.avg?.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs text-slate-500 block">Медиана</span>
                        <span className="font-mono text-slate-200 font-medium">
                          {meta.stats.median?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Общая сумма (Sum):</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {meta.stats.sum?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Categorical / Frequent Values */}
                {meta.topValues && meta.topValues.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between items-center text-2xs text-slate-400">
                      <span>Частые значения</span>
                      <span>Уникальных: {meta.uniqueCount}</span>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {meta.topValues.slice(0, 5).map((item, idx) => {
                        const pct = Math.round((item.count / (dataset.totalRows || 1)) * 100);
                        return (
                          <div key={idx} className="bg-slate-950/60 rounded px-2 py-1 text-2xs">
                            <div className="flex justify-between text-slate-300 mb-0.5">
                              <span className="truncate max-w-[180px]" title={item.value}>
                                {item.value || '(пусто)'}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {item.count} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-blue-500/70 h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Sample values preview */}
              <div className="pt-3 border-t border-slate-800/80 text-2xs text-slate-400">
                <span className="text-slate-500 block mb-1">Примеры данных:</span>
                <div className="flex flex-wrap gap-1">
                  {meta.sampleValues.slice(0, 3).map((val, sIdx) => (
                    <span
                      key={sIdx}
                      className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300 truncate max-w-[120px]"
                      title={String(val)}
                    >
                      {String(val)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

function fillRateString(pct: number) {
  return `${pct}%`;
}
