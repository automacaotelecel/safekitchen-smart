import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Menu,
  Printer,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Thermometer,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { CommercialPlan } from '../types';

const benefits = [
  {
    icon: Tags,
    title: 'Etiquetas padronizadas',
    text: 'Produza etiquetas com validade, lote e responsável sem depender de preenchimento improvisado.',
  },
  {
    icon: Thermometer,
    title: 'Temperatura sob controle',
    text: 'Registre medições, acompanhe o histórico e identifique desvios antes que virem problema.',
  },
  {
    icon: FileCheck2,
    title: 'Registros prontos para auditoria',
    text: 'Centralize documentos, evidências e relatórios para uma rotina mais rastreável.',
  },
  {
    icon: Sparkles,
    title: 'Sana, sua assistente inteligente',
    text: 'Use inteligência artificial para apoiar a leitura de produtos e acelerar tarefas repetitivas.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Cadastre sua operação',
    text: 'Crie a conta da empresa e escolha o plano adequado à sua rotina.',
  },
  {
    number: '02',
    title: 'Contrate em um único fluxo',
    text: 'Pague a implantação e autorize as mensalidades futuras com segurança pelo Mercado Pago.',
  },
  {
    number: '03',
    title: 'Acesse imediatamente',
    text: 'Após a confirmação do Mercado Pago, o sistema é liberado sem esperar o agendamento da implantação.',
  },
  {
    number: '04',
    title: 'Configure com nossa equipe',
    text: 'Agendamos o atendimento remoto, configuramos os módulos e treinamos sua equipe.',
  },
];

const comparison = [
  ['Configuração inicial', 'Incluída', 'Incluída'],
  ['Cadastro do estabelecimento', 'Incluído', 'Incluído'],
  ['Cadastro de usuários', 'Até 5', 'Até 25'],
  ['Sistema de etiquetas', 'Incluído', 'Incluído'],
  ['Impressão pelo sistema', 'Incluída', 'Incluída'],
  ['Registros digitais', 'Incluídos', 'Incluídos'],
  ['Controle de temperatura', 'Manual', 'Automatizado'],
  ['Histórico de temperaturas', 'Incluído', 'Incluído'],
  ['Alertas de temperatura', '—', 'Incluídos'],
  ['Relatórios', 'Básicos', 'Avançados'],
  ['Treinamento de implantação', 'Incluído', 'Incluído'],
];

const faqs = [
  {
    question: 'A taxa de implantação é mensal?',
    answer:
      'Não. Ela é paga uma única vez e cobre configuração inicial, parametrização dos módulos e treinamento de implantação. A licença de uso é cobrada mensalmente.',
  },
  {
    question: 'Impressora e termômetros estão incluídos?',
    answer:
      'Não. Equipamentos e insumos são adquiridos pelo cliente. Nossa equipe orienta a configuração e, no plano Pro, avalia a integração com dispositivos tecnicamente compatíveis.',
  },
  {
    question: 'Quando a mensalidade começa?',
    answer:
      'No mesmo checkout, você paga a implantação e autoriza as mensalidades futuras. O acesso é liberado assim que o Mercado Pago confirma a contratação; a implantação assistida acontece depois e não bloqueia o uso.',
  },
  {
    question: 'Como acontece a implantação?',
    answer:
      'O atendimento é remoto e assistido. Após a confirmação do pagamento, nossa equipe entra em contato para agendar a configuração e o treinamento.',
  },
  {
    question: 'O sistema substitui o nutricionista responsável?',
    answer:
      'Não. O SafeKitchen Smart apoia a organização e a rastreabilidade, mas não substitui decisões técnicas, sanitárias ou legais do estabelecimento.',
  },
];

function money(value: number, currency = 'BRL') {
  return (value / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency,
  });
}

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img
        src="/safekitchen-logo.png"
        alt="SafeKitchen Smart"
        className="h-11 w-11 rounded-xl bg-white object-contain p-0.5 shadow-sm"
      />
      <span
        className={`text-base font-black tracking-tight ${
          inverted ? 'text-white' : 'text-[#073b4c]'
        }`}
      >
        SafeKitchen <span className="text-[#0f9f87]">Smart</span>
      </span>
    </Link>
  );
}

