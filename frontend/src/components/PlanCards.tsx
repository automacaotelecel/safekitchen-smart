import { Check, PackageCheck, Sparkles, Zap } from 'lucide-react';

import type { CommercialPlan, PlanCode } from '../types';

const icons = { START: Zap, PRO: Sparkles };

export function PlanCards({
  plans,
  currentPlan,
  busyPlan,
  onSelect,
  actionLabel,
}: {
  plans: CommercialPlan[];
  currentPlan?: string | null;
  busyPlan?: PlanCode | null;
  onSelect: (plan: CommercialPlan) => void;
  actionLabel: (plan: CommercialPlan) => string;
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      {plans.map((plan) => {
        const Icon = icons[plan.code];
        const selected = currentPlan === plan.code;
        return (
          <article
            key={plan.code}
            className={`relative flex flex-col rounded-[28px] border bg-white p-6 shadow-sm ${
              plan.highlighted
                ? 'border-safe-green ring-4 ring-safe-green/10'
                : 'border-slate-200'
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-6 rounded-full bg-safe-green px-4 py-1 text-xs font-black uppercase tracking-wider text-white">
                Mais escolhido
              </span>
            )}
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-safe-soft text-safe-green">
                <Icon size={23} />
              </div>
              {selected && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                  Plano atual
                </span>
              )}
            </div>
            <h2 className="mt-5 text-2xl font-black text-safe-dark">{plan.name}</h2>
            <p className="mt-1 text-xs font-black uppercase tracking-wider text-safe-green">{plan.audience}</p>
            <p className="mt-2 min-h-12 text-sm font-medium leading-6 text-slate-500">
              {plan.description}
            </p>
            <div className="mt-5 rounded-2xl bg-safe-soft p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Kit de implantação</p>
              <p className="mt-1 text-3xl font-black text-safe-dark">
                {(plan.setupAmountCents / 100).toLocaleString('pt-BR', {
                  style: 'currency', currency: plan.currency,
                })}
              </p>
            </div>
            <p className="mt-4 text-4xl font-black text-safe-dark">
              {(plan.amountCents / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: plan.currency,
              })}
              <span className="text-sm font-bold text-slate-500">/mês</span>
            </p>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-black text-safe-dark"><PackageCheck size={18} className="text-safe-green" /> Equipamentos incluídos</p>
              <div className="space-y-3 text-sm font-semibold text-slate-600">
                {plan.kitItems.map((item) => <div key={item} className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0 text-safe-green" /><span>{item}</span></div>)}
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm font-semibold text-slate-600">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <Check size={17} className="mt-0.5 shrink-0 text-safe-green" />
                  <span>{feature}</span>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <Check size={17} className="mt-0.5 shrink-0 text-safe-green" />
                <span>Até {plan.maxUsers} usuários</span>
              </div>
            </div>
            <button
              type="button"
              disabled={selected || busyPlan !== null}
              onClick={() => onSelect(plan)}
              className={`mt-7 w-full rounded-2xl px-4 py-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                plan.highlighted
                  ? 'bg-safe-green text-white hover:brightness-95'
                  : 'bg-safe-dark text-white hover:brightness-110'
              }`}
            >
              {busyPlan === plan.code ? 'Processando...' : actionLabel(plan)}
            </button>
          </article>
        );
      })}
    </div>
  );
}
