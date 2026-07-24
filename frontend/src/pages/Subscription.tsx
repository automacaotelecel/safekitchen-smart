import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, Download, FileCheck2, LogOut, PackageCheck, RefreshCcw, Send, Settings, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { API_URL, api, clearToken, getToken } from '../api/client';
import { PlanCards } from '../components/PlanCards';
import type { CommercialContractInfo, CommercialPlan, KitOrderInfo, PlanCode, SubscriptionInfo } from '../types';

type BillingState = {
  enabled: boolean;
  contractConfigured: boolean;
  restaurant: { plan: string; subscriptionStatus: string; trialEndsAt?: string | null; subscriptionEndsAt?: string | null } | null;
  subscription: SubscriptionInfo | null;
  kitOrder: KitOrderInfo | null;
  contract: CommercialContractInfo | null;
};

type CheckoutForm = {
  customerName: string; customerDocument: string; customerPhone: string;
  postalCode: string; street: string; number: string; complement: string;
  district: string; city: string; state: string; acceptedTerms: boolean;
};

const emptyForm: CheckoutForm = {
  customerName: '', customerDocument: '', customerPhone: '', postalCode: '', street: '', number: '',
  complement: '', district: '', city: '', state: '', acceptedTerms: false,
};
type ContractProvider = { name: string; document: string; email: string; city: string; deliveryDays: number };

function redirectToCheckout(checkoutUrl: unknown) {
  if (typeof checkoutUrl !== 'string' || !checkoutUrl.trim()) {
    throw new Error('O Mercado Pago não devolveu o link de pagamento. Tente novamente.');
  }

  let destination: URL;
  try {
    destination = new URL(checkoutUrl);
  } catch {
    throw new Error('O link de pagamento recebido é inválido. Tente novamente.');
  }

  if (destination.protocol !== 'https:') {
    throw new Error('O link de pagamento recebido não é seguro. Fale com o suporte.');
  }

  window.location.assign(destination.toString());
}

