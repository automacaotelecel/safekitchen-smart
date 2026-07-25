import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  FileCheck2,
  LogOut,
  RefreshCcw,
  Send,
  Settings,
  Settings2,
  XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { API_URL, api, clearToken, getToken } from '../api/client';
import { PlanCards } from '../components/PlanCards';
import type {
  CommercialContractInfo,
  CommercialPlan,
  ImplementationOrderInfo,
  PlanCode,
  SubscriptionInfo,
} from '../types';

type BillingState = {
  enabled: boolean;
  contractConfigured: boolean;
  restaurant: {
    plan: string;
    subscriptionStatus: string;
    trialEndsAt?: string | null;
    subscriptionEndsAt?: string | null;
  } | null;
  subscription: SubscriptionInfo | null;
  implementationOrder: ImplementationOrderInfo | null;
  contract: CommercialContractInfo | null;
};

type CheckoutForm = {
  customerName: string;
  customerDocument: string;
  customerPhone: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  acceptedTerms: boolean;
};

type ContractProvider = {
  name: string;
  document: string;
  email: string;
  city: string;
  implementationDays: number;
};

const emptyForm: CheckoutForm = {
  customerName: '',
  customerDocument: '',
  customerPhone: '',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  acceptedTerms: false,
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Aguardando definição';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Aguardando definição';
  return date.toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export function Subscription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [termsVersion, setTermsVersion] = useState('');
  const [contractProvider, setContractProvider] =
    useState<ContractProvider | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [selectedPlan, setSelectedPlan] =
    useState<CommercialPlan | null>(null);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(syncSubscription = false) {
    setLoading(true);
    setMessage('');
    try {
      const paymentId = searchParams.get('payment_id');
      if (
        paymentId &&
        searchParams.get('implementation') === 'approved'
      ) {
        await api('/api/billing/implementation-sync', {
          method: 'POST',
          body: JSON.stringify({ paymentId }),
        });
        window.history.replaceState({}, '', '/assinatura');
      }
      if (syncSubscription) {
        await api('/api/billing/sync', { method: 'POST' });
      }

      const [planData, state] = await Promise.all([
        api<{
          plans: CommercialPlan[];
          contractTermsVersion: string;
          contractProvider: ContractProvider | null;
        }>('/api/billing/plans'),
        api<BillingState>('/api/billing/subscription'),
      ]);

      setPlans(Array.isArray(planData?.plans) ? planData.plans : []);
      setTermsVersion(
        typeof planData?.contractTermsVersion === 'string'
          ? planData.contractTermsVersion
          : ''
      );
      setContractProvider(planData?.contractProvider || null);
      setBilling(state || null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar contratação.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(searchParams.get('checkout') === 'retorno');
  }, []);

  async function selectPlan(plan: CommercialPlan) {
    setMessage('');
    const implementation = billing?.implementationOrder;

    if (implementation?.status === 'APPROVED') {
      if (implementation.planCode !== plan.code) {
        setMessage(
          'A implantação paga pertence a outro plano. Fale com o suporte para revisar a contratação.'
        );
        return;
      }

      setBusyPlan(plan.code);
      try {
        const data = await api<{ checkoutUrl: string }>(
          '/api/billing/checkout',
          {
            method: 'POST',
            body: JSON.stringify({ planCode: plan.code }),
          }
        );
        window.location.assign(data.checkoutUrl);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Erro ao autorizar mensalidade.'
        );
      } finally {
        setBusyPlan(null);
      }
      return;
    }

    setSelectedPlan(plan);
  }

  async function createImplementationCheckout(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlan) return;

    setBusyPlan(selectedPlan.code);
    setMessage('');
    try {
      const data = await api<{ checkoutUrl: string }>(
        '/api/billing/implementation-checkout',
        {
          method: 'POST',
          body: JSON.stringify({
            planCode: selectedPlan.code,
            customerName: form.customerName,
            customerDocument: form.customerDocument,
            customerPhone: form.customerPhone || undefined,
            acceptedTerms: form.acceptedTerms,
            termsVersion,
            businessAddress: {
              postalCode: form.postalCode,
              street: form.street,
              number: form.number,
              complement: form.complement || undefined,
              district: form.district,
              city: form.city,
              state: form.state,
            },
          }),
        }
      );
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao iniciar a contratação.'
      );
    } finally {
      setBusyPlan(null);
    }
  }

  async function cancel() {
    if (
      !window.confirm(
        'Cancelar a assinatura agora? O acesso pago será encerrado imediatamente.'
      )
    ) {
      return;
    }
    setBusyAction('cancel');
    try {
      await api('/api/billing/cancel', { method: 'POST' });
      setMessage('Assinatura cancelada.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao cancelar assinatura.'
      );
    } finally {
      setBusyAction('');
    }
  }

  async function downloadContract() {
    setBusyAction('download');
    try {
      const response = await fetch(
        `${API_URL}/api/billing/contract/pdf`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      if (!response.ok) {
        throw new Error('Não foi possível baixar o contrato.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${
        billing?.contract?.contractNumber || 'contrato-safekitchen'
      }.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao baixar contrato.'
      );
    } finally {
      setBusyAction('');
    }
  }

  async function resendContract() {
    setBusyAction('resend');
    try {
      await api('/api/billing/contract/resend', { method: 'POST' });
      setMessage('Contrato reenviado por e-mail.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao reenviar contrato.'
      );
    } finally {
      setBusyAction('');
    }
  }

  const implementationPaid =
    billing?.implementationOrder?.status === 'APPROVED';
  const implementationScheduled = Boolean(
    billing?.implementationOrder?.scheduledFor
  );
  const implementationCompleted = Boolean(
    billing?.implementationOrder?.completedAt
  );
  const subscriptionActive = billing?.subscription?.status === 'ACTIVE';
  const contractAvailable = [
    'IMPLEMENTATION_PAID_PENDING_ACTIVATION',
    'ACTIVE',
  ].includes(billing?.contract?.status || '');
  const operationalAccess =
    billing?.restaurant?.subscriptionStatus === 'ACTIVE';
  const visiblePlans = implementationPaid
    ? plans.filter(
        (plan) => plan.code === billing?.implementationOrder?.planCode
      )
    : plans;

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f8f8] text-safe-dark">
      <header className="border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/safekitchen-logo.png"
              alt="SafeKitchen Smart"
              className="h-11 w-11 rounded-xl object-contain sm:h-12 sm:w-12"
            />
            <div className="min-w-0">
              <p className="truncate font-black text-safe-dark">
                SafeKitchen Smart
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-safe-green sm:text-xs">
                {operationalAccess
                  ? 'Plano e cobrança'
                  : 'Portal de contratação'}
              </p>
            </div>
          </div>

          <div
            className={`grid gap-2 ${
              operationalAccess ? 'grid-cols-3' : 'grid-cols-1'
            } sm:flex`}
          >
            {operationalAccess && (
              <>
                <Link
                  to="/painel"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-black sm:px-3 sm:text-xs"
                >
                  <ArrowLeft size={15} /> Sistema
                </Link>
                <Link
                  to="/conta"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-safe-dark px-2.5 py-2 text-[11px] font-black text-white sm:px-3 sm:text-xs"
                >
                  <Settings size={15} /> Administração
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-black text-red-600 sm:px-3 sm:text-xs"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
        <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-safe-green sm:text-xs">
                Implantação e licença
              </p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                Sua contratação
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                Acompanhe sua assinatura, o contrato e a implantação assistida
                em um só lugar.
              </p>
            </div>
            <button
              onClick={() => load(subscriptionActive)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black sm:w-auto"
            >
              <RefreshCcw size={17} /> Atualizar
            </button>
          </div>

          {!billing?.contractConfigured && (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Configure os dados jurídicos do contrato antes de oferecer a
              implantação.
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          )}

          {loading && (
            <div className="mt-5 rounded-2xl bg-safe-soft p-4 text-sm font-bold">
              Carregando dados da contratação...
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatusCard
              icon={implementationPaid ? CheckCircle2 : Settings2}
              label="Implantação"
              value={
                implementationPaid
                  ? 'PAGA'
                  : billing?.implementationOrder?.status || 'PENDENTE'
              }
            />
            <StatusCard
              icon={
                implementationCompleted
                  ? CheckCircle2
                  : CalendarClock
              }
              label="Andamento"
              value={
                implementationCompleted
                  ? 'CONCLUÍDA'
                  : implementationScheduled
                    ? 'AGENDADA'
                    : implementationPaid
                      ? 'A AGENDAR'
                      : 'AGUARDANDO'
              }
            />
            <StatusCard
              icon={subscriptionActive ? CheckCircle2 : CreditCard}
              label="Mensalidade"
              value={
                billing?.subscription?.status || 'NÃO AUTORIZADA'
              }
            />
            <StatusCard
              icon={contractAvailable ? FileCheck2 : XCircle}
              label="Contrato"
              value={
                contractAvailable
                  ? billing?.contract?.contractNumber || 'DISPONÍVEL'
                  : 'AGUARDANDO'
              }
            />
          </div>

          {billing?.implementationOrder?.status === 'PENDING' &&
            billing.implementationOrder.checkoutUrl && (
              <a
                href={billing.implementationOrder.checkoutUrl}
                className="mt-5 inline-flex w-full justify-center rounded-2xl bg-safe-dark px-5 py-3 text-sm font-black text-white sm:w-auto"
              >
                Continuar contratação
              </a>
            )}

          {contractAvailable && (
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <button
                onClick={downloadContract}
                disabled={Boolean(busyAction)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white"
              >
                <Download size={17} /> Baixar contrato
              </button>
              <button
                onClick={resendContract}
                disabled={Boolean(busyAction)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"
              >
                <Send size={17} /> Reenviar por e-mail
              </button>
            </div>
          )}

          {subscriptionActive && (
            <button
              onClick={cancel}
              disabled={busyAction === 'cancel'}
              className="mt-5 block text-sm font-black text-red-600 hover:underline"
            >
              Cancelar assinatura
            </button>
          )}
        </section>

        {implementationPaid &&
          !implementationScheduled &&
          !implementationCompleted && (
            <InfoPanel
              icon={CalendarClock}
              title="Contratação confirmada e acesso liberado"
              text="Você já pode usar o sistema. A mensalidade está autorizada e nossa equipe entrará em contato para agendar a implantação assistida."
              action={
                <Link
                  to="/painel"
                  className="mt-4 inline-flex w-full justify-center rounded-xl bg-safe-dark px-4 py-3 text-sm font-black text-white sm:w-auto"
                >
                  Acessar o sistema
                </Link>
              }
              positive
            />
          )}

        {implementationScheduled && !implementationCompleted && (
          <InfoPanel
            icon={CalendarClock}
            title="Implantação agendada"
            text={`Atendimento previsto para ${formatDateTime(
              billing?.implementationOrder?.scheduledFor
            )}.`}
            action={
              billing?.implementationOrder?.meetingUrl ? (
                <a
                  href={billing.implementationOrder.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full justify-center rounded-xl bg-safe-dark px-4 py-3 text-sm font-black text-white sm:w-auto"
                >
                  Acessar atendimento
                </a>
              ) : null
            }
          />
        )}

        {implementationCompleted && !subscriptionActive && (
          <InfoPanel
            icon={CheckCircle2}
            title="Implantação concluída"
            text="A implantação foi concluída, mas a assinatura precisa ser revisada. Atualize a página ou fale com o suporte."
            positive
          />
        )}

        {searchParams.get('implementation') === 'failure' && (
          <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertTriangle className="shrink-0" />
            <p className="font-bold">
              O pagamento da implantação não foi concluído. Você pode tentar
              novamente.
            </p>
          </div>
        )}

        {!loading &&
          !subscriptionActive &&
          visiblePlans.length > 0 && (
            <PlanCards
              plans={visiblePlans}
              busyPlan={busyPlan}
              onSelect={selectPlan}
              actionLabel={() =>
                implementationPaid
                  ? 'Autorizar mensalidade'
                  : 'Contratar e assinar'
              }
            />
          )}

        {!loading &&
          !subscriptionActive &&
          visiblePlans.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center font-bold text-amber-900">
              Nenhum plano disponível para esta conta. Atualize os pagamentos
              ou fale com o suporte.
            </div>
          )}

        {selectedPlan && (
          <ContractModal
            plan={selectedPlan}
            provider={contractProvider}
            form={form}
            setForm={setForm}
            termsVersion={termsVersion}
            busy={busyPlan !== null}
            errorMessage={message}
            onClose={() => setSelectedPlan(null)}
            onSubmit={createImplementationCheckout}
          />
        )}
      </main>
    </div>
  );
}

function ContractModal({
  plan,
  provider,
  form,
  setForm,
  termsVersion,
  busy,
  errorMessage,
  onClose,
  onSubmit,
}: {
  plan: CommercialPlan;
  provider: ContractProvider | null;
  form: CheckoutForm;
  setForm: (form: CheckoutForm) => void;
  termsVersion: string;
  busy: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const field = (
    key: keyof CheckoutForm,
    value: string | boolean
  ) => setForm({ ...form, [key]: value });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-2 py-2 sm:p-4">
      <form
        onSubmit={onSubmit}
        className="mx-auto min-h-[calc(100dvh-1rem)] max-w-3xl rounded-[22px] bg-white p-4 shadow-2xl sm:my-5 sm:min-h-0 sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-safe-green sm:text-xs">
              Aceite eletrônico · versão {termsVersion}
            </p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">
              Contratar {plan.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border px-3 py-2 text-sm font-black"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input label="Nome/Razão social" value={form.customerName} onChange={(value) => field('customerName', value)} minLength={3} maxLength={150} />
          <Input label="CPF/CNPJ" value={form.customerDocument} onChange={(value) => field('customerDocument', value)} minLength={11} maxLength={20} inputMode="numeric" />
          <Input label="Telefone" value={form.customerPhone} onChange={(value) => field('customerPhone', value)} />
          <Input label="CEP" value={form.postalCode} onChange={(value) => field('postalCode', value)} minLength={8} maxLength={10} inputMode="numeric" />
          <Input label="Logradouro" value={form.street} onChange={(value) => field('street', value)} minLength={3} maxLength={150} />
          <Input label="Número" value={form.number} onChange={(value) => field('number', value)} />
          <Input label="Complemento" value={form.complement} onChange={(value) => field('complement', value)} required={false} />
          <Input label="Bairro" value={form.district} onChange={(value) => field('district', value)} />
          <Input label="Cidade" value={form.city} onChange={(value) => field('city', value)} />
          <Input label="UF" value={form.state} onChange={(value) => field('state', value.toUpperCase().slice(0, 2))} minLength={2} maxLength={2} />
        </div>

        <div className="mt-5 max-h-64 overflow-y-auto rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p className="font-black text-safe-dark">Termos da contratação</p>
          <p className="mt-2">
            <strong>Contratada:</strong>{' '}
            {provider
              ? `${provider.name}, documento ${provider.document}, contato ${provider.email}`
              : 'dados jurídicos pendentes de configuração'}
            .
          </p>
          <p className="mt-2">
            <strong>Objeto:</strong> implantação assistida do plano{' '}
            {plan.name} e licença mensal do SafeKitchen Smart.
          </p>
          <p className="mt-2">
            <strong>Valores:</strong> taxa única de implantação de{' '}
            <strong>
              {(plan.setupAmountCents / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>{' '}
            e mensalidade de{' '}
            <strong>
              {(plan.amountCents / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
            . A primeira cobrança corresponde à implantação; as cobranças
            mensais seguintes serão automáticas.
          </p>
          <p className="mt-2">
            <strong>Implantação:</strong>{' '}
            {(Array.isArray(plan.implementationItems)
              ? plan.implementationItems
              : []
            ).join('; ') ||
              'Configuração inicial, cadastro do estabelecimento e treinamento de implantação'}
            .
          </p>
          <p className="mt-2">
            <strong>Prazo:</strong> atendimento remoto iniciado ou agendado em
            até {provider?.implementationDays || 15} dias úteis após o
            pagamento e o fornecimento das informações necessárias.
          </p>
          <p className="mt-2">
            <strong>Ativação:</strong> ao concluir o checkout do Mercado Pago,
            você paga a implantação e autoriza a mensalidade recorrente. Após a
            confirmação, o acesso é liberado imediatamente, sem depender do
            agendamento da implantação.
          </p>
          <p className="mt-2">
            <strong>Equipamentos:</strong> impressoras, etiquetas, termômetros e
            dispositivos não estão incluídos. Integrações dependem de
            compatibilidade técnica.
          </p>
          <p className="mt-2">
            <strong>Aceite eletrônico:</strong> versão, data, usuário, IP,
            navegador e hash SHA-256 serão registrados. O PDF será enviado
            após a confirmação do pagamento.
          </p>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) =>
              field('acceptedTerms', event.target.checked)
            }
            required
            className="mt-1"
          />
          <span>
            Li e aceito o contrato de implantação e licença mensal do
            SafeKitchen Smart. Autorizo a cobrança inicial da implantação e as
            cobranças mensais recorrentes informadas acima.
          </span>
        </label>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
          >
            {errorMessage}
          </div>
        )}

        <button
          disabled={busy || !form.acceptedTerms}
          className="mt-5 w-full rounded-2xl bg-safe-green px-5 py-4 font-black text-white disabled:opacity-50"
        >
          {busy ? 'Preparando contratação...' : 'Contratar e autorizar cobrança'}
        </button>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required = true,
  minLength,
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="text-sm font-black text-safe-dark">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        inputMode={inputMode}
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-safe-green"
      />
    </label>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-safe-soft p-3 sm:p-4">
      <Icon size={19} className="text-safe-green" />
      <p className="mt-2 break-words text-sm font-black leading-5 sm:mt-3 sm:text-lg">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
        {label}
      </p>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  text,
  action,
  positive = false,
}: {
  icon: typeof CalendarClock;
  title: string;
  text: string;
  action?: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        positive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : 'border-cyan-200 bg-cyan-50 text-cyan-950'
      }`}
    >
      <div className="flex gap-3">
        <Icon className="shrink-0" />
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1 text-sm font-medium leading-6">{text}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export default Subscription;
