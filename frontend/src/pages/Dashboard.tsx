import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  History,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';

type DashboardLabel = {
  id: string;
  productName?: string;
  type?: string;
  labelType?: string;
  responsibleName?: string | null;
  expiresAt?: string | null;
};

type DashboardState = {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  noExpiration: number;
  recent: DashboardLabel[];
};

const emptyDashboard: DashboardState = {
  total: 0,
  active: 0,
  expired: 0,
  expiringSoon: 0,
  noExpiration: 0,
  recent: [],
};

function normalizeDashboardResponse(response: unknown): DashboardState {
  const data = response as any;

  return {
    total: Number(data?.total ?? data?.stats?.total ?? 0),
    active: Number(data?.active ?? data?.stats?.active ?? 0),
    expired: Number(data?.expired ?? data?.stats?.expired ?? 0),
    expiringSoon: Number(
      data?.expiringSoon ??
        data?.soon ??
        data?.stats?.expiringSoon ??
        data?.stats?.soon ??
        0
    ),
    noExpiration: Number(data?.noExpiration ?? data?.noExpiry ?? data?.stats?.noExpiry ?? 0),
    recent: Array.isArray(data?.recent)
      ? data.recent
      : Array.isArray(data?.recentLabels)
        ? data.recentLabels
        : [],
  };
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem validade';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sem validade';

  return date.toLocaleDateString('pt-BR');
}

function labelTypeName(type?: string) {
  const map: Record<string, string> = {
    PRODUTO_ABERTO: 'Produto aberto',
    PRODUCAO: 'Produção',
    DESCONGELAMENTO_DESSALGUE: 'Descongelamento/dessalgue',
    ARMAZENAMENTO_CARNES: 'Armazenamento de carnes',
    REEMBALAGEM: 'Reembalagem',
    AMOSTRAS: 'Amostras',
    NAO_CONFORME: 'Não conforme',
    PRODUTO_QUIMICO: 'Produto químico',
  };

  return map[type || ''] || type || 'Etiqueta';
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardState>(emptyDashboard);

  useEffect(() => {
    async function load() {
      try {
        const response = await api<unknown>('/api/labels/dashboard');
        setDashboard(normalizeDashboardResponse(response));
      } catch (error) {
        console.error(error);
        setDashboard(emptyDashboard);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'Etiquetas',
        value: dashboard.total,
        description: 'Total gerado',
        icon: ClipboardList,
        to: '/historico',
      },
      {
        label: 'Ativas',
        value: dashboard.active,
        description: 'Dentro da validade',
        icon: ShieldCheck,
        to: '/historico?status=VALIDAS',
      },
      {
        label: 'Vencidas',
        value: dashboard.expired,
        description: 'Clique para revisar',
        icon: AlertTriangle,
        to: '/historico?status=VENCIDAS',
      },
      {
        label: 'A vencer',
        value: dashboard.expiringSoon,
        description: 'Clique para revisar',
        icon: Clock3,
        to: '/historico?status=VENCENDO',
      },
    ],
    [dashboard]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020] md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.26em] text-safe-green">
              Dashboard
            </p>

            <h1 className="mt-2 text-3xl font-black leading-tight text-safe-dark dark:text-white md:text-4xl">
              Controle da operação
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
              Acompanhe a situação das etiquetas, validade dos produtos e últimos registros gerados pela equipe.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/nova-etiqueta"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
            >
              <Plus size={18} />
              Nova etiqueta
            </Link>

            <Link
              to="/historico"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-safe-dark transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <History size={18} />
              Ver histórico
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.label}
              to={card.to}
              className="block rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-app dark:border-white/10 dark:bg-[#202020]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-slate-400">
                    {card.label}
                  </p>

                  <p className="mt-3 text-4xl font-black text-safe-dark dark:text-white">
                    {loading ? '—' : card.value}
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-safe-soft text-safe-green dark:bg-white/10">
                  <Icon size={22} />
                </div>
              </div>

              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-300">
                {card.description}
              </p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020] md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.26em] text-safe-green">
              Operação
            </p>

            <h2 className="mt-1 text-2xl font-black text-safe-dark dark:text-white">
              Últimas etiquetas
            </h2>
          </div>

          <Link
            to="/nova-etiqueta"
            className="rounded-2xl bg-safe-green px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            Gerar nova
          </Link>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Carregando etiquetas...
            </div>
          ) : dashboard.recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Nenhuma etiqueta gerada até o momento.
            </div>
          ) : (
            dashboard.recent.map((label) => (
              <div
                key={label.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-lg font-extrabold text-safe-dark dark:text-white">
                    {label.productName || 'Produto'}
                  </p>

                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {labelTypeName(label.type || label.labelType)}
                    {label.responsibleName ? ` • Responsável: ${label.responsibleName}` : ''}
                  </p>
                </div>

                <div className="self-start rounded-full bg-white px-4 py-2 text-sm font-bold text-safe-dark shadow-sm dark:bg-[#151515] dark:text-white">
                  Validade: {formatDate(label.expiresAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;