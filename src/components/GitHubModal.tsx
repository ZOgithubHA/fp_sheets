import React, { useState, useEffect } from 'react';
import {
  X,
  Github,
  Key,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Check,
  RefreshCw,
  FolderGit2,
  Lock,
  Globe,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'auto' | 'zip' | 'cli'>('auto');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [repoName, setRepoName] = useState('fp_sheets');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; repoUrl?: string } | null>(null);
  const [isCopiedCommand, setIsCopiedCommand] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setResult({
        success: false,
        message: 'Пожалуйста, вставьте ваш GitHub Personal Access Token (PAT).',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          repoName: repoName.trim() || 'fp_sheets',
          isPrivate,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          success: true,
          message: data.message || 'Проект успешно загружен на ваш GitHub!',
          repoUrl: data.repoUrl,
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'Ошибка при отправке в GitHub.',
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: `Ошибка соединения: ${err.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cliCommands = `# 1. Перейдите в папку проекта (если скачали ZIP)
cd fp_sheets

# 2. Инициализируйте репозиторий и добавьте файлы
git init -b main
git add .
git commit -m "Initial commit: IT Asset Management & Telegram Bot"

# 3. Подключите ваш репозиторий на GitHub
git remote add origin https://github.com/ZOgithubHA/${repoName}.git

# 4. Отправьте код на GitHub
git push -u origin main`;

  const copyCliCommands = () => {
    navigator.clipboard.writeText(cliCommands);
    setIsCopiedCommand(true);
    setTimeout(() => setIsCopiedCommand(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white shadow-inner">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Экспорт проекта в GitHub</span>
                <span className="px-2 py-0.5 rounded-full text-2xs bg-emerald-950 text-emerald-300 border border-emerald-800">
                  @ZOgithubHA
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Загрузите репозиторий в ваш аккаунт GitHub, чтобы код был сохранен навсегда
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('auto')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'auto'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Авто-пуш в GitHub</span>
          </button>
          <button
            onClick={() => setActiveTab('zip')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'zip'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Скачать архив .ZIP</span>
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'cli'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Команды терминала</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'auto' && (
            <form onSubmit={handlePush} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Как работает отправка в GitHub:</span>
                </div>
                <p className="text-2xs text-slate-400 leading-relaxed">
                  Система автоматически создаст репозиторий <code className="text-emerald-300">ZOgithubHA/{repoName}</code> на вашем GitHub, инициализирует Git, сделает коммит всех файлов и отправит ветку <code className="text-emerald-300">main</code>. Токен используется только для запроса и <b>никогда не сохраняется</b> на сервере.
                </p>
              </div>

              {/* Repo Name input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-200 flex items-center justify-between">
                  <span>Имя репозитория на GitHub:</span>
                  <span className="text-2xs text-slate-400">будет создан в аккаунте @ZOgithubHA</span>
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-slate-800 border border-r-0 border-slate-700 rounded-l-xl text-xs text-slate-400 font-mono select-none">
                    https://github.com/ZOgithubHA/
                  </span>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    required
                    placeholder="fp_sheets"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-r-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Privacy option */}
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                  />
                  {isPrivate ? (
                    <span className="flex items-center gap-1 text-amber-300">
                      <Lock className="w-3.5 h-3.5" /> Сделать репозиторий приватным (Private)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" /> Публичный репозиторий (Public)
                    </span>
                  )}
                </label>
              </div>

              {/* Token input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>GitHub Personal Access Token (classic / fine-grained):</span>
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=AI+Studio+fp_sheets"
                    target="_blank"
                    rel="noreferrer"
                    className="text-2xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 hover:underline"
                  >
                    <span>Создать токен на GitHub (30 сек)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800"
                  >
                    {showToken ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                <p className="text-3xs text-slate-400">
                  Нужен токен с включенным разрешением <code className="text-amber-300 font-mono">repo</code> (полный контроль над репозиториями).
                </p>
              </div>

              {/* Result Notice */}
              {result && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 ${
                    result.success
                      ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className="font-medium">{result.message}</span>
                  </div>

                  {result.repoUrl && (
                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={result.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition-colors"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Открыть репозиторий на GitHub ↗</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !token.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-semibold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Создание репозитория и отправка файлов на GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4" />
                    <span>🚀 Запушить проект в GitHub: ZOgithubHA/{repoName}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Полный архив исходного кода проекта</span>
                </h4>
                <p className="text-2xs text-slate-400 leading-relaxed">
                  Архив включает в себя все файлы проекта: React-компоненты, Express-сервер, Telegram-бота, готовый Apps Script, конфигурационные шаблоны и Dockerfile. Исключены только временные файлы и папка <code>node_modules</code>.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col items-center justify-center text-center gap-3">
                <FolderGit2 className="w-12 h-12 text-emerald-400" />
                <div>
                  <div className="font-semibold text-sm text-slate-100">it-asset-management-source.zip</div>
                  <div className="text-2xs text-slate-400">Готов к загрузке в любой репозиторий или развертыванию на сервере</div>
                </div>
                <a
                  href="/api/project/download-zip"
                  download="it-asset-management-source.zip"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Скачать архив (.ZIP)</span>
                </a>
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Команды для выполнения в вашем терминале (Git Bash / PowerShell / Terminal):
                </span>
                <button
                  type="button"
                  onClick={copyCliCommands}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-2xs transition-colors"
                >
                  {isCopiedCommand ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Скопировать</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-2xs overflow-x-auto leading-relaxed select-all">
                {cliCommands}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-2xs text-slate-400">
          <a
            href="https://github.com/ZOgithubHA?tab=repositories"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-400 inline-flex items-center gap-1 transition-colors"
          >
            <span>Ваши репозитории на GitHub ↗</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
