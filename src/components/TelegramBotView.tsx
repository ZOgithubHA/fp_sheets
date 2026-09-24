import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Camera,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Key,
  Play,
  Square,
  ShieldCheck,
  Laptop,
  Users,
  Search,
  PlusCircle,
  QrCode,
  Image as ImageIcon,
  HelpCircle,
  FileCode,
  Layers,
  Save
} from 'lucide-react';
import { Dataset } from '../types';

interface TelegramBotViewProps {
  dataset: Dataset;
  onUpdateRows: (newRows: Record<string, any>[]) => void;
  spreadsheetUrl: string;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  photoUrl?: string;
  inlineKeyboard?: { text: string; callback_data: string }[][];
  timestamp: string;
  isOcrProcessing?: boolean;
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  dataset,
  onUpdateRows,
  spreadsheetUrl,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'connect' | 'sheets_sync'>('simulator');
  
  // Real Bot Token Management
  const [botToken, setBotToken] = useState('8661379316:AAGtH3hBc964NlBMVFNnfiDYT5qpzO2BlJI');
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [botStatusMessage, setBotStatusMessage] = useState<string | null>(null);
  const [isStartingBot, setIsStartingBot] = useState(false);
  
  // OCR File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [appsScriptCode, setAppsScriptCode] = useState<string>('');

  // Google Apps Script Web App Instant Sync
  const [scriptAppUrl, setScriptAppUrl] = useState<string>('');
  const [isSavingScriptUrl, setIsSavingScriptUrl] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [scriptSyncStatus, setScriptSyncStatus] = useState<string | null>(null);

