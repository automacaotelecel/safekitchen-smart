import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api, getToken } from '../api/client';
import { PlanCards } from '../components/PlanCards';
import type { CommercialPlan, PlanCode } from '../types';

export function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authenticated = Boolean(getToken());

  useEffect(() => {
    api<{ plans: CommercialPlan[] }>('/api/billing/plans')
      .then((data) => setPlans(data.plans))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar planos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f8f8] px-4 py-8 text-safe-dark sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to={authenticated ? '/' : '/login'} className="inline-flex items-center gap-2 text-sm font-black text-safe-green">
            <ArrowLeft size={17} /> Voltar
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <ShieldCheck size={18} className="text-safe-green" /> Pagamento seguro pelo Mercado Pago
          </div>
        </header>
        <section className="py-12 text-center">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-safe-green">Planos SafeKitchen</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Escolha o plano da sua operação</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">
            Escolha o kit ideal, pague a implantação e mantenha o sistema com uma mensalidade recorrente. Equipamentos adicionais podem ser incluídos sob orçamento.
          </p>
        </section>
        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center font-bold text-red-700">{error}</p>
        ) : loading ? (
          <p className="py-20 text-center font-bold text-slate-500">Carregando planos...</p>
        ) : (
          <PlanCards
            plans={plans}
            busyPlan={null}
            onSelect={() => navigate(authenticated ? '/assinatura' : '/login?register=1')}
            actionLabel={() => authenticated ? 'Contratar no sistema' : 'Começar teste grátis'}
          />
        )}
      </div>
    </main>
  );
}