export function Subscription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [termsVersion, setTermsVersion] = useState('');
  const [contractProvider, setContractProvider] = useState<ContractProvider | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CommercialPlan | null>(null);
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [busyPlan, setBusyPlan] = useState<PlanCode | null>(null);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(syncSubscription = false) {
    setLoading(true);
    setMessage('');
    try {
      const paymentId = searchParams.get('payment_id');
      if (paymentId && searchParams.get('kit') === 'approved') {
        await api('/api/billing/kit-sync', { method: 'POST', body: JSON.stringify({ paymentId }) });
        window.history.replaceState({}, '', '/assinatura');
      }
      if (syncSubscription) await api('/api/billing/sync', { method: 'POST' });
      const [planData, state] = await Promise.all([
        api<{ plans: CommercialPlan[]; contractTermsVersion: string; contractProvider: ContractProvider | null }>('/api/billing/plans'),
        api<BillingState>('/api/billing/subscription'),
      ]);
      setPlans(Array.isArray(planData?.plans) ? planData.plans : []);
      setTermsVersion(typeof planData?.contractTermsVersion === 'string' ? planData.contractTermsVersion : '');
      setContractProvider(planData?.contractProvider || null);
      setBilling(state || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar contratação.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(searchParams.get('checkout') === 'retorno'); }, []);

  async function selectPlan(plan: CommercialPlan) {
    setMessage('');
    setCheckoutError('');
    const kit = billing?.kitOrder;
    if (kit?.status === 'APPROVED') {
      if (!kit.deliveredAt) {
        setMessage('Confirme o recebimento do kit antes de assinar a mensalidade.');
        return;
      }
      if (kit.planCode !== plan.code) {
        setMessage('O kit pago pertence a outro plano. Fale com o suporte para realizar um upgrade de equipamentos.');
        return;
      }
      setBusyPlan(plan.code);
      try {
        const data = await api<{ checkoutUrl: string }>('/api/billing/checkout', {
          method: 'POST', body: JSON.stringify({ planCode: plan.code }),
        });
        redirectToCheckout(data.checkoutUrl);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao autorizar mensalidade.');
      } finally { setBusyPlan(null); }
      return;
    }

    if (!billing?.enabled) {
      setMessage('Os pagamentos ainda não estão habilitados. Fale com o suporte antes de contratar.');
      return;
    }

    if (!billing.contractConfigured) {
      setMessage('A contratação está temporariamente indisponível. Os dados do contrato precisam ser configurados.');
      return;
    }

    setSelectedPlan(plan);
  }

  async function createKitCheckout(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlan) return;
    setBusyPlan(selectedPlan.code);
    setMessage('');
    setCheckoutError('');
    try {
      const data = await api<{ checkoutUrl: string }>('/api/billing/kit-checkout', {
        method: 'POST',
        body: JSON.stringify({
          planCode: selectedPlan.code,
          customerName: form.customerName,
          customerDocument: form.customerDocument,
          customerPhone: form.customerPhone || undefined,
          acceptedTerms: form.acceptedTerms,
          termsVersion,
          deliveryAddress: {
            postalCode: form.postalCode, street: form.street, number: form.number,
            complement: form.complement || undefined, district: form.district,
            city: form.city, state: form.state,
          },
        }),
      });
      redirectToCheckout(data.checkoutUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar pagamento do kit.';
      setCheckoutError(errorMessage);
      setMessage(errorMessage);
    } finally { setBusyPlan(null); }
  }

  async function cancel() {
    if (!window.confirm('Cancelar a assinatura agora? O acesso pago será encerrado imediatamente.')) return;
    setBusyAction('cancel');
    try { await api('/api/billing/cancel', { method: 'POST' }); setMessage('Assinatura cancelada.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao cancelar assinatura.'); }
    finally { setBusyAction(''); }
  }

  async function confirmDelivery() {
    if (!window.confirm('Confirma que o kit SafeKitchen foi recebido?')) return;
    setBusyAction('delivery');
    setMessage('');
    try {
      await api('/api/billing/kit-confirm-delivery', { method: 'POST' });
      await load();
      setMessage('Recebimento confirmado. Seu acesso operacional foi liberado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao confirmar recebimento.');
    } finally {
      setBusyAction('');
    }
  }

  async function downloadContract() {
    setBusyAction('download');
    try {
      const response = await fetch(`${API_URL}/api/billing/contract/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error('Não foi possível baixar o contrato.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${billing?.contract?.contractNumber || 'contrato-safekitchen'}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao baixar contrato.'); }
    finally { setBusyAction(''); }
  }

  async function resendContract() {
    setBusyAction('resend');
    try { await api('/api/billing/contract/resend', { method: 'POST' }); setMessage('Contrato reenviado por e-mail.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao reenviar contrato.'); }
    finally { setBusyAction(''); }
  }

  const kitPaid = billing?.kitOrder?.status === 'APPROVED';
  const kitDelivered = Boolean(billing?.kitOrder?.deliveredAt);
  const subscriptionActive = billing?.subscription?.status === 'ACTIVE';
  const operationalAccess = billing?.restaurant?.subscriptionStatus === 'ACTIVE';
  const visiblePlans = kitPaid ? plans.filter((plan) => plan.code === billing?.kitOrder?.planCode) : plans;

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f4f8f8] text-safe-dark">
      <header className="border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/safekitchen-logo.png" alt="SafeKitchen Smart" className="h-12 w-12 rounded-2xl object-contain" />
            <div>
              <p className="font-black text-safe-dark">SafeKitchen Smart</p>
              <p className="text-xs font-bold uppercase tracking-wider text-safe-green">
                {operationalAccess ? 'Plano e cobrança' : 'Portal de contratação'}
              </p>
            </div>
          </div>
          <div className={`grid gap-2 sm:flex sm:flex-wrap ${operationalAccess ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {operationalAccess && (
              <>
                <Link to="/painel" className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black">
                  <ArrowLeft size={15} /> Voltar ao sistema
                </Link>
                <Link to="/conta" className="inline-flex items-center justify-center gap-2 rounded-xl bg-safe-dark px-3 py-2 text-xs font-black text-white">
                  <Settings size={15} /> Administração
                </Link>
              </>
            )}
            <button type="button" onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black text-red-600">
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-safe-green sm:text-xs sm:tracking-[0.26em]">Kit e mensalidade</p><h1 className="mt-2 text-2xl font-black text-safe-dark sm:text-3xl">Sua contratação</h1><p className="mt-2 text-sm font-medium text-slate-500">Pagamento seguro, assinatura recorrente e contrato eletrônico.</p></div>
          <button onClick={() => load(subscriptionActive)} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"><RefreshCcw size={17} /> Atualizar pagamentos</button>
        </div>

        {!billing?.contractConfigured && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Configure os dados jurídicos do contrato no backend antes de vender kits.</div>}
        {message && <div role="alert" aria-live="polite" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div>}

        {loading && <div className="mt-5 rounded-2xl bg-safe-soft p-4 text-sm font-bold text-safe-dark">Carregando dados da contratação...</div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard icon={kitPaid ? CheckCircle2 : PackageCheck} label="Kit" value={kitPaid ? 'PAGO' : billing?.kitOrder?.status || 'NÃO CONTRATADO'} />
          <StatusCard icon={kitDelivered ? CheckCircle2 : PackageCheck} label="Entrega" value={kitDelivered ? 'RECEBIDO' : kitPaid ? 'EM PREPARAÇÃO/ENVIO' : 'AGUARDANDO PAGAMENTO'} />
          <StatusCard icon={subscriptionActive ? CheckCircle2 : CreditCard} label="Mensalidade" value={billing?.subscription?.status || 'NÃO AUTORIZADA'} />
          <StatusCard icon={billing?.contract?.status === 'ACTIVE' ? FileCheck2 : XCircle} label="Contrato" value={billing?.contract?.status === 'ACTIVE' ? billing.contract.contractNumber : 'AGUARDANDO'} />
        </div>

        {billing?.kitOrder?.status === 'PENDING' && billing.kitOrder.checkoutUrl && <a href={billing.kitOrder.checkoutUrl} className="mt-5 inline-flex w-full justify-center rounded-2xl bg-safe-dark px-5 py-3 text-sm font-black text-white sm:w-auto">Continuar pagamento do kit</a>}
        {billing?.contract?.status === 'ACTIVE' && <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap"><button onClick={downloadContract} disabled={Boolean(busyAction)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white"><Download size={17} /> Baixar contrato</button><button onClick={resendContract} disabled={Boolean(busyAction)} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"><Send size={17} /> Reenviar por e-mail</button></div>}
        {subscriptionActive && <button onClick={cancel} disabled={busyAction === 'cancel'} className="mt-5 block text-sm font-black text-red-600 hover:underline">Cancelar assinatura</button>}
      </section>

      {kitPaid && kitDelivered && !subscriptionActive && <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="shrink-0" /><div><p className="font-black">Kit recebido</p><p className="text-sm">Agora assine a mensalidade abaixo para concluir a contratação e liberar o sistema.</p></div></div>}
      {kitPaid && !kitDelivered && <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-cyan-950"><div className="flex gap-3"><PackageCheck className="shrink-0" /><div><p className="font-black">Kit pago — aguardando recebimento</p><p className="mt-1 text-sm font-medium">Quando o kit chegar ao estabelecimento, confirme abaixo. A mensalidade somente será autorizada depois dessa etapa.</p></div></div><button type="button" onClick={confirmDelivery} disabled={busyAction === 'delivery'} className="mt-4 rounded-2xl bg-safe-dark px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busyAction === 'delivery' ? 'Confirmando...' : 'Confirmar recebimento do kit'}</button></div>}
      {searchParams.get('kit') === 'failure' && <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><AlertTriangle /><p className="font-bold">O pagamento do kit não foi concluído. Você pode tentar novamente.</p></div>}

      {!loading && !subscriptionActive && (!kitPaid || kitDelivered) && visiblePlans.length > 0 && <PlanCards plans={visiblePlans} busyPlan={busyPlan} onSelect={selectPlan} actionLabel={() => kitPaid ? 'Assinar mensalidade' : 'Contratar'} />}

      {!loading && !subscriptionActive && (!kitPaid || kitDelivered) && visiblePlans.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center font-bold text-amber-900">
          Não foi possível encontrar um plano disponível para esta conta. Atualize os pagamentos ou fale com o suporte.
        </div>
      )}

      {selectedPlan && <ContractModal plan={selectedPlan} provider={contractProvider} form={form} setForm={setForm} termsVersion={termsVersion} busy={busyPlan !== null} error={checkoutError} onClose={() => { setSelectedPlan(null); setCheckoutError(''); }} onSubmit={createKitCheckout} />}
      </main>
    </div>
  );
}

function ContractModal({ plan, provider, form, setForm, termsVersion, busy, error, onClose, onSubmit }: { plan: CommercialPlan; provider: ContractProvider | null; form: CheckoutForm; setForm: (form: CheckoutForm) => void; termsVersion: string; busy: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const field = (key: keyof CheckoutForm, value: string | boolean) => setForm({ ...form, [key]: value });
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-2 py-3 sm:p-4"><form onSubmit={onSubmit} className="mx-auto my-2 max-w-3xl rounded-[24px] bg-white p-4 shadow-2xl sm:my-6 sm:rounded-[28px] sm:p-6 md:p-7"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-safe-green sm:text-xs">Aceite eletrônico · versão {termsVersion}</p><h2 className="mt-2 text-xl font-black sm:text-2xl">Contratar {plan.name}</h2></div><button type="button" onClick={onClose} disabled={busy} className="shrink-0 rounded-xl border px-3 py-2 text-sm font-black disabled:opacity-50">Fechar</button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="Nome/Razão social" value={form.customerName} onChange={(v) => field('customerName', v)} /><Input label="CPF/CNPJ" value={form.customerDocument} onChange={(v) => field('customerDocument', v)} /><Input label="Telefone" value={form.customerPhone} onChange={(v) => field('customerPhone', v)} /><Input label="CEP" value={form.postalCode} onChange={(v) => field('postalCode', v)} /><Input label="Logradouro" value={form.street} onChange={(v) => field('street', v)} /><Input label="Número" value={form.number} onChange={(v) => field('number', v)} /><Input label="Complemento" value={form.complement} onChange={(v) => field('complement', v)} required={false} /><Input label="Bairro" value={form.district} onChange={(v) => field('district', v)} /><Input label="Cidade" value={form.city} onChange={(v) => field('city', v)} /><Input label="UF" value={form.state} onChange={(v) => field('state', v.toUpperCase().slice(0, 2))} /></div>
    <div className="mt-5 max-h-56 overflow-y-auto rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-slate-600 sm:max-h-64"><p className="font-black text-safe-dark">Termos da contratação</p><p className="mt-2"><strong>Contratada:</strong> {provider ? `${provider.name}, documento ${provider.document}, contato ${provider.email}` : 'dados jurídicos pendentes de configuração'}.</p><p className="mt-2"><strong>Objeto:</strong> fornecimento do kit {plan.name}, implantação e licença mensal, pessoal e não transferível do SafeKitchen Smart. O software é assistivo e não substitui a responsabilidade técnica ou sanitária do estabelecimento.</p><p className="mt-2"><strong>Valores:</strong> pagamento inicial de <strong>{(plan.setupAmountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> e mensalidade recorrente de <strong>{(plan.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>.</p><p className="mt-2"><strong>Kit:</strong> {plan.kitItems.join('; ')}.</p><p className="mt-2"><strong>Ativação e entrega:</strong> o acesso operacional será liberado após a confirmação do pagamento do kit, autorização da mensalidade e confirmação de recebimento pelo contratante. Prazo estimado de despacho: até {provider?.deliveryDays || 15} dias úteis, ressalvadas indisponibilidades comunicadas.</p><p className="mt-2"><strong>Vigência e cancelamento:</strong> licença por prazo indeterminado, renovada mensalmente. O cancelamento interrompe cobranças futuras e preserva obrigações vencidas e direitos legais de devolução ou arrependimento quando aplicáveis.</p><p className="mt-2"><strong>Equipamentos:</strong> uso conforme manuais; garantias legais e do fabricante são preservadas. Mau uso e danos externos não ficam cobertos além do exigido por lei.</p><p className="mt-2"><strong>Dados e segurança:</strong> os dados serão tratados para executar o contrato, suporte, pagamentos e alertas. O contratante controla os acessos de sua equipe e declara possuir base legal para os dados inseridos.</p><p className="mt-2"><strong>Aceite eletrônico:</strong> serão registrados versão, data, usuário, IP, navegador e hash SHA-256. O PDF final será enviado ao e-mail do administrador após a conclusão da contratação e ativação.</p></div>
    <label className="mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold"><input type="checkbox" checked={form.acceptedTerms} onChange={(e) => field('acceptedTerms', e.target.checked)} required className="mt-1" /><span>Li e aceito o contrato de fornecimento do kit e licença mensal do SafeKitchen Smart, autorizando o registro eletrônico deste aceite.</span></label>
    {error && <div role="alert" aria-live="assertive" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><p>Não foi possível abrir o pagamento.</p><p className="mt-1 font-semibold">{error}</p></div>}
    <button disabled={busy || !form.acceptedTerms} className="mt-5 w-full rounded-2xl bg-safe-green px-5 py-4 font-black text-white disabled:opacity-50">{busy ? 'Preparando contratação...' : 'Contratar'}</button>
  </form></div>;
}

function Input({ label, value, onChange, required = true }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="text-sm font-black text-safe-dark">{label}<input value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-safe-green" /></label>; }
function StatusCard({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) { return <div className="rounded-2xl bg-safe-soft p-4"><Icon size={20} className="text-safe-green" /><p className="mt-3 break-words text-lg font-black">{value}</p><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p></div>; }
