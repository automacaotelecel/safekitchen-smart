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
  Download
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { clearToken } from '../api/client';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/nova-etiqueta', label: 'Nova etiqueta', icon: Tags },
  { to: '/historico', label: 'Histórico', icon: ClipboardList },
  { to: '/impressao', label: 'Impressão', icon: Printer },
  { to: '/produtos', label: 'Produtos', icon: PackagePlus },
  { to: '/funcionarios', label: 'Funcionários', icon: Users }
];

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
      <Link
        to="/"
        className={`flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm ${
          compact ? 'justify-center' : ''
        }`}
      >
        <img
            src="/safekitchen-logo.png"
            alt="SafeKitchen Smart"
            className="h-14 w-14 rounded-2xl object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
      />
        {!compact && (
          <div>
            <p className="text-xl font-black leading-none text-safe-dark">SafeKitchen</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.28em] text-safe-green">
              Smart
            </p>
          </div>
        )}
      </Link>

      {!compact && (
        <div className="mt-5 rounded-[26px] bg-gradient-to-br from-[#0e6673] to-[#29d1ad] p-5 text-white shadow-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
            
          </p>
          <p className="mt-3 text-lg font-extrabold leading-tight">
            Controle de qualidade
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-white/85">
            
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
                    : 'text-slate-600 hover:bg-slate-100'
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
          {compact ? (
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffbf00] text-safe-dark shadow-sm"
              title="Instalar aplicativo"
            >
              <Download size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffbf00] text-safe-dark shadow-sm"
              title="Instalar aplicativo"
            >
              <Download size={18} />
            </button>
          )}
        </div>

        <button
          onClick={logout}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-bold text-white shadow-lg ${
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
    <div className="min-h-screen bg-[#f4f8f8]">
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen ${desktopAsideWidth} border-r border-slate-200 bg-white/92 p-4 shadow-sm backdrop-blur-xl lg:flex lg:flex-col`}
      >
        <button
          type="button"
          onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
          className="absolute -right-3 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
          title={desktopSidebarCollapsed ? 'Expandir menu' : 'Ocultar menu'}
        >
          {desktopSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <SideMenuContent compact={desktopSidebarCollapsed} />
      </aside>

      {/* Mobile topbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
            <img
              src="/safekitchen-logo.png"
              alt="SafeKitchen Smart"
              className="h-14 w-14 rounded-2xl object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <p className="text-lg font-black text-safe-dark dark:text-white">SafeKitchen</p>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-safe-green">Smart</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-safe-dark shadow-sm"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[88%] max-w-[320px] flex-col bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-safe-green">
                Menu
              </p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <SideMenuContent />
          </div>
        </div>
      )}

      <main className={`pb-24 transition-all ${sidebarWidthClass} lg:pb-0`}>
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}