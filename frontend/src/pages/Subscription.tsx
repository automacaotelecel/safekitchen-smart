import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, RefreshCcw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { PlanCards } from '../components/PlanCards';
import type { CommercialPlan, PlanCode, SubscriptionInfo } from '../types';

type BillingState = {
  enabled: boolean;
  restaurant: {
    plan: string;
    subscriptionStatus: string;
    trialEndsAt?: string | null;
    subscriptionEndsAt?: string | null;
  } | null;
  subscription: SubscriptionInfo | null;
};

export function Subscription() {
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');

  async function load(sync = false) {
    setMessage('');
    try {
      if (sync) await api('/api/billing/sync', { method: 'POST' });
      const [planData, state] = await Promise.all([
        api<{ plans: CommercialPlan[] }>('/api/billing/plans'),
        api<BillingState>('/api/billing/subscription'),
      ]);
      setPlans(planData.plans);
      setBilling(state);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar assinatura.');
    }
  }

  useEffect(() => {
    load(searchParams.get('checkout') === 'retorno');
  }, []);

  async function selectPlan(plan: CommercialPlan) {
    setBusyPlan(plan.code);
    setMessage('');
    try {
      const active = billing?.subscription?.status === 'ACTIVE';
      if (active) {
        await api('/api/billing/change-plan', {
          method: 'POST',
          body: JSON.stringify({ planCode: plan.code }),
        });
        setMessage('Plano alterado com sucesso. O novo valor será usado nas próximas cobranças.');
        await load();
      } else {
        const data = await api<{ checkoutUrl: string }>('/api/billing/checkout', {
          method: 'POST',
          body: JSON.stringify({ planCode: plan.code }),
        });
        if (!data.checkoutUrl) throw new Error('Link de pagamento não recebido.');
        window.location.assign(data.checkoutUrl);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao contratar plano.');
    } finally {
      setBusyPlan(null);
    }
  }

  async function cancel() {
    if (!window.confirm('Cancelar a assinatura agora? O acesso pago será encerrado imediatamente.')) return;
    setBusyAction('cancel');
    try {
      await api('/api/billing/cancel', { method: 'POST' });
      setMessage('Assinatura cancelada.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao cancelar assinatura.');
    } finally {
      setBusyAction('');
    }
  }

  const status = billing?.restaurant?.subscriptionStatus || 'CARREGANDO';
  const trialExpired = Boolean(
    status === 'TRIALING' &&
      billing?.restaurant?.trialEndsAt &&
      new Date(billing.restaurant.trialEndsAt).getTime() < Date.now()
  );
  const graceExpired = Boolean(
    status === 'PAST_DUE' &&
      billing?.restaurant?.subscriptionEndsAt &&
      new Date(billing.restaurant.subscriptionEndsAt).getTime() < Date.now()
  );
  const expired =
    searchParams.get('expired') === '1' ||
    trialExpired ||
    graceExpired ||
    ['EXPIRED', 'CANCELED'].includes(status);
  const displayStatus = trialExpired ? 'TESTE ENCERRADO' : graceExpired ? 'PAGAMENTO PENDENTE' : status;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-safe-green">Plano e cobrança</p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">Sua assinatura</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Contratação e cobrança recorrente processadas pelo Mercado Pago.</p>
          </div>
          <button onClick={() => load(true)} disabled={busyAction === 'sync'} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black">
            <RefreshCcw size={17} /> Sincronizar pagamento
          </button>
        </div>

        {expired && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertTriangle className="shrink-0" />
            <div><p className="font-black">Seu teste ou assinatura terminou</p><p className="mt-1 text-sm">Escolha um plano abaixo para reativar imediatamente o sistema após a confirmação do pagamento.</p></div>
          </div>
        )}
        {!billing?.enabled && (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Configure MERCADO_PAGO_ACCESS_TOKEN no backend antes de iniciar cobranças.</div>
        )}
        {message && <div className="mt-5 rounded-2xl bg-safe-soft p-4 text-sm font-bold text-safe-dark">{message}</div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatusCard icon={status === 'ACTIVE' ? CheckCircle2 : XCircle} label="Status" value={displayStatus} />
          <StatusCard icon={CreditCard} label="Plano" value={billing?.restaurant?.plan || '—'} />
          <StatusCard icon={ExternalLink} label="Próxima cobrança" value={billing?.subscription?.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'} />
        </div>

        {billing?.subscription?.status === 'ACTIVE' && (
          <button onClick={cancel} disabled={busyAction === 'cancel'} className="mt-5 text-sm font-black text-red-600 hover:underline">Cancelar assinatura</button>
        )}
      </section>

      <PlanCards
        plans={plans}
        currentPlan={billing?.subscription?.status === 'ACTIVE' ? billing.restaurant?.plan : null}
        busyPlan={busyPlan}
        onSelect={selectPlan}
        actionLabel={() => billing?.subscription?.status === 'ACTIVE' ? 'Alterar para este plano' : 'Contratar com Mercado Pago'}
      />
    </div>
  );
}

function StatusCard({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) {
  return <div className="rounded-2xl bg-safe-soft p-4"><Icon size={20} className="text-safe-green" /><p className="mt-3 text-lg font-black">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p></div>;
}
