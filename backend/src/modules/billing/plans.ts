import { env } from '../../config/env';

export type PlanCode = 'ESSENTIAL' | 'PROFESSIONAL' | 'PREMIUM';

export type CommercialPlan = {
  code: PlanCode;
  name: string;
  description: string;
  amountCents: number;
  currency: 'BRL';
  interval: 'MONTH';
  highlighted: boolean;
  maxUsers: number;
  maxLabelsPerMonth: number | null;
  maxAiAnalysesPerMonth: number;
  maxDevices: number;
  features: string[];
};

function cents(value: number) {
  return Math.round(value * 100);
}

export function getCommercialPlans(): CommercialPlan[] {
  return [
    {
      code: 'ESSENTIAL',
      name: 'Essencial',
      description: 'Para operações que querem substituir controles em papel.',
      amountCents: cents(env.planEssentialPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: false,
      maxUsers: 5,
      maxLabelsPerMonth: 500,
      maxAiAnalysesPerMonth: 30,
      maxDevices: 1,
      features: [
        'Etiquetas e histórico',
        'Documentos e vencimentos',
        'Alertas internos e por e-mail',
        'Dossiê de conformidade em PDF',
      ],
    },
    {
      code: 'PROFESSIONAL',
      name: 'Profissional',
      description: 'Para cozinhas com equipe maior e uso frequente de IA.',
      amountCents: cents(env.planProfessionalPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: true,
      maxUsers: 15,
      maxLabelsPerMonth: 3_000,
      maxAiAnalysesPerMonth: 250,
      maxDevices: 5,
      features: [
        'Tudo do plano Essencial',
        'Mais usuários e etiquetas',
        '250 análises de imagem por mês',
        'Até 5 dispositivos de temperatura',
      ],
    },
    {
      code: 'PREMIUM',
      name: 'Premium',
      description: 'Para operações intensivas e redes em crescimento.',
      amountCents: cents(env.planPremiumPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: false,
      maxUsers: 50,
      maxLabelsPerMonth: null,
      maxAiAnalysesPerMonth: 1_000,
      maxDevices: 25,
      features: [
        'Tudo do plano Profissional',
        'Etiquetas sem limite mensal',
        '1.000 análises de imagem por mês',
        'Até 25 dispositivos de temperatura',
      ],
    },
  ];
}

export function getCommercialPlan(code: string) {
  return getCommercialPlans().find((plan) => plan.code === code.toUpperCase());
}

export function planForAccess(code: string) {
  if (code === 'TRIAL') return getCommercialPlan('PROFESSIONAL')!;
  return getCommercialPlan(code) || getCommercialPlan('ESSENTIAL')!;
}
