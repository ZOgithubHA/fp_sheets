import React, { useState, useMemo } from 'react';
import { Layers, Sliders, ArrowUpDown, Download } from 'lucide-react';
import { Dataset } from '../types';
import { cleanNumericValue } from '../utils/dataProcessor';

interface PivotViewProps {
  dataset: Dataset;
}

export const PivotView: React.FC<PivotViewProps> = ({ dataset }) => {
  const categoricalCols = dataset.columns.filter((c) => {
    const t = dataset.columnMeta[c]?.type;
    return t === 'string' || t === 'date' || t === 'boolean';
  });

  const numericCols = dataset.columns.filter((c) => {
    const t = dataset.columnMeta[c]?.type;
    return t === 'number' || t === 'currency' || t === 'percentage';
  });

  const [rowGroupCol, setRowGroupCol] = useState(categoricalCols[0] || dataset.columns[0] || '');
  const [metricCol, setMetricCol] = useState(numericCols[0] || dataset.columns[1] || dataset.columns[0] || '');
  const [aggType, setAggType] = useState<'sum' | 'avg' | 'count' | 'min' | 'max'>('sum');

  const pivotData = useMemo(() => {
    if (!rowGroupCol || !metricCol) return [];

    const map = new Map<string, { count: number; sum: number; min: number; max: number; values: number[] }>();

    dataset.rows.forEach((r) => {
      const rawKey = r[rowGroupCol];
      const key = rawKey === null || rawKey === undefined || rawKey === '' ? '(Пусто)' : String(rawKey);

      const num = cleanNumericValue(r[metricCol]);
      const val = num !== null ? num : 0;

      if (!map.has(key)) {
        map.set(key, {
          count: 1,
          sum: val,
          min: val,
          max: val,
          values: [val],
        });
      } else {
        const item = map.get(key)!;
        item.count += 1;
        item.sum += val;
        item.min = Math.min(item.min, val);
        item.max = Math.max(item.max, val);
        item.values.push(val);
      }
    });

    const totalMetricSum = Array.from(map.values()).reduce((acc, curr) => acc + curr.sum, 0);

    const rows = Array.from(map.entries()).map(([key, stats]) => {
      let metricResult = 0;
      switch (aggType) {
        case 'sum':
          metricResult = stats.sum;
          break;
        case 'avg':
          metricResult = stats.count > 0 ? stats.sum / stats.count : 0;
          break;
        case 'count':
          metricResult = stats.count;
          break;
        case 'min':
          metricResult = stats.min;
          break;
        case 'max':
          metricResult = stats.max;
          break;
      }

      const share = totalMetricSum > 0 ? Math.round((stats.sum / totalMetricSum) * 1000) / 10 : 0;

      return {
        key,
        count: stats.count,
        metric: Math.round(metricResult * 100) / 100,
        sum: Math.round(stats.sum * 100) / 100,
        avg: Math.round((stats.sum / stats.count) * 100) / 100,
        min: stats.min,
        max: stats.max,
        share,
      };
    });

    // Sort descending by metric
    rows.sort((a, b) => b.metric - a.metric);

    return rows;
  }, [dataset.rows, rowGroupCol, metricCol, aggType]);

  const totalCalculated = useMemo(() => {
    return pivotData.reduce((acc, curr) => acc + curr.metric, 0);
  }, [pivotData]);

  return (
    <div className="space-y-6">
      
      {/* Configuration Header */}
      <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Сводная таблица (Pivot Aggregation)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Группируйте строки по любой категории и вычисляйте сумму, среднее, доли и экстремумы
          </p>
        </div>

        {/* Quick controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <label className="text-2xs text-slate-400 block mb-1">Группировать по:</label>
            <select
              value={rowGroupCol}
              onChange={(e) => setRowGroupCol(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {dataset.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-2xs text-slate-400 block mb-1">Метрика:</label>
            <select
              value={metricCol}
              onChange={(e) => setMetricCol(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {dataset.columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-2xs text-slate-400 block mb-1">Операция:</label>
            <select
              value={aggType}
              onChange={(e) => setAggType(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="sum">Сумма (Sum)</option>
              <option value="avg">Среднее (Average)</option>
              <option value="count">Количество (Count)</option>
              <option value="max">Максимум (Max)</option>
              <option value="min">Минимум (Min)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Aggregated Table */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-300">
              <tr>
                <th className="p-3 font-semibold uppercase tracking-wider text-2xs text-slate-400">
                  {rowGroupCol}
                </th>
                <th className="p-3 font-semibold text-right uppercase tracking-wider text-2xs text-slate-400">
                  Количество строк
                </th>
                <th className="p-3 font-semibold text-right uppercase tracking-wider text-2xs text-emerald-400">
                  {aggType.toUpperCase()} ({metricCol})
                </th>
                <th className="p-3 font-semibold text-right uppercase tracking-wider text-2xs text-slate-400">
                  Среднее (Avg)
                </th>
                <th className="p-3 font-semibold text-right uppercase tracking-wider text-2xs text-slate-400">
                  Минимум / Максимум
                </th>
                <th className="p-3 font-semibold text-right uppercase tracking-wider text-2xs text-slate-400 w-36">
                  Доля от общего (%)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pivotData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-medium text-slate-200">{row.key}</td>
                  <td className="p-3 text-right font-mono text-slate-400">{row.count}</td>
                  <td className="p-3 text-right font-mono font-semibold text-emerald-300">
                    {row.metric.toLocaleString('ru-RU')}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-300">
                    {row.avg.toLocaleString('ru-RU')}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-400 text-2xs">
                    {row.min.toLocaleString()} — {row.max.toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono text-2xs text-slate-300">{row.share}%</span>
                      <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(row.share, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-950 border-t border-slate-700 font-bold text-xs text-slate-200">
              <tr>
                <td className="p-3">Итого ({pivotData.length} групп)</td>
                <td className="p-3 text-right font-mono">
                  {pivotData.reduce((acc, r) => acc + r.count, 0)}
                </td>
                <td className="p-3 text-right font-mono text-emerald-400">
                  {Math.round(totalCalculated * 100) / 100}
                </td>
                <td className="p-3 text-right font-mono text-slate-400">-</td>
                <td className="p-3 text-right font-mono text-slate-400">-</td>
                <td className="p-3 text-right font-mono text-slate-200">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
};
