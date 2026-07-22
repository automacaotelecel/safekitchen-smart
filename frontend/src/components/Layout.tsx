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
  Sparkles,
  Thermometer,
  FolderClock,
  ClipboardCheck,
  UserCog,
  Bell,
  FileBarChart,
  CreditCard,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api, clearToken } from '../api/client';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/nova-etiqueta', label: 'Nova etiqueta', icon: Tags },
  { to: '/historico', label: 'Histórico', icon: ClipboardList },
  { to: '/impressao', label: 'Impressão', icon: Printer },
  { to: '/temperaturas', label: 'Temperaturas', icon: Thermometer },
  { to: '/documentos', label: 'Documentos', icon: FolderClock },
  { to: '/controles', label: 'Controles', icon: ClipboardCheck },
  { to: '/relatorios', label: 'Dossiê e relatórios', icon: FileBarChart },
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/ia', label: 'IA', icon: Sparkles },
  { to: '/produtos', label: 'Produtos', icon: PackagePlus },
  { to: '/funcionarios', label: 'Funcionários', icon: Users },
  { to: '/conta', label: 'Administração', icon: UserCog },
  { to: '/assinatura', label: 'Plano e assinatura', icon: CreditCard },
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

  useEffect(() => {
    let active = true;
    const loadUnread = () => {
      api<{ unread: number }>('/api/notifications/summary')
        .then((data) => active && setUnreadNotifications(data.unread))
        .catch(() => undefined);
    };
    loadUnread();
    const timer = window.setInterval(loadUnread, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const sidebarWidthClass = desktopSidebarCollapsed ? 'lg:ml-[92px]' : 'lg:ml-72';
  const desktopAsideWidth = desktopSidebarCollapsed ? 'w-[92px]' : 'w-72';

  const SideMenuContent = ({ compact = false }: { compact?: boolean }) => (
    <>
      <LogoBlock compact={compact} />

      <nav className="mt-5 space-y-2">
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
              {item.to === '/notificacoes' && unreadNotifications > 0 && (
                <span className={`${compact ? 'absolute translate-x-3 -translate-y-3' : 'ml-auto'} flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white`}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className={`mt-auto ${compact ? 'pt-4' : 'pt-8'}`}>
        {!compact && <ThemeToggle compact={false} />}

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
        className={`safe-scrollbar fixed left-0 top-0 z-40 hidden h-screen ${desktopAsideWidth} overflow-y-auto overscroll-contain border-r border-slate-200 bg-white/92 p-4 shadow-sm backdrop-blur-xl transition-all dark:border-white/10 dark:bg-[#071b1d] lg:flex lg:flex-col`}
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

          <div className="safe-scrollbar absolute inset-y-0 left-0 flex w-[88%] max-w-[320px] flex-col overflow-y-auto overscroll-contain bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-colors dark:bg-[#071b1d]">
            <div className="sticky top-0 z-10 mb-3 flex items-center justify-between bg-white pb-2 dark:bg-[#071b1d]">
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
