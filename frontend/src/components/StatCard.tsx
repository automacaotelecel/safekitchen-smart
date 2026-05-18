import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
};

export function StatCard({ title, value, icon: Icon, hint }: Props) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-white/70 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-app">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
          <p className="mt-2 text-4xl font-black text-safe-dark">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-safe-soft text-safe-green transition group-hover:bg-safe-green group-hover:text-white">
          <Icon size={24} />
        </div>
      </div>
      {hint && <p className="mt-4 text-sm font-semibold text-slate-500">{hint}</p>}
    </div>
  );
}
