import {
  ArrowRight,
  BellRing,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileText,
  History,
  Menu,
  PackageCheck,
  Printer,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Tags,
  Thermometer,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';
import type { CommercialPlan } from '../types';

const navigation = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Planos', href: '#planos' },
  { label: 'Dúvidas', href: '#duvidas' },
];

const features: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}> = [
  {
    icon: Tags,
    title: 'Etiquetas padronizadas',
    description:
      'Calcule validade, mantenha a identificação legível e imprima etiquetas sem depender de controles improvisados.',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: Thermometer,
    title: 'Controle de temperatura',
    description:
      'Registre medições manuais ou integradas, configure limites e acompanhe desvios por equipamento.',
    accent: 'bg-cyan-100 text-cyan-700',
  },
  {
    icon: FileClock,
    title: 'Documentos e vencimentos',
    description:
      'Centralize documentos da operação e seja avisado antes que licenças e comprovantes vençam.',
    accent: 'bg-violet-100 text-violet-700',
  },
  {
    icon: ScanLine,
    title: 'Leitura inteligente',
    description:
      'Use a câmera para apoiar o cadastro de produtos e reduzir digitação repetitiva na rotina da equipe.',
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    icon: History,
    title: 'Histórico para auditoria',
    description:
      'Consulte responsáveis, datas, etiquetas, temperaturas e ações em uma trilha organizada e pesquisável.',
    accent: 'bg-blue-100 text-blue-700',
  },
  {
    icon: BellRing,
    title: 'Alertas que viram ação',
    description:
      'Receba alertas internos e por e-mail para atuar em validades, documentos e temperaturas fora do padrão.',
    accent: 'bg-rose-100 text-rose-700',
  },
];

const steps = [
  {
    number: '01',
    title: 'Escolha o kit',
    description: 'Selecione a estrutura adequada ao tamanho e ao nível de automação da sua operação.',
    icon: PackageCheck,
  },
  {
    number: '02',
    title: 'Receba os equipamentos',
    description: 'O kit é preparado e enviado para você iniciar com os equipamentos compatíveis.',
    icon: Printer,
  },
  {
    number: '03',
    title: 'Confirme a entrega',
    description: 'Após receber o kit, confirme a entrega para liberar a etapa de ativação da assinatura.',
    icon: CheckCircle2,
  },
  {
    number: '04',
    title: 'Ative e organize a rotina',
    description: 'Autorize a mensalidade, cadastre a equipe e comece a centralizar seus controles.',
    icon: Zap,
  },
];

const faqs = [
  {
    question: 'O sistema é liberado assim que eu me cadastro?',
    answer:
      'O cadastro cria sua conta e abre a área de contratação. O acesso operacional é liberado depois do pagamento do kit, da confirmação de entrega e da ativação da assinatura mensal.',
  },
  {
    question: 'Preciso instalar o sistema em cada aparelho?',
    answer:
      'Não. O SafeKitchen Smart funciona pelo navegador em computador, tablet e celular. Em aparelhos compatíveis, também pode ser instalado como aplicativo web.',
  },
  {
    question: 'A impressão acontece direto na impressora?',
    answer:
      'O sistema prepara as etiquetas para impressão. A experiência final depende do modelo, do driver e da forma de conexão da impressora; por isso, os kits priorizam equipamentos compatíveis com o fluxo.',
  },
  {
    question: 'O registro de temperatura pode ser automático?',
    answer:
      'Sim, quando há termômetro compatível e integração configurada. A plataforma também oferece registro manual com responsável, horário, limite e evidências.',
  },
  {
    question: 'Consigo cadastrar minha equipe?',
    answer:
      'Sim. O administrador gerencia usuários e mantém os registros vinculados aos responsáveis por cada atividade.',
  },
  {
    question: 'Posso cancelar a assinatura?',
    answer:
      'O administrador acompanha o plano vigente e pode solicitar o cancelamento pela área de assinatura, respeitando as condições apresentadas na contratação.',
  },
];

function formatMoney(value: unknown, currency = 'BRL') {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value / 100 : 0;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency });
}

