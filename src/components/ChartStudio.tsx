import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Sliders, RefreshCw, Plus, Sparkles } from 'lucide-react';
import { Dataset, ChartConfig, ChartType } from '../types';
import { aggregateChartData } from '../utils/dataProcessor';

interface ChartStudioProps {
  dataset: Dataset;
}

const COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', 
  '#06B6D4', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
  '#A855F7', '#E11D48'
];

export const ChartStudio: React.FC<ChartStudioProps> = ({ dataset }) => {
  // Find first categorical & first numeric columns as sensible defaults
  const numericColumns = useMemo(() => {
    return dataset.columns.filter((c) => {
      const type = dataset.columnMeta[c]?.type;
      return type === 'number' || type === 'currency' || type === 'percentage';
    });
  }, [dataset]);

  const categoricalColumns = useMemo(() => {
    return dataset.columns.filter((c) => {
      const type = dataset.columnMeta[c]?.type;
      return type === 'string' || type === 'date' || type === 'boolean';
    });
  }, [dataset]);

  const defaultX = categoricalColumns[0] || dataset.columns[0] || '';
  const defaultY = numericColumns[0] || dataset.columns[1] || dataset.columns[0] || '';

  const [activeConfig, setActiveConfig] = useState<ChartConfig>({
    id: 'custom_chart',
    title: `${defaultY} по ${defaultX}`,
    type: 'bar',
    xAxisKey: defaultX,
    yAxisKey: defaultY,
    aggregation: 'sum',
    limit: 12,
  });

  const chartData = useMemo(() => {
    return aggregateChartData(dataset.rows, activeConfig);
  }, [dataset.rows, activeConfig]);

  // Suggested auto charts
  const suggestedConfigs: ChartConfig[] = useMemo(() => {
    const list: ChartConfig[] = [];
    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      // 1. Primary Bar
      list.push({
        id: 's1',
        title: `Распределение: ${numericColumns[0]} по ${categoricalColumns[0]}`,
        type: 'bar',
        xAxisKey: categoricalColumns[0],
        yAxisKey: numericColumns[0],
        aggregation: 'sum',
        limit: 10,
      });

      // 2. Pie chart for top categories
      list.push({
        id: 's2',
        title: `Доли: ${numericColumns[0]} (${categoricalColumns[0]})`,
        type: 'pie',
        xAxisKey: categoricalColumns[0],
        yAxisKey: numericColumns[0],
        aggregation: 'sum',
        limit: 6,
      });

      // 3. Line / Trend if there's a second category or date
      if (categoricalColumns.length > 1) {
        list.push({
          id: 's3',
          title: `Сравнение: ${numericColumns[0]} по ${categoricalColumns[1]}`,
          type: 'line',
          xAxisKey: categoricalColumns[1],
          yAxisKey: numericColumns[0],
          aggregation: 'avg',
          limit: 12,
        });
      }

      // 4. Second numeric metric if available
      if (numericColumns.length > 1) {
        list.push({
          id: 's4',
          title: `Динамика: ${numericColumns[1]} по ${categoricalColumns[0]}`,
          type: 'area',
          xAxisKey: categoricalColumns[0],
          yAxisKey: numericColumns[1],
          aggregation: 'sum',
          limit: 10,
        });
      }
    }
    return list;
  }, [categoricalColumns, numericColumns]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="h-80 flex items-center justify-center text-slate-500 text-sm">
          Недостаточно числовых данных для построения графика с выбранными параметрами.
        </div>
      );
    }

    switch (activeConfig.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis
                dataKey={activeConfig.xAxisKey}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey={activeConfig.yAxisKey} fill="#10B981" radius={[4, 4, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis
                dataKey={activeConfig.xAxisKey}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey={activeConfig.yAxisKey}
                stroke="#3B82F6"
                strokeWidth={3}
                dot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#0F172A' }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis
                dataKey={activeConfig.xAxisKey}
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey={activeConfig.yAxisKey}
                stroke="#8B5CF6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }} />
              <Pie
                data={chartData}
                dataKey={activeConfig.yAxisKey}
                nameKey={activeConfig.xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={50}
                paddingAngle={3}
                label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart cx="50%" cy="50%" outerRadius={120} data={chartData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey={activeConfig.xAxisKey} stroke="#94A3B8" fontSize={10} />
              <PolarRadiusAxis stroke="#64748B" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Radar
                name={activeConfig.yAxisKey}
                dataKey={activeConfig.yAxisKey}
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.5}
              />
            </RadarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Smart Suggestions Bar */}
      {suggestedConfigs.length > 0 && (
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Рекомендованные диаграммы
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {suggestedConfigs.map((cfg) => (
              <button
                key={cfg.id}
                onClick={() => setActiveConfig(cfg)}
                className={`p-3 rounded-lg text-left text-xs transition-all border ${
                  activeConfig.title === cfg.title
                    ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="font-medium truncate">{cfg.title}</div>
                <div className="text-2xs text-slate-400 mt-1 capitalize">
                  Тип: {cfg.type} • {cfg.aggregation}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart Builder & Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Controls Panel */}
        <div className="lg:col-span-1 bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Конструктор графика</span>
          </div>

          {/* Chart Type Selector */}
          <div className="space-y-1.5">
            <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
              Тип графика
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['bar', 'line', 'area', 'pie', 'radar'] as ChartType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveConfig({ ...activeConfig, type: t })}
                  className={`py-2 px-2 text-xs rounded font-medium capitalize transition-colors ${
                    activeConfig.type === t
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* X Axis Dimension */}
          <div className="space-y-1.5">
            <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
              Ось X (Группировка / Категория)
            </label>
            <select
              value={activeConfig.xAxisKey}
              onChange={(e) =>
                setActiveConfig({
                  ...activeConfig,
                  xAxisKey: e.target.value,
                  title: `${activeConfig.yAxisKey} по ${e.target.value}`,
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              {dataset.columns.map((col) => (
                <option key={col} value={col}>
                  {col} ({dataset.columnMeta[col]?.type})
                </option>
              ))}
            </select>
          </div>

          {/* Y Axis Metric */}
          <div className="space-y-1.5">
            <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
              Ось Y (Числовая Метрика)
            </label>
            <select
              value={activeConfig.yAxisKey}
              onChange={(e) =>
                setActiveConfig({
                  ...activeConfig,
                  yAxisKey: e.target.value,
                  title: `${e.target.value} по ${activeConfig.xAxisKey}`,
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              {dataset.columns.map((col) => (
                <option key={col} value={col}>
                  {col} ({dataset.columnMeta[col]?.type})
                </option>
              ))}
            </select>
          </div>

          {/* Aggregation method */}
          <div className="space-y-1.5">
            <label className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
              Функция агрегации
            </label>
            <select
              value={activeConfig.aggregation}
              onChange={(e) =>
                setActiveConfig({
                  ...activeConfig,
                  aggregation: e.target.value as any,
                })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="sum">Сумма (Sum)</option>
              <option value="avg">Среднее (Average)</option>
              <option value="count">Количество строк (Count)</option>
              <option value="max">Максимум (Max)</option>
              <option value="min">Минимум (Min)</option>
            </select>
          </div>

          {/* Limit items */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-2xs text-slate-400">
              <span>Лимит элементов на графике</span>
              <span className="font-semibold text-slate-200">{activeConfig.limit}</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={activeConfig.limit || 12}
              onChange={(e) => setActiveConfig({ ...activeConfig, limit: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

        </div>

        {/* Chart View Canvas */}
        <div className="lg:col-span-3 bg-slate-900/90 p-5 rounded-xl border border-slate-800 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">{activeConfig.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Агрегация: <span className="text-emerald-400 font-medium">{activeConfig.aggregation}</span> • Топ {chartData.length} значений
                </p>
              </div>
              <div className="text-xs bg-slate-950 text-slate-400 px-3 py-1 rounded-full border border-slate-800">
                {activeConfig.type.toUpperCase()}
              </div>
            </div>

            <div className="w-full pt-2">{renderChart()}</div>
          </div>

          {/* Quick insights from chart */}
          {chartData.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-2xs text-slate-400">
              <div>
                Лидер:{' '}
                <strong className="text-slate-200 font-medium">
                  {String(chartData[0]?.[activeConfig.xAxisKey])} (
                  {Number(chartData[0]?.[activeConfig.yAxisKey]).toLocaleString()})
                </strong>
              </div>
              {chartData.length > 1 && (
                <div>
                  Мин. в топе:{' '}
                  <strong className="text-slate-200 font-medium">
                    {String(chartData[chartData.length - 1]?.[activeConfig.xAxisKey])} (
                    {Number(chartData[chartData.length - 1]?.[activeConfig.yAxisKey]).toLocaleString()})
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
