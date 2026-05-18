import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeToggleProps = {
  compact?: boolean;
};

const STORAGE_KEY = 'safekitchen-theme';

function getInitialTheme(): Theme {
  const savedTheme = localStorage.getItem(STORAGE_KEY);

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return prefersDark ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.dataset.theme = 'dark';
  } else {
    root.classList.remove('dark');
    root.dataset.theme = 'light';
  }

  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const isDark = theme === 'dark';

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-safe-dark shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#2b2b2b] dark:text-white"
      >
        {isDark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#2b2b2b] dark:text-white"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    </button>
  );
}

export default ThemeToggle;