function PlanCard({ plan }: { plan: CommercialPlan }) {
  const implementationItems = Array.isArray(plan.implementationItems)
    ? plan.implementationItems
    : [];
  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <article
      className={`relative flex h-full flex-col rounded-[26px] border p-5 shadow-sm sm:p-7 ${
        plan.highlighted
          ? 'border-[#19d09c] bg-[#073b4c] text-white ring-4 ring-[#19d09c]/10'
          : 'border-slate-200 bg-white text-[#073b4c]'
      }`}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-5 rounded-full bg-[#19d09c] px-4 py-1 text-[10px] font-black uppercase tracking-wider text-[#073b4c]">
          Mais completo
        </span>
      )}
      <p
        className={`text-[10px] font-black uppercase tracking-[0.2em] ${
          plan.highlighted ? 'text-[#58efc9]' : 'text-[#0a7c86]'
        }`}
      >
        {plan.audience}
      </p>
      <h3 className="mt-3 text-2xl font-black">{plan.name}</h3>
      <p
        className={`mt-2 min-h-12 text-sm font-medium leading-6 ${
          plan.highlighted ? 'text-white/65' : 'text-slate-500'
        }`}
      >
        {plan.description}
      </p>

      <div
        className={`mt-6 grid grid-cols-2 gap-3 rounded-2xl p-4 ${
          plan.highlighted ? 'bg-white/7' : 'bg-[#edf9f6]'
        }`}
      >
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider opacity-55">
            Implantação
          </p>
          <p className="mt-1 text-xl font-black">
            {money(plan.setupAmountCents, plan.currency)}
          </p>
          <p className="text-[10px] font-bold opacity-55">pagamento único</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider opacity-55">
            Licença
          </p>
          <p className="mt-1 text-xl font-black">
            {money(plan.amountCents, plan.currency)}
          </p>
          <p className="text-[10px] font-bold opacity-55">por mês</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {[...implementationItems, ...features]
          .slice(0, 8)
          .map((item) => (
            <div
              key={item}
              className={`flex items-start gap-2.5 text-sm font-semibold ${
                plan.highlighted ? 'text-white/78' : 'text-slate-600'
              }`}
            >
              <Check
                size={17}
                className="mt-0.5 shrink-0 text-[#19d09c]"
              />
              <span>{item}</span>
            </div>
          ))}
      </div>

      <Link
        to="/login?register=1"
        className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition ${
          plan.highlighted
            ? 'bg-[#19d09c] text-[#073b4c] hover:bg-[#32dfb3]'
            : 'bg-[#073b4c] text-white hover:bg-[#0b5264]'
        }`}
      >
        Contratar {plan.name}
        <ArrowRight size={17} />
      </Link>
    </article>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    api<{ plans: CommercialPlan[] }>('/api/billing/plans')
      .then((data) =>
        setPlans(Array.isArray(data?.plans) ? data.plans : [])
      )
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#073b4c]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          <Brand />

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a href="#recursos" className="transition hover:text-[#0a7c86]">
              Recursos
            </a>
            <a href="#implantacao" className="transition hover:text-[#0a7c86]">
              Implantação
            </a>
            <a href="#planos" className="transition hover:text-[#0a7c86]">
              Planos
            </a>
            <a href="#duvidas" className="transition hover:text-[#0a7c86]">
              Dúvidas
            </a>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-black text-[#073b4c]"
            >
              Entrar
            </Link>
            <Link
              to="/login?register=1"
              className="rounded-xl bg-[#073b4c] px-5 py-2.5 text-sm font-black text-white"
            >
              Cadastrar
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-xl border border-slate-200 p-2 text-[#073b4c] lg:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-100 py-4 lg:hidden">
            <nav className="grid gap-1 text-sm font-bold text-slate-600">
              {[
                ['Recursos', '#recursos'],
                ['Implantação', '#implantacao'],
                ['Planos', '#planos'],
                ['Dúvidas', '#duvidas'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-3 hover:bg-slate-50"
                >
                  {label}
                </a>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  className="rounded-xl border px-4 py-3 text-center font-black"
                >
                  Entrar
                </Link>
                <Link
                  to="/login?register=1"
                  className="rounded-xl bg-[#073b4c] px-4 py-3 text-center font-black text-white"
                >
                  Cadastrar
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#052d38] px-4 py-16 text-white sm:px-6 sm:py-24 lg:py-28">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#19d09c]/15 blur-3xl" />
          <div className="absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#58efc9] sm:text-xs">
                <ShieldCheck size={15} />
                Gestão inteligente para cozinhas profissionais
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Mais controle.
                <span className="block text-[#38e0b7]">
                  Menos improviso.
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/68 sm:text-lg sm:leading-8">
                Etiquetas, temperaturas, documentos e relatórios em uma única
                plataforma — configurada com sua equipe para funcionar na
                rotina real da operação.
              </p>
              <div className="mt-8 grid gap-3 sm:flex">
                <Link
                  to="/login?register=1"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#19d09c] px-7 py-4 text-sm font-black text-[#052d38] transition hover:bg-[#32dfb3]"
                >
                  Conhecer os planos <ArrowRight size={18} />
                </Link>
                <a
                  href="#implantacao"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-7 py-4 text-sm font-black text-white hover:bg-white/7"
                >
                  Como funciona
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/55">
                <span className="flex items-center gap-2">
                  <Check size={15} className="text-[#38e0b7]" /> Implantação
                  assistida
                </span>
                <span className="flex items-center gap-2">
                  <Check size={15} className="text-[#38e0b7]" /> Contrato
                  eletrônico
                </span>
                <span className="flex items-center gap-2">
                  <Check size={15} className="text-[#38e0b7]" /> Pagamento
                  seguro
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="rounded-[30px] border border-white/12 bg-white/8 p-3 shadow-2xl backdrop-blur sm:p-5">
                <div className="rounded-[24px] bg-[#f4f8f8] p-4 text-[#073b4c] sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0a7c86]">
                        Visão da operação
                      </p>
                      <p className="mt-1 text-xl font-black">Bom dia, equipe</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dff8f1] text-[#0a8f78]">
                      <ClipboardCheck size={21} />
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                      ['Etiquetas ativas', '128'],
                      ['A vencer', '06'],
                      ['Temperaturas', 'Normal'],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <p className="truncate text-[8px] font-black uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mt-2 truncate text-base font-black">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff8f1] text-[#0a8f78]">
                        <ScanLine size={19} />
                      </div>
                      <div>
                        <p className="text-sm font-black">
                          Nova etiqueta inteligente
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          Leitura assistida pela Sana
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[8px] font-black uppercase text-slate-400">
                          Produto
                        </p>
                        <p className="mt-1 text-xs font-bold">Queijo muçarela</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[8px] font-black uppercase text-slate-400">
                          Conservação
                        </p>
                        <p className="mt-1 text-xs font-bold">Refrigerado</p>
                      </div>
                    </div>
                    <div className="mt-3 h-10 rounded-xl bg-[#19d09c]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="recursos"
          className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">
                Controle que acompanha a rotina
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                Da etiqueta ao relatório, tudo conectado.
              </h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-500">
                O SafeKitchen organiza atividades críticas sem transformar a
                operação em mais uma planilha difícil de manter.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5faf4] text-[#0a8f78]">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="implantacao"
          className="scroll-mt-24 bg-[#f4f8f8] px-4 py-20 sm:px-6 sm:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">
                Implantação assistida
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                Você não recebe apenas um login.
              </h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-500">
                Nossa equipe ajuda a configurar os módulos e prepara sua
                operação para começar com segurança.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <span className="text-xs font-black tracking-[0.18em] text-[#0a8f78]">
                    {step.number}
                  </span>
                  <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-10 grid gap-4 rounded-[26px] bg-[#073b4c] p-5 text-white sm:grid-cols-3 sm:p-8">
              {[
                [Settings2, 'Configuração', 'Módulos preparados para a rotina do estabelecimento.'],
                [Users, 'Treinamento', 'Equipe orientada para utilizar os principais recursos.'],
                [GraduationCap, 'Acompanhamento', 'Atendimento de implantação com orientações claras.'],
              ].map(([Icon, title, text]) => {
                const FeatureIcon = Icon as typeof Settings2;
                return (
                  <div key={String(title)} className="flex gap-3">
                    <FeatureIcon className="shrink-0 text-[#38e0b7]" />
                    <div>
                      <p className="font-black">{String(title)}</p>
                      <p className="mt-1 text-sm leading-6 text-white/60">
                        {String(text)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="planos"
          className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">
                Implantação e licença
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                Escolha o nível de controle da sua operação.
              </h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-500">
                Uma taxa única para configurar e uma licença mensal para manter
                a plataforma ativa.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {plansLoading &&
                [1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-[560px] animate-pulse rounded-[28px] bg-slate-100"
                  />
                ))}
              {!plansLoading &&
                plans.map((plan) => (
                  <PlanCard key={plan.code} plan={plan} />
                ))}
            </div>

            {!plansLoading && plans.length === 0 && (
              <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="font-black">Planos temporariamente indisponíveis.</p>
                <Link
                  to="/login?register=1"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#073b4c] px-5 py-3 text-sm font-black text-white"
                >
                  Cadastrar <ArrowRight size={16} />
                </Link>
              </div>
            )}

            <div className="mt-14 overflow-hidden rounded-[26px] border border-slate-200">
              <div className="grid grid-cols-[1.45fr_.7fr_.7fr] bg-[#073b4c] px-4 py-4 text-xs font-black uppercase tracking-wider text-white sm:px-6">
                <span>Recursos</span>
                <span>Start</span>
                <span>Pro</span>
              </div>
              {comparison.map(([feature, start, pro], index) => (
                <div
                  key={feature}
                  className={`grid grid-cols-[1.45fr_.7fr_.7fr] gap-2 px-4 py-4 text-xs sm:px-6 sm:text-sm ${
                    index % 2 ? 'bg-slate-50' : 'bg-white'
                  }`}
                >
                  <span className="font-bold">{feature}</span>
                  <span className="font-semibold text-slate-600">{start}</span>
                  <span className="font-black text-[#0a8f78]">{pro}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs font-semibold leading-5 text-slate-400">
              Equipamentos, insumos e deslocamentos presenciais não estão
              incluídos. Integrações dependem de compatibilidade técnica.
            </p>
          </div>
        </section>

        <section className="bg-[#052d38] px-4 py-20 text-white sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#38e0b7]">
                Recursos por plano
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                Comece simples. Evolua quando precisar.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Printer, 'Impressão pelo sistema'],
                [Thermometer, 'Temperatura manual ou automatizada'],
                [BellRing, 'Alertas operacionais'],
                [BarChart3, 'Relatórios básicos ou avançados'],
              ].map(([Icon, label]) => {
                const FeatureIcon = Icon as typeof Printer;
                return (
                  <div
                    key={String(label)}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <FeatureIcon className="shrink-0 text-[#38e0b7]" />
                    <span className="text-sm font-bold text-white/75">
                      {String(label)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="duvidas"
          className="scroll-mt-24 bg-[#f4f8f8] px-4 py-20 sm:px-6 sm:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">
                Dúvidas frequentes
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                Clareza antes de contratar.
              </h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-500">
                Precisa conversar? Nossa equipe está disponível pelo e-mail.
              </p>
              <a
                href="mailto:safekitchensmart@gmail.com"
                className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#0a7c86]"
              >
                safekitchensmart@gmail.com <ArrowRight size={16} />
              </a>
            </div>

            <div className="space-y-3">
              {faqs.map(({ question, answer }) => (
                <details
                  key={question}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 open:shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black">
                    <span>{question}</span>
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-[#0a7c86] transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-4 pr-5 text-sm font-medium leading-6 text-slate-500">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl rounded-[30px] bg-[#19d09c] px-5 py-12 text-center text-[#052d38] sm:px-10 sm:py-16">
            <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              Sua operação pode começar mais organizada.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-[#073b4c]/70">
              Cadastre sua empresa, escolha o plano e avance para uma
              implantação acompanhada pela nossa equipe.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:justify-center">
              <Link
                to="/login?register=1"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#052d38] px-7 py-4 text-sm font-black text-white"
              >
                Cadastrar agora <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-[#052d38]/20 px-7 py-4 text-sm font-black"
              >
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#031820] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Brand inverted />
            <p className="mt-4 max-w-sm text-xs font-medium leading-5 text-white/45">
              Tecnologia e implantação assistida para operações profissionais
              de alimentação.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/55">
            <a href="#recursos">Recursos</a>
            <a href="#implantacao">Implantação</a>
            <a href="#planos">Planos</a>
            <a href="#duvidas">Dúvidas</a>
            <Link to="/login">Entrar</Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/8 pt-6 text-[11px] font-semibold text-white/35">
          © {new Date().getFullYear()} SafeKitchen Smart. Todos os direitos
          reservados.
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
