import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Plus, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Label } from '../types';
import { StatCard } from '../components/StatCard';
import { labelTypeName } from '../utils/labels';
import { format } from 'date-fns';

export function Dashboard() {
  const [data, setData] = useState<{ total: number; expired: number; active: number; noExpiration: number; recent: Label[] } | null>(null);

  useEffect(() => {
    api<typeof data>('/api/labels/dashboard').then(setData).catch(console.error);
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden rounded-[2rem] bg-safe-gradient p-6 text-white shadow-app lg:p-8">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 hidden h-full w-[34rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,.18),transparent_65%)] lg:block" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-safe-yellow">SafeKitchen Smart</p>
            <h1 className="mt-3 text-3xl font-black leading-tight lg:text-5xl">Controle sanitário simples, rápido e visual.</h1>
            <p className="mt-4 max-w-xl text-base font-semibold text-white/80">
              Gere etiquetas, calcule validade automaticamente e mantenha o histórico pronto para auditoria da cozinha.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/nova-etiqueta" className="inline-flex items-center gap-2 rounded-2xl bg-safe-yellow px-5 py-3 text-sm font-black text-safe-dark shadow-lg shadow-black/10">
                <Plus size={18} /> Nova etiqueta
              </Link>
              <Link to="/historico" className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 text-sm font-black text-white ring-1 ring-white/20 backdrop-blur">
                Ver histórico
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white/95 p-4 text-safe-dark shadow-2xl lg:w-80">
            <img src="/safekitchen-logo.png" alt="SafeKitchen Smart" className="mx-auto h-32 w-32 object-contain" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-safe-soft p-3">
                <p className="text-2xl font-black text-safe-green">{data?.active || 0}</p>
                <p className="text-[11px] font-bold uppercase text-slate-500">Ativas</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-3">
                <p className="text-2xl font-black text-red-600">{data?.expired || 0}</p>
                <p className="text-[11px] font-bold uppercase text-slate-500">Vencidas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Etiquetas" value={data?.total || 0} icon={Tags} hint="Total gerado no restaurante" />
        <StatCard title="Ativas" value={data?.active || 0} icon={CheckCircle2} hint="Sem vencimento crítico" />
        <StatCard title="Vencidas" value={data?.expired || 0} icon={AlertTriangle} hint="Precisam ser revisadas" />
        <StatCard title="Sem validade" value={data?.noExpiration || 0} icon={Clock} hint="Ex.: não conforme" />
      </div>

      <section className="mt-8 rounded-3xl border border-white/70 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-safe-green">Operação</p>
            <h2 className="mt-1 text-xl font-black text-safe-dark">Últimas etiquetas</h2>
          </div>
          <Link to="/nova-etiqueta" className="rounded-2xl bg-safe-green px-4 py-3 text-center text-sm font-black text-white">Gerar nova</Link>
        </div>
        <div className="mt-4 space-y-3">
          {(data?.recent || []).map((label) => (
            <div key={label.id} className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-black text-slate-900">{label.productName}</p>
                <p className="text-sm font-semibold text-slate-500">{labelTypeName(label.type)} • Responsável: {label.responsibleName}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-safe-dark shadow-sm">
                Validade: {label.expiresAt ? format(new Date(label.expiresAt), 'dd/MM/yyyy') : '-'}
              </div>
            </div>
          ))}
          {data?.recent?.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhuma etiqueta gerada ainda.</p>}
        </div>
      </section>
    </div>
  );
}
