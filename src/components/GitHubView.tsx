import React, { useState, useEffect } from 'react';
import {
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
  FileCode,
  Server,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

interface GitHubViewProps {
  onOpenModal?: () => void;
}

export const GitHubView: React.FC<GitHubViewProps> = () => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [repoName, setRepoName] = useState('fp_sheets');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; repoUrl?: string } | null>(null);
  const [isCopiedCommand, setIsCopiedCommand] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
  }, []);

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
        fetchStatus();
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

# 2. Инициализируйте репозиторий и добавьте все файлы
git init -b main
git add .
git commit -m "Initial commit: IT Asset Management & Telegram Bot"

# 3. Подключите ваш GitHub репозиторий
git remote add origin https://github.com/ZOgithubHA/${repoName}.git

# 4. Отправьте код на GitHub
git push -u origin main`;

  const copyCliCommands = () => {
    navigator.clipboard.writeText(cliCommands);
    setIsCopiedCommand(true);
    setTimeout(() => setIsCopiedCommand(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="github-sync-view">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-800 border border-slate-750 rounded-2xl text-white shadow-inner shrink-0">
            <Github className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-slate-100">
                Экспорт и постоянное хранение в GitHub
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300">
                @ZOgithubHA
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                Ветка: main
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Чтобы ваш проект, Telegram-бот, скрипты синхронизации с Google Таблицами и база данных были 
              навсегда сохранены и не зависели от временной сессии AI Studio, сохраните репозиторий в ваш аккаунт GitHub.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <a
            href="https://github.com/ZOgithubHA?tab=repositories"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <span>Ваш профиль GitHub ↗</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href="/api/project/download-zip"
            download="it-asset-management-source.zip"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-800/80 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Скачать весь проект (.ZIP)</span>
          </a>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: 1-Click Push Form */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">
                Автоматическая отправка в GitHub в 1 клик
              </h3>
            </div>
            <span className="text-2xs text-slate-400">REST API + Git Push</span>
          </div>

          <form onSubmit={handlePush} className="space-y-4">
            {/* Info notice */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Автоматическое создание репозитория:</span>
              </div>
              <p className="text-2xs text-slate-400 leading-relaxed">
                Если репозитория с таким именем еще нет на вашем GitHub, система <b>сама создаст его</b> через GitHub API, инициализирует ветку <code className="text-emerald-300">main</code>, добавит все исходные файлы и сделает коммит.
              </p>
            </div>

            {/* Repo Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Имя репозитория:</span>
                <span className="text-2xs text-slate-400">будет создан по адресу:</span>
              </label>
              <div className="flex items-center">
                <span className="px-3.5 py-2.5 bg-slate-800 border border-r-0 border-slate-700 rounded-l-xl text-xs text-slate-400 font-mono select-none">
                  https://github.com/ZOgithubHA/
                </span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  required
                  placeholder="fp_sheets"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-r-xl px-3.5 py-2.5 text-xs font-mono text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Privacy option */}
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                {isPrivate ? (
                  <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                    <Lock className="w-3.5 h-3.5" /> Приватный репозиторий (Private — виден только вам)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" /> Публичный репозиторий (Public)
                  </span>
                )}
              </label>
            </div>

            {/* Token input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>GitHub Personal Access Token (PAT):</span>
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=AI+Studio+fp_sheets"
                  target="_blank"
                  rel="noreferrer"
                  className="text-2xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 hover:underline"
                >
                  <span>Создать токен на GitHub (30 сек) ↗</span>
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800"
                >
                  {showToken ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              
              <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/60 text-amber-300 text-3xs leading-relaxed">
                💡 <b>Инструкция по токену:</b> Перейдите по ссылке выше, укажите название (любое) и убедитесь, что включена галочка <b>repo</b>. Нажмите «Generate token» внизу страницы и вставьте полученный ключ сюда.
              </div>
            </div>

            {/* Result Notice */}
            {result && (
              <div
                className={`p-4 rounded-xl border text-xs flex flex-col gap-2.5 shadow ${
                  result.success
                    ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/90 border-rose-800 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span className="font-semibold text-sm">{result.message}</span>
                </div>

                {result.repoUrl && (
                  <div className="pt-2 flex items-center gap-3">
                    <a
                      href={result.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      <span>Перейти в созданный репозиторий на GitHub ↗</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !token.trim()}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
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
        </div>

        {/* Right Column: ZIP Download & CLI instructions */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* ZIP Card */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Download className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">Скачать полный архив (.ZIP)</h3>
            </div>
            
            <p className="text-2xs text-slate-400 leading-relaxed">
              Если хотите сохранить копию на свой компьютер, загрузить в другой сервис или запустить локально:
            </p>

            <a
              href="/api/project/download-zip"
              download="it-asset-management-source.zip"
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Скачать it-asset-management-source.zip</span>
            </a>
          </div>

          {/* Terminal Instructions */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-xs text-slate-200">Команды для терминала:</h4>
              </div>
              <button
                type="button"
                onClick={copyCliCommands}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-2xs transition-colors"
              >
                {isCopiedCommand ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-3xs overflow-x-auto leading-relaxed select-all">
              {cliCommands}
            </pre>
          </div>

          {/* Project Structure Highlights */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-md space-y-3 text-2xs text-slate-400">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Что входит в репозиторий:</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside">
              <li><b className="text-slate-300">src/</b> — Весь интерфейс учета оборудования, склада и аналитики</li>
              <li><b className="text-slate-300">server/</b> — Express бэкенд и движок Telegram-бота 24/7</li>
              <li><b className="text-slate-300">google-apps-script.js</b> — Готовый скрипт Google Apps Script для таблиц</li>
              <li><b className="text-slate-300">Dockerfile & docker-compose.yml</b> — Мгновенный запуск в облаке (VPS/Render/Railway)</li>
              <li><b className="text-slate-300">README.md</b> — Подробная документация на русском языке</li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
};
