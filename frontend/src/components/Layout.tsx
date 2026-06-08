import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Home,
  LogOut,
  PackagePlus,
  Printer,
  Tags,
  Users,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { clearToken } from '../api/client';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/nova-etiqueta', label: 'Nova etiqueta', icon: Tags },
  { to: '/historico', label: 'Histórico', icon: ClipboardList },
  { to: '/impressao', label: 'Impressão', icon: Printer },
  { to: '/ia', label: 'IA', icon: Sparkles },
  { to: '/produtos', label: 'Produtos', icon: PackagePlus },
  { to: '/funcionarios', label: 'Funcionários', icon: Users },
];

function LogoImage({ compact = false }: { compact?: boolean }) {
  const logoCandidates = [
    '/safekitchen-logo.png',
    '/logo.png',
    '/logo2.png',
    '/SKS.png',
    '/sks.png',
  ];

  const [logoIndex, setLogoIndex] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  const currentLogo = logoCandidates[logoIndex];

  if (logoFailed) {
    return (
      <div
        className={
          compact
            ? 'flex h-11 w-11 items-center justify-center rounded-2xl bg-safe-soft text-xs font-black text-safe-green'
            : 'flex h-14 w-14 items-center justify-center rounded-2xl bg-safe-soft text-sm font-black text-safe-green'
        }
      >
        SKS
      </div>
    );
  }

  return (
    <img
      src={currentLogo}
      alt="SafeKitchen Smart"
      className={
        compact
          ? 'h-11 w-11 rounded-2xl object-contain'
          : 'h-14 w-14 rounded-2xl object-contain'
      }
      onError={() => {
        const nextIndex = logoIndex + 1;

        if (nextIndex < logoCandidates.length) {
          setLogoIndex(nextIndex);
        } else {
          setLogoFailed(true);
        }
      }}
    />
  );
}

function LogoBlock({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition dark:border-slate-200 dark:bg-white ${
        compact ? 'justify-center' : ''
      }`}
    >
      <LogoImage compact={compact} />

      {!compact && (
        <div>
          <p className="text-xl font-black leading-none text-safe-dark">
            SafeKitchen
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.28em] text-safe-green">
            Smart
          </p>
        </div>
      )}
    </Link>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  function logout() {
    clearToken();
    navigate('/login');
  }

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidthClass = desktopSidebarCollapsed ? 'lg:ml-[92px]' : 'lg:ml-72';
  const desktopAsideWidth = desktopSidebarCollapsed ? 'w-[92px]' : 'w-72';

  const SideMenuContent = ({ compact = false }: { compact?: boolean }) => (
    <>
      <LogoBlock compact={compact} />

      {!compact && (
        <div className="mt-5 rounded-[26px] bg-gradient-to-br from-[#0e6673] to-[#29d1ad] p-5 text-white shadow-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
            Controle de qualidade
          </p>

          <p className="mt-3 text-sm font-semibold leading-6 text-white/90">
            Etiquetas, validade e histórico organizados para a rotina da cozinha.
          </p>
        </div>
      )}

      <nav className="mt-6 space-y-2">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  isActive
                    ? 'bg-safe-soft text-safe-blue shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10'
                } ${compact ? 'justify-center px-2' : ''}`
              }
              title={compact ? item.label : undefined}
            >
              <Icon size={19} />
              {!compact && item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className={`mt-auto ${compact ? 'pt-4' : 'pt-8'}`}>
        <div className={`flex items-center gap-3 ${compact ? 'justify-center' : ''}`}>
          {!compact && <ThemeToggle compact={false} />}

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffbf00] text-safe-dark shadow-sm transition hover:brightness-95"
            title="Instalar aplicativo"
          >
            <Download size={18} />
          </button>
        </div>

        <button
          onClick={logout}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 dark:bg-safe-dark ${
            compact ? 'px-0' : ''
          }`}
          title={compact ? 'Sair' : undefined}
        >
          <LogOut size={18} />
          {!compact && 'Sair'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f8f8] text-safe-dark transition-colors dark:bg-[#071b1d]">
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen ${desktopAsideWidth} border-r border-slate-200 bg-white/92 p-4 shadow-sm backdrop-blur-xl transition-all dark:border-white/10 dark:bg-[#071b1d] lg:flex lg:flex-col`}
      >
        <button
          type="button"
          onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
          className="absolute -right-3 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          title={desktopSidebarCollapsed ? 'Expandir menu' : 'Ocultar menu'}
        >
          {desktopSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <SideMenuContent compact={desktopSidebarCollapsed} />
      </aside>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur transition-colors dark:border-white/10 dark:bg-[#071b1d] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <LogoBlock />

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-safe-dark shadow-sm transition hover:bg-slate-50"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="absolute left-0 top-0 flex h-full w-[88%] max-w-[320px] flex-col bg-white p-4 shadow-2xl transition-colors dark:bg-[#071b1d]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-safe-green">
                Menu
              </p>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-safe-dark transition hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            <SideMenuContent />
          </div>
        </div>
      )}

      <main className={`min-h-screen pb-24 transition-all ${sidebarWidthClass} lg:pb-0`}>
        <div className="app-content p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}