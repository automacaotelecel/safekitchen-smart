import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  Clock3,
  FileClock,
  History,
  Plus,
  ShieldCheck,
  Tags,
  Thermometer,
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
    noExpiration: Number(
      data?.noExpiration ??
        data?.noExpiry ??
        data?.stats?.noExpiry ??
        0
    ),
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
  const names: Record<string, string> = {
    PRODUTO_ABERTO: 'Produto aberto',
    PRODUCAO: 'Produção',
    DESCONGELAMENTO_DESSALGUE: 'Descongelamento',
    ARMAZENAMENTO_CARNES: 'Armazenamento',
    REEMBALAGEM: 'Reembalagem',
    AMOSTRAS: 'Amostras',
    NAO_CONFORME: 'Não conforme',
    PRODUTO_QUIMICO: 'Produto químico',
  };
  return names[type || ''] || type || 'Etiqueta';
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] =
    useState<DashboardState>(emptyDashboard);

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
    void load();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'Etiquetas',
        value: dashboard.total,
        description: 'Total gerado',
        icon: ClipboardList,
        to: '/historico',
        tone: 'default',
      },
      {
        label: 'Ativas',
        value: dashboard.active,
        description: 'Dentro da validade',
        icon: ShieldCheck,
        to: '/historico?status=VALIDAS',
        tone: 'success',
      },
      {
        label: 'Vencidas',
        value: dashboard.expired,
        description: 'Precisam de revisão',
        icon: AlertTriangle,
        to: '/historico?status=VENCIDAS',
        tone: 'danger',
      },
      {
        label: 'A vencer',
        value: dashboard.expiringSoon,
        description: 'Próximos vencimentos',
        icon: Clock3,
        to: '/historico?status=VENCENDO',
        tone: 'warning',
      },
    ],
    [dashboard]
  );

  const quickActions = [
    {
      title: 'Nova etiqueta',
      description: 'Gerar e imprimir',
      icon: Tags,
      to: '/nova-etiqueta',
    },
    {
      title: 'Temperaturas',
      description: 'Registrar medição',
      icon: Thermometer,
      to: '/temperaturas',
    },
    {
      title: 'Produtos',
      description: 'Consultar cadastro',
      icon: Boxes,
      to: '/produtos',
    },
    {
      title: 'Documentos',
      description: 'Ver vencimentos',
      icon: FileClock,
      to: '/documentos',
    },
  ];

  return (
    <div className="min-w-0 space-y-4 pb-4 sm:space-y-5">
      <section className="overflow-hidden rounded-[22px] bg-[#073b4c] p-4 text-white shadow-sm sm:rounded-[28px] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#50e4be] sm:text-xs">
              Visão da operação
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">
              Tudo sob controle
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/62 sm:text-base">
              Acompanhe validades e acesse as tarefas mais importantes da sua
              cozinha.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              to="/nova-etiqueta"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19d09c] px-3 py-3 text-xs font-black text-[#052d38] sm:rounded-2xl sm:px-5 sm:text-sm"
            >
              <Plus size={17} />
              Nova etiqueta
            </Link>
            <Link
              to="/historico"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/7 px-3 py-3 text-xs font-black text-white sm:rounded-2xl sm:px-5 sm:text-sm"
            >
              <History size={17} />
              Histórico
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const tone =
            card.tone === 'danger'
              ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
              : card.tone === 'warning'
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
                : card.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-safe-soft text-safe-green dark:bg-white/10';

          return (
            <Link
              key={card.label}
              to={card.to}
              className="min-w-0 rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm transition active:scale-[.98] dark:border-white/10 dark:bg-[#202020] sm:rounded-[24px] sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-app"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-black text-safe-dark dark:text-white sm:mt-3 sm:text-4xl">
                    {loading ? '—' : card.value}
                  </p>
                </div>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl ${tone}`}
                >
                  <Icon size={19} />
                </div>
              </div>
              <p className="mt-2 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-300 sm:mt-4 sm:text-sm">
                {card.description}
              </p>
            </Link>
          );
        })}
      </section>

      {(dashboard.expired > 0 || dashboard.expiringSoon > 0) && !loading && (
        <section className="flex items-start gap-3 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:rounded-[22px]">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
          <div className="min-w-0">
            <p className="font-black">Atenção às validades</p>
            <p className="mt-1 text-sm font-medium leading-5">
              {dashboard.expired} vencida(s) e {dashboard.expiringSoon} próxima(s)
              do vencimento.
            </p>
            <Link
              to="/historico?status=VENCENDO"
              className="mt-3 inline-flex items-center gap-1 text-xs font-black text-amber-800"
            >
              Revisar agora <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-safe-green sm:text-xs">
              Acesso rápido
            </p>
            <h2 className="mt-1 text-xl font-black text-safe-dark dark:text-white sm:text-2xl">
              O que você precisa fazer?
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {quickActions.map(({ title, description, icon: Icon, to }) => (
            <Link
              key={title}
              to={to}
              className="group min-w-0 rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm transition active:scale-[.98] dark:border-white/10 dark:bg-[#202020] sm:rounded-[22px] sm:p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-safe-soft text-safe-green dark:bg-white/10">
                <Icon size={19} />
              </div>
              <p className="mt-3 truncate text-sm font-black text-safe-dark dark:text-white sm:text-base">
                {title}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-300 sm:text-sm">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#202020] sm:rounded-[28px] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-safe-green sm:text-xs">
              Atividade recente
            </p>
            <h2 className="mt-1 truncate text-xl font-black text-safe-dark dark:text-white sm:text-2xl">
              Últimas etiquetas
            </h2>
          </div>
          <Link
            to="/historico"
            className="shrink-0 text-xs font-black text-safe-green sm:text-sm"
          >
            Ver todas
          </Link>
        </div>

        <div className="space-y-2.5">
          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Carregando etiquetas...
            </div>
          ) : dashboard.recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-white/10 dark:bg-white/5">
              <ClipboardList className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-300">
                Nenhuma etiqueta gerada.
              </p>
              <Link
                to="/nova-etiqueta"
                className="mt-3 inline-flex items-center gap-1 text-xs font-black text-safe-green"
              >
                Gerar a primeira <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            dashboard.recent.slice(0, 6).map((label) => (
              <div
                key={label.id}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5 sm:p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-safe-green shadow-sm dark:bg-[#151515]">
                  <Tags size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-safe-dark dark:text-white sm:text-base">
                    {label.productName || 'Produto'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-300 sm:text-sm">
                    {labelTypeName(label.type || label.labelType)}
                    {label.responsibleName
                      ? ` · ${label.responsibleName}`
                      : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Validade
                  </p>
                  <p className="mt-1 text-[11px] font-black text-safe-dark dark:text-white sm:text-sm">
                    {formatDate(label.expiresAt)}
                  </p>
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