function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-3" aria-label="SafeKitchen Smart — início">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-md">
        <img src="/safekitchen-logo.png" alt="" className="h-full w-full object-contain" />
      </span>
      <span>
        <span className={`block text-lg font-black leading-none ${inverted ? 'text-white' : 'text-[#073b4c]'}`}>
          SafeKitchen
        </span>
        <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.3em] text-[#19d09c]">Smart</span>
      </span>
    </Link>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:ml-auto">
      <div className="absolute -left-12 top-16 h-48 w-48 rounded-full bg-[#19d09c]/30 blur-3xl" />
      <div className="absolute -right-4 bottom-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-[#061b24]/95 p-3 shadow-[0_36px_100px_rgba(0,0,0,0.42)] sm:p-4">
        <div className="flex items-center justify-between px-2 pb-3 pt-1">
          <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">Painel operacional</span>
        </div>

        <div className="grid overflow-hidden rounded-[22px] bg-[#f4f8f8] sm:grid-cols-[120px_1fr]">
          <aside className="hidden bg-[#082d38] p-4 text-white sm:block">
            <div className="flex items-center gap-2">
              <img src="/safekitchen-logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain" />
              <span className="text-[8px] font-black uppercase tracking-wider">SafeKitchen</span>
            </div>
            <div className="mt-8 space-y-2">
              {['Visão geral', 'Etiquetas', 'Temperaturas', 'Documentos', 'Relatórios'].map((item, index) => (
                <div key={item} className={`rounded-lg px-2 py-2 text-[7px] font-bold ${index === 0 ? 'bg-[#19d09c] text-[#062d37]' : 'text-white/55'}`}>{item}</div>
              ))}
            </div>
          </aside>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#0a7c86]">Visão geral</p><p className="mt-1 text-sm font-black text-[#073b4c] sm:text-base">Bom dia, equipe</p></div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[7px] font-black text-emerald-700">Operação online</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['12', 'Etiquetas hoje', 'bg-emerald-50 text-emerald-700'],
                ['03', 'Alertas ativos', 'bg-amber-50 text-amber-700'],
                ['08', 'Controles feitos', 'bg-cyan-50 text-cyan-700'],
              ].map(([value, label, classes]) => (
                <div key={label} className={`rounded-xl p-2.5 sm:p-3 ${classes}`}><p className="text-base font-black sm:text-xl">{value}</p><p className="mt-1 text-[6px] font-bold leading-tight sm:text-[7px]">{label}</p></div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between"><span className="text-[8px] font-black text-[#073b4c]">Atividades recentes</span><span className="text-[6px] font-bold text-[#0a7c86]">Ver histórico</span></div>
                <div className="mt-3 space-y-2">
                  {[
                    ['Queijo muçarela', 'Etiqueta impressa', '2 min'],
                    ['Câmara fria 01', 'Temperatura registrada', '14 min'],
                    ['Licença sanitária', 'Documento atualizado', '1 h'],
                  ].map(([title, detail, time], index) => (
                    <div key={title} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                      <span className={`h-7 w-7 shrink-0 rounded-lg ${index === 0 ? 'bg-emerald-100' : index === 1 ? 'bg-cyan-100' : 'bg-violet-100'}`} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[7px] font-black text-slate-700">{title}</span><span className="block truncate text-[6px] font-semibold text-slate-400">{detail}</span></span>
                      <span className="text-[6px] font-bold text-slate-400">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[#073b4c] p-3 text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#19d09c]/20 text-[#19f5c7]"><Bot size={15} /></div>
                <p className="mt-3 text-[9px] font-black">Sana · assistente inteligente</p>
                <p className="mt-1 text-[6px] font-semibold leading-relaxed text-white/60">Uma ajuda próxima para reconhecer produtos e organizar a rotina.</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/4 rounded-full bg-[#19d09c]" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-2 hidden items-center gap-3 rounded-2xl border border-white/20 bg-white px-4 py-3 shadow-2xl sm:flex">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={19} /></span>
        <span><span className="block text-xs font-black text-[#073b4c]">Controle concluído</span><span className="mt-0.5 block text-[10px] font-bold text-slate-400">Registro salvo no histórico</span></span>
      </div>
    </div>
  );
}

function LandingPlan({ plan, index }: { plan: CommercialPlan; index: number }) {
  const kitItems = Array.isArray(plan.kitItems) ? plan.kitItems : [];
  const features = Array.isArray(plan.features) ? plan.features : [];
  const highlighted = Boolean(plan.highlighted || index === 1);

  return (
    <article className={`relative flex h-full flex-col rounded-[30px] border p-6 sm:p-8 ${highlighted ? 'border-[#19d09c] bg-[#073b4c] text-white shadow-[0_28px_70px_rgba(7,59,76,0.22)]' : 'border-slate-200 bg-white text-[#073b4c] shadow-sm'}`}>
      {highlighted && <span className="absolute -top-3 left-7 rounded-full bg-[#19d09c] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#052d38]">Mais completo</span>}
      <p className={`text-xs font-black uppercase tracking-[0.2em] ${highlighted ? 'text-[#19f5c7]' : 'text-[#0a7c86]'}`}>{plan.audience}</p>
      <h3 className="mt-3 text-3xl font-black">{plan.name}</h3>
      <p className={`mt-3 min-h-12 text-sm font-semibold leading-6 ${highlighted ? 'text-white/65' : 'text-slate-500'}`}>{plan.description}</p>

      <div className={`mt-6 rounded-2xl p-4 ${highlighted ? 'bg-white/8' : 'bg-[#e8fffa]'}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${highlighted ? 'text-white/50' : 'text-slate-500'}`}>Kit de implantação</p>
        <p className="mt-1 text-2xl font-black">{formatMoney(plan.setupAmountCents, plan.currency)}</p>
      </div>

      <p className="mt-5 text-4xl font-black">{formatMoney(plan.amountCents, plan.currency)}<span className={`text-sm ${highlighted ? 'text-white/50' : 'text-slate-400'}`}>/mês</span></p>

      <div className={`my-6 h-px ${highlighted ? 'bg-white/10' : 'bg-slate-100'}`} />
      <p className="flex items-center gap-2 text-sm font-black"><PackageCheck size={17} className="text-[#19d09c]" /> O kit inclui</p>
      <ul className={`mt-4 space-y-3 text-sm font-semibold ${highlighted ? 'text-white/75' : 'text-slate-600'}`}>
        {[...kitItems.slice(0, 4), ...features.slice(0, Math.max(0, 5 - kitItems.length)), `Até ${plan.maxUsers} usuários`].slice(0, 6).map((item) => (
          <li key={item} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#19d09c]" /><span>{item}</span></li>
        ))}
      </ul>

      <Link to="/login?register=1" className={`mt-8 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition hover:-translate-y-0.5 ${highlighted ? 'bg-[#19d09c] text-[#052d38] hover:bg-[#25e2ae]' : 'bg-[#073b4c] text-white hover:bg-[#0a5265]'}`}>
        Cadastrar para contratar <ArrowRight size={17} />
      </Link>
    </article>
  );
}

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    api<{ plans: CommercialPlan[] }>('/api/billing/plans')
      .then((data) => setPlans(Array.isArray(data?.plans) ? data.plans.filter(Boolean) : []))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  const planPlaceholder = useMemo(() => Array.from({ length: 2 }, (_, index) => index), []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#041f28]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo inverted />

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
            {navigation.map((item) => <a key={item.href} href={item.href} className="text-sm font-bold text-white/70 transition hover:text-white">{item.label}</a>)}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login" className="rounded-xl px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">Entrar</Link>
            <Link to="/login?register=1" className="inline-flex items-center gap-2 rounded-xl bg-[#19d09c] px-5 py-3 text-sm font-black text-[#052d38] transition hover:bg-[#25e2ae]">Cadastrar <ArrowRight size={16} /></Link>
          </div>

          <button type="button" onClick={() => setMobileMenuOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white lg:hidden" aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#041f28] px-4 pb-5 pt-3 lg:hidden">
            <nav className="mx-auto max-w-7xl space-y-1" aria-label="Navegação móvel">
              {navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="block rounded-xl px-3 py-3 text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white">{item.label}</a>)}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <Link to="/login" className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-black text-white">Entrar</Link>
                <Link to="/login?register=1" className="rounded-xl bg-[#19d09c] px-4 py-3 text-center text-sm font-black text-[#052d38]">Cadastrar</Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#041f28] pb-20 pt-32 text-white sm:pb-28 sm:pt-40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(25,208,156,0.24),transparent_28rem),radial-gradient(circle_at_10%_85%,rgba(14,165,233,0.12),transparent_26rem)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[.95fr_1.05fr] lg:px-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#19d09c]/30 bg-[#19d09c]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#55f1c8]"><Sparkles size={14} /> Tecnologia para operações de alimentação</span>
              <h1 className="mt-7 max-w-2xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-[4.5rem]">Menos improviso. <span className="text-[#19d09c]">Mais controle</span> em cada etapa.</h1>
              <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-white/68 sm:text-lg">Etiquetas, validade, temperaturas, documentos e histórico reunidos em uma plataforma criada para tornar a rotina da cozinha mais simples, rastreável e profissional.</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login?register=1" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#19d09c] px-6 py-4 text-sm font-black text-[#052d38] shadow-[0_16px_35px_rgba(25,208,156,.2)] transition hover:-translate-y-0.5 hover:bg-[#25e2ae]">Conhecer os kits <ArrowRight size={18} /></Link>
                <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-black text-white transition hover:bg-white/10">Ver como funciona <ChevronDown size={18} /></a>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/55">
                <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#19d09c]" /> Acesso pelo navegador</span>
                <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#19d09c]" /> Perfis de acesso</span>
                <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#19d09c]" /> Pagamento pelo Mercado Pago</span>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:px-6">
          <div className="grid overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(7,59,76,.12)] sm:grid-cols-3">
            {[
              [Clock3, 'Ganhe consistência', 'Processos claros para a equipe'],
              [ClipboardCheck, 'Centralize controles', 'Menos informação espalhada'],
              [FileText, 'Construa histórico', 'Registros prontos para consulta'],
            ].map(([Icon, title, description], index) => {
              const IconComponent = Icon as LucideIcon;
              return <div key={title as string} className={`flex items-center gap-4 p-5 sm:p-6 ${index > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''}`}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e8fffa] text-[#0a7c86]"><IconComponent size={20} /></span><span><span className="block text-sm font-black text-[#073b4c]">{title as string}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{description as string}</span></span></div>;
            })}
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">Da correria ao controle</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] text-[#073b4c] sm:text-5xl">A rotina não precisa depender de papéis, memória e retrabalho.</h2>
              <p className="mt-6 text-base font-medium leading-7 text-slate-500">Quando os controles ficam espalhados, a equipe perde tempo e a gestão perde visibilidade. O SafeKitchen Smart cria um fluxo único para registrar, acompanhar e agir.</p>
              <Link to="/login?register=1" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#0a7c86]">Quero organizar minha operação <ArrowRight size={17} /></Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-slate-100 p-6 sm:translate-y-8"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500"><FileText size={20} /></span><p className="mt-5 text-lg font-black text-slate-700">Antes</p><ul className="mt-4 space-y-3 text-sm font-semibold text-slate-500"><li>Planilhas e anotações separadas</li><li>Validades calculadas na pressa</li><li>Documentos lembrados em cima da hora</li><li>Pouca rastreabilidade da equipe</li></ul></div>
              <div className="rounded-[28px] bg-[#073b4c] p-6 text-white"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#19d09c] text-[#073b4c]"><Sparkles size={20} /></span><p className="mt-5 text-lg font-black">Com SafeKitchen</p><ul className="mt-4 space-y-3 text-sm font-semibold text-white/68">{['Informações em um só lugar','Cálculos e registros padronizados','Alertas para agir no momento certo','Histórico por responsável'].map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#19d09c]" /> {item}</li>)}</ul></div>
            </div>
          </div>
        </section>

        <section id="recursos" className="scroll-mt-24 bg-[#f4f8f8] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">Uma plataforma, vários controles</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#073b4c] sm:text-5xl">Tudo o que sua equipe precisa para trabalhar com mais clareza.</h2><p className="mt-5 text-base font-medium leading-7 text-slate-500">Recursos conectados para facilitar a execução diária e dar mais visão à gestão.</p></div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description, accent }) => <article key={title} className="group rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(7,59,76,.1)] sm:p-7"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}><Icon size={22} /></span><h3 className="mt-6 text-xl font-black text-[#073b4c]">{title}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-500">{description}</p></article>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">Como funciona</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#073b4c] sm:text-5xl">Do cadastro à operação, sem promessas confusas.</h2><p className="mt-5 text-base font-medium leading-7 text-slate-500">Você conhece o kit, recebe os equipamentos e ativa o sistema quando estiver pronto para começar.</p></div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ number, title, description, icon: Icon }, index) => <article key={number} className="relative rounded-[26px] border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-[0.2em] text-slate-300">{number}</span><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8fffa] text-[#0a7c86]"><Icon size={20} /></span></div><h3 className="mt-8 text-lg font-black text-[#073b4c]">{title}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-500">{description}</p>{index < steps.length - 1 && <span className="absolute -right-3 top-1/2 z-10 hidden h-px w-6 bg-[#19d09c] lg:block" />}</article>)}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[34px] bg-[#073b4c] lg:grid-cols-[.95fr_1.05fr]">
            <div className="p-7 text-white sm:p-12 lg:p-16"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#19d09c]/15 text-[#19f5c7]"><Bot size={23} /></span><p className="mt-7 text-xs font-black uppercase tracking-[0.22em] text-[#19f5c7]">Conheça a Sana</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-5xl">Uma assistente para apoiar. Sua equipe para decidir.</h2><p className="mt-6 text-base font-medium leading-7 text-white/65">A Sana ajuda a reconhecer informações e agilizar cadastros. Antes de salvar, a equipe confere e confirma os dados — porque automação útil também precisa de controle humano.</p><div className="mt-8 flex flex-wrap gap-3"><span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70">Conferência antes de salvar</span><span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70">Leitura inteligente de imagens</span><span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70">Histórico da operação</span></div></div>
            <div className="relative min-h-[400px] bg-[radial-gradient(circle_at_center,rgba(25,208,156,.22),transparent_22rem)] p-7 sm:p-12"><div className="mx-auto max-w-md rounded-[28px] border border-white/12 bg-[#041f28] p-5 shadow-2xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19d09c] text-[#073b4c]"><ScanLine size={19} /></span><span><span className="block text-sm font-black text-white">Leitura do produto</span><span className="text-[10px] font-bold text-white/40">Revise as informações encontradas</span></span></div><div className="mt-5 rounded-2xl border border-dashed border-[#19d09c]/35 bg-[#19d09c]/5 p-5"><div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-white/5"><Tags size={38} className="text-[#19d09c]" /></div></div><div className="mt-4 space-y-3">{[['Produto','Queijo muçarela'],['Conservação','Refrigerado'],['Validade sugerida','Conferir regra']].map(([label,value]) => <div key={label} className="rounded-xl bg-white/5 px-4 py-3"><p className="text-[9px] font-black uppercase tracking-wider text-white/35">{label}</p><p className="mt-1 text-xs font-bold text-white/80">{value}</p></div>)}</div><button type="button" className="mt-4 w-full rounded-xl bg-[#19d09c] py-3 text-xs font-black text-[#073b4c]">Confirmar informações</button></div></div>
          </div>
        </section>

        <section className="bg-[#f4f8f8] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl text-center"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">Feito para quem cuida da operação</p><div className="mt-8 flex flex-wrap justify-center gap-3">{['Restaurantes','Cozinhas industriais','Padarias','Confeitarias','Dark kitchens','Serviços de alimentação'].map((item) => <span key={item} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#073b4c] shadow-sm">{item}</span>)}</div></div>
        </section>

        <section id="planos" className="scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">Kits e assinatura</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#073b4c] sm:text-5xl">Escolha a estrutura ideal para começar.</h2><p className="mt-5 text-base font-medium leading-7 text-slate-500">O kit prepara sua operação. A assinatura mantém o acesso à plataforma e aos recursos do plano.</p></div>
            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              {plansLoading && planPlaceholder.map((item) => <div key={item} className="h-[560px] animate-pulse rounded-[30px] bg-slate-100" />)}
              {!plansLoading && plans.map((plan, index) => <LandingPlan key={plan.code} plan={plan} index={index} />)}
            </div>
            {!plansLoading && plans.length === 0 && <div className="mt-12 rounded-[26px] border border-slate-200 bg-[#f4f8f8] p-8 text-center"><p className="font-black text-[#073b4c]">Planos temporariamente indisponíveis.</p><p className="mt-2 text-sm font-medium text-slate-500">Você ainda pode criar sua conta ou falar conosco para conhecer as opções.</p><Link to="/login?register=1" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#073b4c] px-5 py-3 text-sm font-black text-white">Cadastrar <ArrowRight size={16} /></Link></div>}
            <p className="mt-7 text-center text-xs font-semibold text-slate-400">Equipamentos adicionais e necessidades específicas podem ser avaliados separadamente.</p>
          </div>
        </section>

        <section id="duvidas" className="scroll-mt-24 bg-[#f4f8f8] px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#0a7c86]">Dúvidas frequentes</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#073b4c] sm:text-5xl">Informação clara antes de contratar.</h2><p className="mt-5 text-base font-medium leading-7 text-slate-500">Não encontrou o que precisa? Fale com a equipe pelo e-mail.</p><a href="mailto:safekitchensmart@gmail.com" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#0a7c86]">safekitchensmart@gmail.com <ArrowRight size={16} /></a></div>
            <div className="space-y-3">{faqs.map(({ question, answer }) => <details key={question} className="group rounded-2xl border border-slate-200 bg-white p-5 open:shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black text-[#073b4c]"><span>{question}</span><ChevronDown size={18} className="shrink-0 text-[#0a7c86] transition group-open:rotate-180" /></summary><p className="mt-4 pr-6 text-sm font-medium leading-6 text-slate-500">{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="bg-[#041f28] px-4 py-20 text-white sm:px-6 sm:py-28">
          <div className="mx-auto max-w-5xl text-center"><span className="inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-[#19d09c]/15 p-3 text-[#19f5c7]"><Sparkles size={25} /></span><h2 className="mt-6 text-3xl font-black tracking-[-0.03em] sm:text-5xl">Sua cozinha pode ter mais controle a partir de agora.</h2><p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-white/60">Crie sua conta, conheça os kits e avance para uma rotina mais organizada, rastreável e preparada para crescer.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/login?register=1" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#19d09c] px-7 py-4 text-sm font-black text-[#052d38] transition hover:bg-[#25e2ae]">Cadastrar agora <ArrowRight size={18} /></Link><Link to="/login" className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-7 py-4 text-sm font-black text-white transition hover:bg-white/10">Já tenho conta</Link></div></div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#031820] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between"><div><Logo inverted /><p className="mt-4 max-w-sm text-xs font-medium leading-5 text-white/45">Tecnologia para organizar controles, dar visibilidade à gestão e apoiar a rotina das operações de alimentação.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-white/55"><a href="#recursos" className="hover:text-white">Recursos</a><a href="#planos" className="hover:text-white">Planos</a><a href="#duvidas" className="hover:text-white">Dúvidas</a><Link to="/login" className="hover:text-white">Entrar</Link><a href="mailto:safekitchensmart@gmail.com" className="hover:text-white">Contato</a></div></div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-white/8 pt-6 text-[11px] font-semibold text-white/35 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} SafeKitchen Smart. Todos os direitos reservados.</span><span>Plataforma de gestão para operações de alimentação.</span></div>
      </footer>
    </div>
  );
}
