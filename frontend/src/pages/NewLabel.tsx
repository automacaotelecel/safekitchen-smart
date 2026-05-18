import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Printer, Search, Sparkles } from 'lucide-react';
import { addDays, addHours, format } from 'date-fns';
import { api, API_URL, getToken } from '../api/client';
import type { ConservationMode, Employee, Label, LabelType, Product } from '../types';
import { labelTypes } from '../utils/labels';

type FormState = {
  type: LabelType;
  productId: string;
  productName: string;
  brand: string;
  supplier: string;
  batch: string;
  conservationMode: ConservationMode;
  openedAt: string;
  responsibleName: string;
  employeeId: string;
  quantity: string;
  observations: string;
  manualValidityValue: string;
  manualValidityUnit: 'days' | 'hours';
};

const initialForm: FormState = {
  type: 'PRODUTO_ABERTO',
  productId: '',
  productName: '',
  brand: '',
  supplier: '',
  batch: '',
  conservationMode: 'REFRIGERADO',
  openedAt: new Date().toISOString().slice(0, 16),
  responsibleName: '',
  employeeId: '',
  quantity: '',
  observations: '',
  manualValidityValue: '',
  manualValidityUnit: 'days'
};

export function NewLabel() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(initialForm);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [created, setCreated] = useState<Label | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Product[]>('/api/products')
      .then((data) => {
        setProducts(data);

        const productId = searchParams.get('productId');
        const product = productId ? data.find((item) => item.id === productId) : null;

        if (product) {
          setForm((old) => ({
            ...old,
            productId: product.id,
            productName: product.name,
            conservationMode: product.defaultMode
          }));
          setSearch(product.name);
        }
      })
      .catch(console.error);

    api<Employee[]>('/api/employees').then(setEmployees).catch(console.error);
  }, [searchParams]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter((p) => `${p.name} ${p.category} ${p.keywords}`.toLowerCase().includes(q)).slice(0, 12);
  }, [products, search]);

  const selectedProduct = products.find((p) => p.id === form.productId);
  const selectedRule = selectedProduct?.validityRules.find((r) => r.conservationMode === form.conservationMode) || selectedProduct?.validityRules[0];

  const previewExpiration = useMemo(() => {
    const opened = new Date(form.openedAt);
    if (Number.isNaN(opened.getTime()) || form.type === 'NAO_CONFORME') return null;
    const manual = Number(form.manualValidityValue);
    if (manual > 0) return form.manualValidityUnit === 'hours' ? addHours(opened, manual) : addDays(opened, manual);
    if (!selectedRule) return null;
    return selectedRule.validityUnit === 'hours' ? addHours(opened, selectedRule.validityValue) : addDays(opened, selectedRule.validityValue);
  }, [form.openedAt, form.manualValidityUnit, form.manualValidityValue, form.type, selectedRule]);

  function pickProduct(product: Product) {
    setForm((old) => ({
      ...old,
      productId: product.id,
      productName: product.name,
      conservationMode: product.defaultMode
    }));
    setSearch(product.name);
  }

  function pickEmployee(employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    setForm((old) => ({ ...old, employeeId, responsibleName: employee?.name || old.responsibleName }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setCreated(null);
    setLoading(true);
    try {
      const payload = {
        ...form,
        productId: form.productId || null,
        employeeId: form.employeeId || null,
        brand: form.brand || null,
        supplier: form.supplier || null,
        batch: form.batch || null,
        quantity: form.quantity || null,
        observations: form.observations || null,
        manualValidityValue: form.manualValidityValue ? Number(form.manualValidityValue) : null,
        manualValidityUnit: form.manualValidityValue ? form.manualValidityUnit : null
      };
      const label = await api<Label>('/api/labels', { method: 'POST', body: JSON.stringify(payload) });
      setCreated(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar etiqueta.');
    } finally {
      setLoading(false);
    }
  }

  function openPdf(id: string) {
    const token = getToken();
    window.open(`${API_URL}/api/labels/${id}/pdf?token=${token || ''}`, '_blank');
  }

  return (
    <div>
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Geração de etiqueta</p>
        <h1 className="mt-2 text-3xl font-black text-safe-dark lg:text-4xl">Nova etiqueta</h1>
        <p className="mt-2 text-slate-500">Pesquise o produto, informe a data e o sistema calcula a validade automaticamente.</p>
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-6 xl:grid-cols-[1fr_390px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-black text-slate-700">Tipo de etiqueta</label>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {labelTypes.map((type) => (
                  <button
                    type="button"
                    key={type.value}
                    onClick={() => setForm((old) => ({ ...old, type: type.value }))}
                    className={`rounded-2xl border p-4 text-left transition ${form.type === type.value ? 'border-safe-green bg-safe-soft' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <p className="font-black text-safe-dark">{type.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-black text-slate-700">Buscar produto</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search size={18} className="text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setForm((old) => ({ ...old, productName: e.target.value, productId: '' })); }} placeholder="Ex.: presunto fatiado, leite em pó, molho..." className="w-full bg-transparent text-sm font-semibold" />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {filteredProducts.map((product) => (
                  <button type="button" key={product.id} onClick={() => pickProduct(product)} className={`rounded-2xl border p-3 text-left ${form.productId === product.id ? 'border-safe-green bg-safe-soft' : 'border-slate-200 bg-white'}`}>
                    <p className="text-sm font-black text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.category} • {product.defaultMode}</p>
                  </button>
                ))}
              </div>
            </div>

            <Input label="Produto/produção" value={form.productName} onChange={(v) => setForm((old) => ({ ...old, productName: v }))} required />
            <Input label="Marca" value={form.brand} onChange={(v) => setForm((old) => ({ ...old, brand: v }))} />
            <Input label="Fornecedor" value={form.supplier} onChange={(v) => setForm((old) => ({ ...old, supplier: v }))} />
            <Input label="Lote" value={form.batch} onChange={(v) => setForm((old) => ({ ...old, batch: v }))} />

            <div>
              <label className="text-sm font-black text-slate-700">Modo de conservação</label>
              <select value={form.conservationMode} onChange={(e) => setForm((old) => ({ ...old, conservationMode: e.target.value as ConservationMode }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
                <option value="AMBIENTE">Temperatura ambiente</option>
                <option value="REFRIGERADO">Refrigerado</option>
                <option value="CONGELADO">Congelado</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">Aberto/manipulado em</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CalendarDays size={18} className="text-slate-400" />
                <input type="datetime-local" value={form.openedAt} onChange={(e) => setForm((old) => ({ ...old, openedAt: e.target.value }))} className="w-full bg-transparent text-sm font-semibold" />
              </div>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">Responsável</label>
              <select value={form.employeeId} onChange={(e) => pickEmployee(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
                <option value="">Selecionar funcionário</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </div>
            <Input label="Nome do responsável" value={form.responsibleName} onChange={(v) => setForm((old) => ({ ...old, responsibleName: v }))} required />
            <Input label="Quantidade" value={form.quantity} onChange={(v) => setForm((old) => ({ ...old, quantity: v }))} placeholder="Ex.: 2kg, 1 bandeja, 20 unidades" />

            <div className="grid grid-cols-[1fr_130px] gap-3">
              <Input label="Validade manual" value={form.manualValidityValue} onChange={(v) => setForm((old) => ({ ...old, manualValidityValue: v.replace(/\D/g, '') }))} placeholder="Opcional" />
              <div>
                <label className="text-sm font-black text-slate-700">Unidade</label>
                <select value={form.manualValidityUnit} onChange={(e) => setForm((old) => ({ ...old, manualValidityUnit: e.target.value as 'days' | 'hours' }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
                  <option value="days">Dias</option>
                  <option value="hours">Horas</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-black text-slate-700">Observações</label>
              <textarea value={form.observations} onChange={(e) => setForm((old) => ({ ...old, observations: e.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold" />
            </div>
          </div>

          {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

          <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-60">
            <Sparkles size={18} /> {loading ? 'Gerando...' : 'Gerar etiqueta'}
          </button>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Prévia</p>
            <div className="mt-4 overflow-hidden rounded-3xl border-2 border-safe-green bg-white">
              <div className="bg-safe-green p-4 text-white">
                <p className="text-xs font-bold uppercase">{labelTypes.find((t) => t.value === form.type)?.label}</p>
                <p className="text-xl font-black">{form.productName || 'PRODUTO'}</p>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <PreviewRow label="Conservação" value={form.conservationMode} />
                <PreviewRow label="Lote" value={form.batch || '-'} />
                <PreviewRow label="Aberto em" value={form.openedAt ? format(new Date(form.openedAt), 'dd/MM/yyyy HH:mm') : '-'} />
                <PreviewRow label="Válido até" value={previewExpiration ? format(previewExpiration, 'dd/MM/yyyy HH:mm') : '-'} />
                <PreviewRow label="Responsável" value={form.responsibleName || '-'} />
              </div>
            </div>
            {selectedRule && <p className="mt-3 text-xs text-slate-500">Regra sugerida: {selectedRule.validityValue} {selectedRule.validityUnit === 'hours' ? 'hora(s)' : 'dia(s)'} • {selectedRule.source}</p>}
          </div>

          {created && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-black text-emerald-800">Etiqueta gerada com sucesso!</p>
              <p className="mt-1 text-sm text-emerald-700">Agora você pode abrir o PDF para imprimir ou consultar no histórico.</p>
              <button type="button" onClick={() => openPdf(created.id)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">
                <Printer size={18} /> Abrir PDF
              </button>
              <Link to="/historico" className="mt-3 block text-center text-sm font-black text-emerald-700">Ver histórico</Link>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700">{label}</label>
      <input required={required} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold" />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-black text-slate-900">{value}</span></div>;
}
