import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Home,
  Printer,
  LogOut,
  PackagePlus,
  Tags,
  Users,
} from 'lucide-react';

import { clearToken } from '../api/client';
import { ThemeToggle } from './ThemeToggle';
import { InstallAppButton } from './InstallAppButton';

const links = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/nova-etiqueta', label: 'Nova etiqueta', icon: Tags },
  { to: '/historico', label: 'Histórico', icon: ClipboardList },
  { to: '/gerenciar-etiquetas', label: 'Impressão', icon: Printer },
  { to: '/produtos', label: 'Produtos', icon: PackagePlus },
  { to: '/funcionarios', label: 'Funcionários', icon: Users },
];

export function Layout() {
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#f6fbfb] transition-colors dark:bg-[#151515]">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/60 bg-white/85 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-[#202020]/90 lg:block">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm dark:bg-white/5"
        >
          <img
            src="/safekitchen-logo.png"
            alt="SafeKitchen Smart"
            className="h-14 w-14 rounded-2xl object-contain"
          />

          <div>
            <p className="text-lg font-black text-safe-dark dark:text-white">
              SafeKitchen
            </p>

            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-safe-green">
              Smart
            </p>
          </div>
        </Link>

        <div className="mt-6 rounded-3xl bg-safe-gradient p-4 text-white shadow-app">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">
            Controle de qualidade
          </p>

          <p className="mt-2 text-xl font-black leading-tight">
            Sua cozinha livre da caneta.
          </p>

          <p className="mt-2 text-xs font-semibold text-white/75">
            Validade automática, etiquetas e histórico sanitário.
          </p>
        </div>

        <nav className="mt-8 space-y-2">
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    isActive
                      ? 'bg-safe-soft text-safe-blue shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  }`
                }
              >
                <Icon size={19} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <ThemeToggle />
            <InstallAppButton compact />
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-[#2b2b2b]"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <main className="pb-24 lg:ml-72 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/90 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#202020]/95 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/safekitchen-logo.png"
                alt="SafeKitchen Smart"
                className="h-10 w-10 rounded-xl object-contain"
              />

              <div>
                <p className="font-black text-safe-dark dark:text-white">
                  SafeKitchen
                </p>

                <p className="text-[10px] font-bold uppercase tracking-widest text-safe-green">
                  Smart
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <InstallAppButton compact />

              <button
                onClick={logout}
                className="rounded-xl bg-safe-dark px-3 py-2 text-xs font-bold text-white dark:bg-[#2b2b2b]"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t border-white/70 bg-white/95 px-2 py-2 shadow-[0_-12px_30px_rgba(7,59,76,.08)] backdrop-blur dark:border-white/10 dark:bg-[#202020]/95 lg:hidden">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold ${
                  isActive
                    ? 'bg-safe-soft text-safe-green'
                    : 'text-slate-500 dark:text-slate-300'
                }`
              }
            >
              <Icon size={19} />
              {item.label.split(' ')[0]}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default Layout;
