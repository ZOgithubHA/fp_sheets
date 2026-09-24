import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, Copy, Check, RefreshCw, HelpCircle, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import Markdown from 'react-markdown';
import { Dataset, AiChatMessage } from '../types';

interface AiAnalystProps {
  dataset: Dataset;
}

const PRESET_PROMPTS = [
  {
    title: '🔍 Аудит дубликатов Доменных номеров',
    prompt: 'Проверь колонку «Идентификатор ПК» (доменный номер). Найди все дублирующиеся и повторяющиеся идентификаторы, перечисли их и укажи за какими сотрудниками и оборудованием они закреплены.',
    icon: AlertTriangle,
  },
  {
    title: '💻 Закрепление ноутбуков за сотрудниками',
    prompt: 'Сделай сводный отчет по всем выданным ноутбукам: список сотрудников, их должности, модель ноутбука, доменный номер (Идентификатор ПК) и статус движения.',
    icon: FileText,
  },
  {
    title: '📦 Инвентаризация по типам техники',
    prompt: 'Посчитай общее количество каждой категории техники (Ноутбуки, Мониторы, Мыши, Клавиатуры, Гарнитуры, Рюкзаки, USB Hub, Сетевые фильтры, Производственное оборудование) и укажи распределение по маркам.',
    icon: TrendingUp,
  },
  {
    title: '📋 Анализ возвратов и ремонтов (Сдал/Записи)',
    prompt: 'Проанализируй записи со статусом движения «Сдал» и примечания в колонке «Запись» (кто сдал, кому передано, что в ремонте или неисправно). Сделай краткую сводку.',
    icon: Sparkles,
  },
];

export const AiAnalyst: React.FC<AiAnalystProps> = ({ dataset }) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Здравствуйте! Я ваш персональный AI-аналитик данных на базе **Gemini 3.7 Flash**.\n\nЯ уже изучил структуру таблицы **«${dataset.title}»** (${dataset.totalRows} строк, ${dataset.columns.length} колонок).\n\nВы можете выбрать один из готовых сценариев анализа ниже или задать любой вопрос на естественном языке (например: *"Какая средняя выручка по городам?"*, *"Какие позиции самые прибыльные?"*, *"Сделай сводку для руководства"*).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Prepare dataset summary context
      const statsSummary: Record<string, any> = {};
      Object.entries(dataset.columnMeta).forEach(([col, meta]) => {
        statsSummary[col] = {
          type: meta.type,
          uniqueCount: meta.uniqueCount,
          nullCount: meta.nullCount,
          ...(meta.stats || {}),
        };
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          datasetSummary: {
            title: dataset.title,
            totalRows: dataset.totalRows,
            columns: dataset.columns,
            stats: statsSummary,
          },
          sampleRows: dataset.rows.slice(0, 15),
          language: 'Russian',
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Не удалось получить ответ от AI');
      }

      const aiMessage: AiChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.analysis || 'Анализ завершен, но ответ пуст.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Произошла ошибка при анализе данных: ${err.message || 'Ошибка связи с сервером'}. Попробуйте повторить запрос.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 p-5 rounded-2xl border border-emerald-800/40 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Интеллектуальный AI-аналитик данных
              <span className="text-2xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700">
                Gemini 3.7 Flash
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Глубокий анализ таблиц, корреляций, бизнес-инсайтов и мгновенные ответы на любые вопросы по данным
            </p>
          </div>
        </div>
      </div>

      {/* Preset Action Chips */}
      <div className="space-y-2">
        <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
          Быстрые сценарии анализа
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_PROMPTS.map((preset, idx) => {
            const Icon = preset.icon;
            return (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => handleSendMessage(preset.prompt)}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-700 text-left transition-all group disabled:opacity-50"
              >
                <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-emerald-950 text-emerald-400 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">
                    {preset.title}
                  </div>
                  <div className="text-2xs text-slate-400 mt-0.5 line-clamp-1">
                    {preset.prompt}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat History */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-4 min-h-[400px] max-h-[600px] overflow-y-auto shadow-inner">
        {messages.map((msg) => {
          const isAi = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isAi ? 'bg-slate-950/60 p-4 rounded-xl border border-slate-800/80' : 'pl-6'}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isAi ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-200">
                    {isAi ? 'Gemini Data Analyst' : 'Вы'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-slate-500">{msg.timestamp}</span>
                    {isAi && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="text-slate-400 hover:text-slate-200 p-1 transition-colors"
                        title="Копировать ответ"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-slate-300 leading-relaxed prose prose-invert max-w-none prose-p:my-2 prose-headings:text-slate-100 prose-strong:text-emerald-300 prose-ul:my-2 prose-li:my-0.5">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-emerald-400 text-xs animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Gemini анализирует распределения, метрики и генерирует отчет...</span>
          </div>
        )}
      </div>

      {/* Input Prompt Box */}
      <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={isLoading}
            placeholder="Задайте любой вопрос по таблице (например: 'Сравни эффективность категорий' или 'Где максимальный ROI?')..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isLoading || !inputPrompt.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Спросить</span>
          </button>
        </form>
      </div>

    </div>
  );
};
