import { useEffect, useMemo, useState } from 'react';
import { Download, HelpCircle, Smartphone } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallAppButtonProps = {
  compact?: boolean;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton({ compact = false }: InstallAppButtonProps) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);

  useEffect(() => {
    setInstalled(isStandalone());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      setShowHelp(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;

    if (!installEvent) {
      setShowHelp((current) => !current);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }

    setInstallEvent(null);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={install}
        className={
          compact
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-safe-yellow text-safe-dark shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'
            : 'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-yellow px-4 py-3 text-sm font-black text-safe-dark shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'
        }
        title={installed ? 'Aplicativo já instalado' : 'Instalar aplicativo'}
        aria-label={installed ? 'Aplicativo já instalado' : 'Instalar aplicativo'}
      >
        {installed ? <Smartphone size={18} /> : installEvent ? <Download size={18} /> : <HelpCircle size={18} />}
        {!compact && (installed ? 'App instalado' : 'Instalar app')}
      </button>

      {showHelp && !installed && (
        <div className="absolute bottom-14 right-0 z-50 w-72 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-app dark:border-white/10 dark:bg-[#202020]">
          <p className="text-sm font-black text-safe-dark dark:text-white">Instalação manual</p>
          {isIOS ? (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
              No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.
            </p>
          ) : (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
              No Android/Chrome: abra o menu do navegador e toque em “Instalar app” ou “Adicionar à tela inicial”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default InstallAppButton;
