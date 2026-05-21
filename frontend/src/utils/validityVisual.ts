export type ValidityVisual = {
  label: string;
  cardClass: string;
  badgeClass: string;
  dotClass: string;
  priority: number;
};

export function getValidityVisual(
  expiresAt?: string | null,
  status?: string | null
): ValidityVisual {
  if (status === 'CANCELADA') {
    return {
      label: 'Cancelada',
      cardClass: 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5',
      badgeClass: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200',
      dotClass: 'bg-slate-400',
      priority: 5,
    };
  }

  if (!expiresAt) {
    return {
      label: 'Sem validade',
      cardClass: 'border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020]',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200',
      dotClass: 'bg-slate-400',
      priority: 4,
    };
  }

  const expiration = new Date(expiresAt);

  if (Number.isNaN(expiration.getTime())) {
    return {
      label: 'Sem validade',
      cardClass: 'border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020]',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200',
      dotClass: 'bg-slate-400',
      priority: 4,
    };
  }

  const now = new Date();

  if (expiration.getTime() < now.getTime()) {
    return {
      label: 'Vencida',
      cardClass: 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-100',
      dotClass: 'bg-red-500',
      priority: 1,
    };
  }

  const hoursLeft = (expiration.getTime() - now.getTime()) / 1000 / 60 / 60;

  if (hoursLeft <= 24) {
    return {
      label: 'Vence em breve',
      cardClass: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-100',
      dotClass: 'bg-amber-500',
      priority: 2,
    };
  }

  return {
    label: 'Válida',
    cardClass: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/15',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100',
    dotClass: 'bg-emerald-500',
    priority: 3,
  };
}

export function formatDateBR(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('pt-BR');
}

export function formatDateTimeBR(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('pt-BR');
}