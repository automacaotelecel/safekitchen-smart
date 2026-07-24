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
  implementationItems: string[];
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
      description: 'Implantação assistida para organizar etiquetas, registros e temperatura manual.',
      setupAmountCents: cents(env.planStartSetupPrice),
      amountCents: cents(env.planStartMonthlyPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: false,
      maxUsers: 5,
      maxLabelsPerMonth: 1_000,
      maxAiAnalysesPerMonth: 100,
      maxDevices: 2,
      implementationItems: [
        'Configuração inicial da operação',
        'Cadastro do estabelecimento e usuários',
        'Configuração do sistema de etiquetas',
        'Configuração da impressão pelo sistema',
        'Treinamento remoto de implantação',
      ],
      features: [
        'Etiquetas, impressão e registros digitais',
        'Controle e histórico de temperatura manual',
        'Documentos e alertas de vencimento',
        'Relatórios operacionais básicos',
      ],
    },
    {
      code: 'PRO',
      name: 'SKS Pro',
      audience: 'Médios e grandes negócios',
      description: 'Implantação avançada com automação de temperatura, alertas e relatórios gerenciais.',
      setupAmountCents: cents(env.planProSetupPrice),
      amountCents: cents(env.planProMonthlyPrice),
      currency: 'BRL',
      interval: 'MONTH',
      highlighted: true,
      maxUsers: 25,
      maxLabelsPerMonth: null,
      maxAiAnalysesPerMonth: 1_000,
      maxDevices: 25,
      implementationItems: [
        'Configuração avançada da operação',
        'Cadastro estruturado da equipe',
        'Configuração personalizada de etiquetas',
        'Integração com dispositivos compatíveis',
        'Treinamento remoto completo',
      ],
      features: [
        'Tudo do SKS Start',
        'Etiquetas sem limite mensal',
        'Temperatura automatizada e alertas',
        'Relatórios avançados e até 25 dispositivos',
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