  // Sync inventory cache to backend on dataset change
  useEffect(() => {
    fetch('/api/telegram/sync-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: dataset.rows, columns: dataset.columns }),
    }).catch((e) => console.warn('Sync inventory error:', e));
  }, [dataset.rows, dataset.columns]);

  // Check live bot status
  useEffect(() => {
    fetch('/api/telegram/status')
      .then((res) => res.json())
      .then((data) => {
        setIsPollingActive(data.polling || false);
      })
      .catch((e) => console.warn('Status check error:', e));

    // Fetch Apps Script code
    fetch('/api/sheets/apps-script-code')
      .then((res) => res.json())
      .then((data) => {
        if (data.code) setAppsScriptCode(data.code);
      })
      .catch((e) => console.warn('Apps script code fetch error:', e));

    // Fetch configured Apps Script URL
    fetch('/api/sheets/script-url')
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setScriptAppUrl(data.url);
        if (data.configured) setScriptSyncStatus('🟢 Web App URL подключен. Мгновенная запись включена!');
      })
      .catch((e) => console.warn('Script URL fetch error:', e));
  }, []);

  // Initialize bot with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      handleSendSimulatedInput({ type: 'message', text: '/start' });
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendSimulatedInput = async (inputPayload: {
    type: 'message' | 'callback_query' | 'photo';
    text?: string;
    data?: string;
    photoBase64?: string;
  }) => {
    const timeNow = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // If user typed a message or clicked something visible, add it to chat history
    if (inputPayload.type === 'message' && inputPayload.text && inputPayload.text !== '/start') {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random()}`,
          sender: 'user',
          text: inputPayload.text || '',
          timestamp: timeNow,
        },
      ]);
    } else if (inputPayload.type === 'callback_query' && inputPayload.data) {
      // Find button text for friendly chat bubble
      let buttonLabel = inputPayload.data;
      if (inputPayload.data.startsWith('view_user:')) {
        buttonLabel = `👤 Сотрудник: ${decodeURIComponent(inputPayload.data.split(':')[1] || '')}`;
      } else if (inputPayload.data.startsWith('select_type:')) {
        buttonLabel = `📦 Выбран тип: ${decodeURIComponent(inputPayload.data.split(':')[1] || '')}`;
      } else if (inputPayload.data.startsWith('select_brand:')) {
        buttonLabel = `🏷️ Выбрана марка: ${decodeURIComponent(inputPayload.data.split(':')[1] || '')}`;
      } else if (inputPayload.data === 'start_add') {
        buttonLabel = '➕ Добавить технику';
      } else if (inputPayload.data.startsWith('list_users:')) {
        buttonLabel = '👥 Список сотрудников';
      } else if (inputPayload.data === 'save_confirmed_record') {
        buttonLabel = '✅ Подтвердить и Записать';
      } else if (inputPayload.data === 'search_prompt') {
        buttonLabel = '🔍 Поиск оборудования';
      } else if (inputPayload.data === 'stats_overview') {
        buttonLabel = '📊 Статистика склада';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `btn-${Date.now()}-${Math.random()}`,
          sender: 'user',
          text: buttonLabel,
          timestamp: timeNow,
        },
      ]);
    } else if (inputPayload.type === 'photo' && inputPayload.photoBase64) {
      setMessages((prev) => [
        ...prev,
        {
          id: `photo-${Date.now()}-${Math.random()}`,
          sender: 'user',
          text: '📸 Отправлено фото наклейки / штрихкода оборудования',
          photoUrl: inputPayload.photoBase64,
          timestamp: timeNow,
          isOcrProcessing: true,
        },
      ]);
    }

    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/telegram/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'sim_web_user',
          input: inputPayload,
        }),
      });

      const data = await response.json();

      if (data.updatedDataset && onUpdateRows) {
        onUpdateRows(data.updatedDataset);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}-${Math.random()}`,
          sender: 'bot',
          text: data.text || 'Ответ от бота получен.',
          inlineKeyboard: data.inlineKeyboard,
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ Ошибка взаимодействия с ботом: ${err.message}`,
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      handleSendSimulatedInput({
        type: 'photo',
        photoBase64: base64,
      });
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartLiveBot = async () => {
    if (!botToken.trim()) {
      setBotStatusMessage('Пожалуйста, введите токен бота от @BotFather.');
      return;
    }

    setIsStartingBot(true);
    setBotStatusMessage(null);

    try {
      const res = await fetch('/api/telegram/start-polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Не удалось запустить бота');
      }

      setIsPollingActive(true);
      setBotStatusMessage('🎉 Бот успешно запущен и слушает входящие сообщения в Telegram в реальном времени!');
    } catch (err: any) {
      setBotStatusMessage(`Ошибка запуска бота: ${err.message}`);
    } finally {
      setIsStartingBot(false);
    }
  };

  const handleStopLiveBot = async () => {
    try {
      await fetch('/api/telegram/stop-polling', { method: 'POST' });
      setIsPollingActive(false);
      setBotStatusMessage('Бот остановлен.');
    } catch (e: any) {
      setBotStatusMessage(`Ошибка: ${e.message}`);
    }
  };

  const handleCopyScript = () => {
    if (!appsScriptCode) return;
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleSaveScriptUrl = async () => {
    if (!scriptAppUrl.trim()) {
      setScriptSyncStatus('Введите корректный URL веб-приложения (заканчивающийся на /exec)');
      return;
    }
    setIsSavingScriptUrl(true);
    try {
      const res = await fetch('/api/sheets/script-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scriptAppUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScriptSyncStatus('🟢 Web App URL сохранен! Каждая выдача техники из бота будет мгновенно отправляться прямо в Google Таблицу.');
      } else {
        setScriptSyncStatus(`❌ Ошибка сохранения: ${data.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: any) {
      setScriptSyncStatus(`❌ Ошибка: ${err.message}`);
    } finally {
      setIsSavingScriptUrl(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!scriptAppUrl.trim()) {
      setScriptSyncStatus('Укажите URL веб-приложения для проверки связи.');
      return;
    }
    setIsTestingWebhook(true);
    setScriptSyncStatus('⚡ Отправка проверочного запроса (Ping) к Google Apps Script...');
    try {
      const res = await fetch('/api/sheets/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scriptAppUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScriptSyncStatus(`🟢 Проверка пройдена успешно! ${data.message}`);
      } else {
        setScriptSyncStatus(`🔴 Ошибка проверки связи: ${data.message || 'Скрипт недоступен. Убедитесь, что при развертывании выбран доступ «Все (Anyone)»'}`);
      }
    } catch (err: any) {
      setScriptSyncStatus(`🔴 Ошибка соединения: ${err.message}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handlePushAllToGoogleSheet = async () => {
    setScriptSyncStatus('⏳ Отправка всех данных в Google Таблицу...');
    try {
      const res = await fetch('/api/sheets/push-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allRows: dataset.rows }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setScriptSyncStatus(`✅ Успешно синхронизировано ${data.count || dataset.totalRows} строк в Google Таблицу!`);
      } else {
        setScriptSyncStatus(`❌ Ошибка синхронизации: ${data.message || data.error || 'Проверьте доступ скрипта'}`);
      }
    } catch (err: any) {
      setScriptSyncStatus(`❌ Ошибка: ${err.message}`);
    }
  };

  // Helper to render HTML from Telegram formatted messages
  const renderTelegramHtml = (html: string) => {
    // Basic sanitization and styling for HTML tags like <b>, <i>, <code>
    return (
      <div
        className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans break-words"
        dangerouslySetInnerHTML={{
          __html: html
            .replace(/<b>/g, '<strong class="font-semibold text-slate-100">')
            .replace(/<\/b>/g, '</strong>')
            .replace(/<i>/g, '<em class="text-slate-300 italic">')
            .replace(/<\/i>/g, '</em>')
            .replace(/<code>/g, '<code class="bg-slate-900/90 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-xs border border-slate-700/60">')
            .replace(/<\/code>/g, '</code>'),
        }}
      />
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Mode Selector */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Интеграция с Telegram Ботом
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                AI Vision + Google Sheets
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Управляйте таблицей оборудования через Telegram: просмотр сотрудников, добавление техники с автоподбором марки и сканером S/N по фото.
            </p>
          </div>
        </div>

        {/* Sub-tabs switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'simulator'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Веб-Симулятор Бота</span>
          </button>

          <button
            onClick={() => setActiveSubTab('connect')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'connect'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Подключение к Telegram</span>
          </button>

          <button
            onClick={() => setActiveSubTab('sheets_sync')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'sheets_sync'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Google Apps Script Sync</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: TELEGRAM BOT SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Telegram Smartphone Simulator */}
          <div className="lg:col-span-7 flex flex-col items-center">
            
            {/* Phone Mockup Frame */}
            <div className="w-full max-w-md bg-slate-900 rounded-[36px] border-4 border-slate-700/80 shadow-2xl overflow-hidden flex flex-col h-[650px] relative">
              
              {/* Phone Top Notch / Header */}
              <div className="bg-slate-800/95 border-b border-slate-700/60 px-4 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    🤖
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                      <span>IT Asset Manager Bot</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="text-[10px] text-slate-400">@ItAssetManagerBot • бот</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSendSimulatedInput({ type: 'message', text: '/start' })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 text-xs transition-colors"
                    title="Перезапустить бота (/start)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 scrollbar-thin scrollbar-thumb-slate-700">
                
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    {/* Photo attached if any */}
                    {msg.photoUrl && (
                      <div className="max-w-[85%] rounded-2xl overflow-hidden border border-slate-700 shadow-md">
                        <img
                          src={msg.photoUrl}
                          alt="Uploaded equipment"
                          className="w-full h-40 object-cover"
                        />
                        {msg.isOcrProcessing && (
                          <div className="p-2 bg-slate-900/90 text-[10px] text-emerald-400 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 animate-spin" />
                            <span>Gemini Vision считывает S/N со стикера...</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Bubble */}
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-xs ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-slate-800/90 border border-slate-700/70 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.sender === 'bot' ? renderTelegramHtml(msg.text) : <span>{msg.text}</span>}
                      
                      <div
                        className={`text-[9px] mt-1 text-right ${
                          msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Inline Keyboard Buttons */}
                    {msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                      <div className="w-full max-w-[88%] space-y-1.5 pt-1">
                        {msg.inlineKeyboard.map((row, rIdx) => (
                          <div key={rIdx} className="grid grid-cols-1 gap-1.5">
                            {row.map((btn, bIdx) => (
                              <button
                                key={bIdx}
                                onClick={() => handleSendSimulatedInput({ type: 'callback_query', data: btn.callback_data })}
                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-sky-300 border border-slate-700/80 transition-all flex items-center justify-between group shadow-sm hover:border-sky-500/50"
                              >
                                <span className="truncate">{btn.text}</span>
                                <span className="text-slate-500 group-hover:text-sky-300 transition-colors text-[10px]">
                                  ›
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Bot Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 w-24">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Message Input Bar */}
              <div className="bg-slate-800/95 border-t border-slate-700/60 p-2.5 flex items-center gap-2">
                {/* Hidden File Input for Camera / Photo */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelected}
                  className="hidden"
                  id="telegram-ocr-upload"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition-colors shrink-0"
                  title="Отправить фото накладной, счета-фактуры или стикера с S/N (OCR Gemini Vision)"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputText.trim()) {
                      handleSendSimulatedInput({ type: 'message', text: inputText });
                    }
                  }}
                  placeholder="Сообщение, число или S/N..."
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />

                <button
                  onClick={() => {
                    if (inputText.trim()) {
                      handleSendSimulatedInput({ type: 'message', text: inputText });
                    }
                  }}
                  disabled={!inputText.trim()}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Right Column: Instructions & Feature Highlights */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Feature 1: Employees Preview */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs sm:text-sm">
                <Users className="w-4 h-4" />
                <span>1. Читаемый preview столбца «Имя пользователя»</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Нажмите в симуляторе кнопку <b>«👥 Сотрудники»</b>. Выберите любого человека из списка — бот сформирует структурированную карточку со всей техникой:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 space-y-1">
                <div>• Идентификатор ПК (Доменный ID)</div>
                <div>• ТИП (Ноутбук, Монитор, Мышь...)</div>
                <div>• МАРКА (HP G250 i5 8gb, Lenovo...)</div>
                <div>• S/N (Серийный номер)</div>
                <div>• Движения (Принял / Сдал / Новый)</div>
              </div>
            </div>

            {/* Feature 2: Smart Brand suggestions & Photo OCR */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4" />
                <span>2. Распознавание Счетов-фактур и Накладных по фото (Gemini Vision)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Отправьте в бота фото <b>счета-фактуры</b>, <b>товарной накладной</b> или <b>спецификации</b>:
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                <li>
                  Нейросеть мгновенно извлекает: <b>№ документа</b>, <b>дату</b>, <b>поставщика</b>, <b>категорию техники</b>, <b>марку</b> и <b>количество штук</b>.
                </li>
                <li>
                  Бот формирует интерактивную карточку с кнопками: <code>✏️ Изменить кол-во</code>, <code>✏️ Марку</code>, <code>✏️ Категорию</code>, <code>✏️ Основание</code>.
                </li>
                <li>
                  После нажатия <b>«✅ Подтвердить и оприходовать»</b> техника моментально заносится на баланс склада и отправляется в Google Таблицу!
                </li>
              </ul>
            </div>

            {/* Feature 3: Live CRUD & Warehouse Balance */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>3. Складской баланс и выдача техники</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                При выдаче со склада сотруднику количество автоматически списывается (<b>минусуется</b>), а при возврате сотрудником техники — автоматически приходуется обратно на склад (<b>плюсуется</b>). Никакого беспорядка!
              </p>
            </div>

            {/* Test Image Quick Buttons */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Быстрый тест OCR сканера S/N:</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Загрузите любое фото со стикером ноутбука или штрихкодом через кнопку камеры в симуляторе слева.
              </p>
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB 2: CONNECT REAL TELEGRAM BOT */}
      {activeSubTab === 'connect' && (
        <div className="max-w-3xl mx-auto space-y-6">
          
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Подключение вашего Telegram Бота (Токен от @BotFather)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Вы можете запустить настоящего бота в Telegram, который будет отвечать вам и вашей команде прямо с вашего смартфона.
                </p>
              </div>
            </div>

            {/* Status Alert */}
            {isPollingActive ? (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
                  <div>
                    <span className="font-semibold text-emerald-300 block">
                      🟢 Telegram Бот @fp_sheets_bot активен и принимает сообщения в реальном времени!
                    </span>
                    <span className="text-[11px] text-emerald-400/80">
                      Вы можете отправить <b>/start</b> или фото стикера ноутбука прямо в Telegram.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://t.me/fp_sheets_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Открыть @fp_sheets_bot</span>
                  </a>
                  <button
                    onClick={handleStopLiveBot}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Остановить</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Бот в данный момент не запущен. Нажмите кнопку ниже для старта.</span>
                </div>
                <a
                  href="https://t.me/fp_sheets_bot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>@fp_sheets_bot</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {botStatusMessage && (
              <div className="p-3.5 rounded-xl bg-blue-950/70 border border-blue-800/80 text-blue-200 text-xs">
                {botStatusMessage}
              </div>
            )}

            {/* Token Input Form */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Токен Telegram Бота (Bot API Token):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  onClick={handleStartLiveBot}
                  disabled={isStartingBot || !botToken.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs transition-colors flex items-center gap-2 shrink-0 shadow-md"
                >
                  {isStartingBot ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Запуск...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Запустить бота</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-step guide to get token */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                <span>Как получить токен за 1 минуту:</span>
              </div>
              <ol className="text-xs text-slate-400 space-y-2 list-decimal pl-4">
                <li>
                  Откройте Telegram и найдите официального бота <b>@BotFather</b>.
                </li>
                <li>
                  Отправьте ему команду <code className="text-sky-300 font-mono">/newbot</code>.
                </li>
                <li>
                  Укажите имя для вашего бота (например, <i>«Учет Техники Склад»</i>) и уникальный username (например, <i>«my_it_asset_bot»</i>).
                </li>
                <li>
                  Скопируйте полученный <b>HTTP API Token</b> и вставьте его в поле выше.
                </li>
                <li>
                  Нажмите <b>«Запустить бота»</b>. Теперь откройте вашего бота в Telegram и напишите ему <b>/start</b>!
                </li>
              </ol>
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB 3: GOOGLE APPS SCRIPT SYNC */}
      {activeSubTab === 'sheets_sync' && (
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Моментальная запись в Google Таблицу (Двусторонняя Синхронизация)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Подключенная таблица:{' '}
                    <a
                      href={spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline font-mono"
                    >
                      {spreadsheetUrl}
                    </a>
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyScript}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center gap-2 shrink-0 shadow-md"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Скрипт скопирован!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Скопировать скрипт</span>
                  </>
                )}
              </button>
            </div>

            {/* Instruction Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <div className="font-semibold text-xs text-slate-200">1. Открыть Apps Script</div>
                <p className="text-[11px] text-slate-400">
                  В вашей Google Таблице перейдите в меню: <b>Расширения (Extensions) → Apps Script</b>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <div className="font-semibold text-xs text-slate-200">2. Вставить код & Сохранить</div>
                <p className="text-[11px] text-slate-400">
                  Замените весь код на скопированный скрипт ниже и нажмите Сохранить (Ctrl+S).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <div className="font-semibold text-xs text-slate-200">3. Развернуть Веб-приложение</div>
                <p className="text-[11px] text-slate-400">
                  Кнопку «Выполнить» жать <b>не нужно</b>. Вверху справа нажмите синюю кнопку <b>Развернуть → Новое развертывание → Веб-приложение</b> (Доступ: Все). Вставьте ссылку ниже.
                </p>
              </div>
            </div>

            {/* Google Apps Script Web App URL input */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>URL Веб-приложения Google Apps Script (Web App URL):</span>
                </label>
                <span className="text-[10px] text-slate-400">Заканчивается на /exec</span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  value={scriptAppUrl}
                  onChange={(e) => setScriptAppUrl(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !scriptAppUrl.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-40"
                  title="Проверить, отвечает ли Google Apps Script"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                  <span>{isTestingWebhook ? 'Проверка...' : '⚡ Проверить связь'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveScriptUrl}
                  disabled={isSavingScriptUrl}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingScriptUrl ? 'Сохранение...' : 'Сохранить Web App URL'}</span>
                </button>
              </div>

              {scriptSyncStatus && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="leading-snug">{scriptSyncStatus}</span>
                  <button
                    type="button"
                    onClick={handlePushAllToGoogleSheet}
                    className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-medium shrink-0"
                  >
                    📤 Выгрузить все данные в Google Таблицу ({dataset.totalRows} строк)
                  </button>
                </div>
              )}
            </div>

            {/* Code Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Готовый исходный код Apps Script:</span>
                <span className="text-[10px] font-mono text-emerald-400">JavaScript / Apps Script (Двусторонний)</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 scrollbar-thin scrollbar-thumb-slate-700">
                {appsScriptCode || '// Загрузка скрипта...'}
              </pre>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
