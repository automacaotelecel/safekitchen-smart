import { env } from '../../config/env';

export type PlanCode = 'START' | 'PRO';

export type CommercialPlan = {
  code: PlanCode;
  name: string;
  audience: string;
  description: string;
  setupAmountCents: number;
  amountCents: number;
  currency: 'BRL';
  interval: 'MONTH';
  highlighted: boolean;
  maxUsers: number;
  maxLabelsPerMonth: number | null;
  maxAiAnalysesPerMonth: number;
  maxDevices: number;
  kitItems: string[];
  features: string[];
};

function cents(value: number) {
  return Math.round(value * 100);
}

export function getCommercialPlans(): CommercialPlan[] {
  return [
    {
      code: 'START',
      name: 'SKS Start',
      audience: 'Pequenos negócios',
      description: 'Kit de implantação para começar com etiquetas e controle de temperatura manual.',
      setupAmountCents: cents(env.planStartSetupPrice),
      amountCents: cents(env.planStartMonthlyPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: false,
      maxUsers: 5,
      maxLabelsPerMonth: 1_000,
      maxAiAnalysesPerMonth: 100,
      maxDevices: 2,
      kitItems: [
        'Impressora Nimbot B21',
        '2 rolos de etiquetas',
        '2 termômetros simples para equipamentos',
        '1 termômetro simples de espeto',
        'Registro de temperatura manual',
      ],
      features: [
        'Etiquetas e histórico',
        'Documentos e vencimentos',
        'Alertas internos e por e-mail',
        'Dossiê de conformidade em PDF',
      ],
    },
    {
      code: 'PRO',
      name: 'SKS Pro',
      audience: 'Médios e grandes negócios',
      description: 'Implantação completa com equipamentos integrados e automação de temperatura.',
      setupAmountCents: cents(env.planProSetupPrice),
      amountCents: cents(env.planProMonthlyPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: true,
      maxUsers: 25,
      maxLabelsPerMonth: null,
      maxAiAnalysesPerMonth: 1_000,
      maxDevices: 25,
      kitItems: [
        'Impressora Zebra',
        '2 rolos de etiquetas',
        '2 termômetros automáticos integrados',
        '1 termômetro inteligente de espeto',
        'Registro de temperatura automático',
      ],
      features: [
        'Tudo do SKS Start',
        'Etiquetas sem limite mensal',
        '1.000 análises de imagem por mês',
        'Até 25 dispositivos de temperatura',
      ],
    },
  ];
}

export function getCommercialPlan(code: string) {
  const normalized = code.toUpperCase();
  const compatibilityCode =
    normalized === 'ESSENTIAL'
      ? 'START'
      : ['PROFESSIONAL', 'PREMIUM'].includes(normalized)
        ? 'PRO'
        : normalized;
  return getCommercialPlans().find((plan) => plan.code === compatibilityCode);
}

export function planForAccess(code: string) {
  if (code === 'TRIAL') return getCommercialPlan('PRO')!;
  return getCommercialPlan(code) || getCommercialPlan('START')!;
}
