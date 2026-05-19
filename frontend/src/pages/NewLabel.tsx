import { FormEvent, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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

type ExtraState = {
  nonConformities: string[];
  nonConformityOther: string;
  identifiedAt: string;
  actionsTaken: string[];
  restaurantName: string;
  chemicalPurposes: string[];
  dilutionMl: string;
  dilutionWaterL: string;
  chemicalPreparedAt: string;
  chemicalValidityAt: string;
  thawingMethod: string;
  meatType: string;
  mapaSif: string;
  receivedAt: string;
  storageType: string;
  repackagedAt: string;
  originalValidityAt: string;
  newValidityAt: string;
};

const nowLocal = () => new Date().toISOString().slice(0, 16);
const todayLocal = () => new Date().toISOString().slice(0, 10);

const initialForm: FormState = {
  type: 'PRODUTO_ABERTO',
  productId: '',
  productName: '',
  brand: '',
  supplier: '',
  batch: '',
  conservationMode: 'REFRIGERADO',
  openedAt: nowLocal(),
  responsibleName: '',
  employeeId: '',
  quantity: '',
  observations: '',
  manualValidityValue: '',
  manualValidityUnit: 'days'
};

const initialExtra: ExtraState = {
  nonConformities: [],
  nonConformityOther: '',
  identifiedAt: todayLocal(),
  actionsTaken: [],
  restaurantName: '',
  chemicalPurposes: [],
  dilutionMl: '',
  dilutionWaterL: '',
  chemicalPreparedAt: nowLocal(),
  chemicalValidityAt: '',
  thawingMethod: '',
  meatType: '',
  mapaSif: '',
  receivedAt: todayLocal(),
  storageType: '',
  repackagedAt: todayLocal(),
  originalValidityAt: '',
  newValidityAt: ''
};

const nonConformityOptions = [
  'Vencido',
  'Temperatura inadequada',
  'Embalagem violada',
  'Contaminação',
  'Sem identificação'
];

const actionOptions = ['Descarte', 'Devolução fornecedor', 'Avaliação responsável técnico'];
const chemicalPurposeOptions = ['Higienização', 'Desinfecção', 'Limpeza pesada'];
const meatTypeOptions = ['Bovino', 'Frango', 'Suíno', 'Peixe'];
const storageTypeOptions = ['Resfriado', 'Congelado'];
const thawingMethodOptions = ['Refrigerado (0°C a 5°C)', 'Micro-ondas', 'Água corrente controlada'];

export function NewLabel() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(initialForm);
  const [extra, setExtra] = useState<ExtraState>(initialExtra);
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
    return products
      .filter((product) => `${product.name} ${product.category} ${product.keywords}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [products, search]);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedRule =
    selectedProduct?.validityRules.find((rule) => rule.conservationMode === form.conservationMode) ||
    selectedProduct?.validityRules[0];

  const previewExpiration = useMemo(() => {
    const opened = new Date(form.openedAt);
    if (Number.isNaN(opened.getTime()) || form.type === 'NAO_CONFORME') return null;
    if (form.type === 'AMOSTRAS') return addHours(opened, 72);

    if (form.type === 'PRODUTO_QUIMICO' && extra.chemicalValidityAt) {
      const chemicalDate = new Date(extra.chemicalValidityAt);
      return Number.isNaN(chemicalDate.getTime()) ? null : chemicalDate;
    }

    if (form.type === 'REEMBALAGEM' && extra.newValidityAt) {
      const newValidity = new Date(extra.newValidityAt);
      return Number.isNaN(newValidity.getTime()) ? null : newValidity;
    }

    const manual = Number(form.manualValidityValue);
    if (manual > 0) {
      return form.manualValidityUnit === 'hours' ? addHours(opened, manual) : addDays(opened, manual);
    }

    if (!selectedRule) return null;
    return selectedRule.validityUnit === 'hours'
      ? addHours(opened, selectedRule.validityValue)
      : addDays(opened, selectedRule.validityValue);
  }, [extra.chemicalValidityAt, extra.newValidityAt, form.manualValidityUnit, form.manualValidityValue, form.openedAt, form.type, selectedRule]);

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

  function setType(type: LabelType) {
    setForm((old) => {
      let conservationMode = old.conservationMode;
      if (type === 'AMOSTRAS' && old.conservationMode === 'AMBIENTE') conservationMode = 'REFRIGERADO';
      if (type === 'ARMAZENAMENTO_CARNES' && old.conservationMode === 'AMBIENTE') conservationMode = 'REFRIGERADO';
      return { ...old, type, conservationMode };
    });
  }

  function toggleExtraList(field: 'nonConformities' | 'actionsTaken' | 'chemicalPurposes', value: string) {
    setExtra((old) => {
      const current = old[field];
      return {
        ...old,
        [field]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
      };
    });
  }

  function buildExtraData() {
    if (form.type === 'NAO_CONFORME') {
      return {
        nonConformities: extra.nonConformities,
        nonConformityOther: extra.nonConformityOther || null,
        identifiedAt: extra.identifiedAt || form.openedAt,
        actionsTaken: extra.actionsTaken
      };
    }

    if (form.type === 'AMOSTRAS') {
      return {
        restaurantName: extra.restaurantName || null,
        discardAt: previewExpiration ? previewExpiration.toISOString() : null
      };
    }

    if (form.type === 'PRODUTO_QUIMICO') {
      return {
        chemicalPurposes: extra.chemicalPurposes,
        dilutionMl: extra.dilutionMl || null,
        dilutionWaterL: extra.dilutionWaterL || null,
        chemicalPreparedAt: extra.chemicalPreparedAt || form.openedAt,
        chemicalValidityAt: extra.chemicalValidityAt || null
      };
    }

    if (form.type === 'DESCONGELAMENTO_DESSALGUE') {
      return {
        thawingMethod: extra.thawingMethod || null
      };
    }

    if (form.type === 'ARMAZENAMENTO_CARNES') {
      return {
        meatType: extra.meatType || null,
        mapaSif: extra.mapaSif || null,
        receivedAt: extra.receivedAt || form.openedAt,
        storageType: extra.storageType || null
      };
    }

    if (form.type === 'REEMBALAGEM') {
      return {
        repackagedAt: extra.repackagedAt || form.openedAt,
        originalValidityAt: extra.originalValidityAt || null,
        newValidityAt: extra.newValidityAt || null
      };
    }

    return {};
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
        manualValidityUnit: form.manualValidityValue ? form.manualValidityUnit : null,
        extraData: buildExtraData()
      };

      const label = await api<Label>('/api/labels', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

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
        <p className="mt-2 text-slate-500">Escolha o tipo de etiqueta, preencha os campos específicos e gere o PDF.</p>
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
                    onClick={() => setType(type.value)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      form.type === type.value ? 'border-safe-green bg-safe-soft' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
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
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setForm((old) => ({ ...old, productName: event.target.value, productId: '' }));
                  }}
                  placeholder="Ex.: presunto fatiado, leite em pó, molho..."
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => pickProduct(product)}
                    className={`rounded-2xl border p-3 text-left ${form.productId === product.id ? 'border-safe-green bg-safe-soft' : 'border-slate-200 bg-white'}`}
                  >
                    <p className="text-sm font-black text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.category} • {product.defaultMode}</p>
                  </button>
                ))}
              </div>
            </div>

            <Input label={productLabel(form.type)} value={form.productName} onChange={(value) => setForm((old) => ({ ...old, productName: value }))} required />
            <Input label="Marca" value={form.brand} onChange={(value) => setForm((old) => ({ ...old, brand: value }))} />
            <Input label="Fornecedor" value={form.supplier} onChange={(value) => setForm((old) => ({ ...old, supplier: value }))} />
            <Input label="Lote" value={form.batch} onChange={(value) => setForm((old) => ({ ...old, batch: value }))} />

            <ConservationField form={form} setForm={setForm} />

            <div>
              <label className="text-sm font-black text-slate-700">{dateLabel(form.type)}</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CalendarDays size={18} className="text-slate-400" />
                <input
                  type="datetime-local"
                  value={form.openedAt}
                  onChange={(event) => setForm((old) => ({ ...old, openedAt: event.target.value }))}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">Responsável</label>
              <select value={form.employeeId} onChange={(event) => pickEmployee(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
                <option value="">Selecionar funcionário</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </div>

            <Input label="Nome do responsável" value={form.responsibleName} onChange={(value) => setForm((old) => ({ ...old, responsibleName: value }))} required />
            <Input label="Quantidade" value={form.quantity} onChange={(value) => setForm((old) => ({ ...old, quantity: value }))} placeholder="Ex.: 2kg, 1 bandeja, 20 unidades" />

            {form.type !== 'NAO_CONFORME' && form.type !== 'AMOSTRAS' && (
              <div className="grid grid-cols-[1fr_130px] gap-3">
                <Input
                  label="Validade manual"
                  value={form.manualValidityValue}
                  onChange={(value) => setForm((old) => ({ ...old, manualValidityValue: value.replace(/\D/g, '') }))}
                  placeholder="Opcional"
                />
                <div>
                  <label className="text-sm font-black text-slate-700">Unidade</label>
                  <select
                    value={form.manualValidityUnit}
                    onChange={(event) => setForm((old) => ({ ...old, manualValidityUnit: event.target.value as 'days' | 'hours' }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
                  >
                    <option value="days">Dias</option>
                    <option value="hours">Horas</option>
                  </select>
                </div>
              </div>
            )}

            <TypeSpecificFields form={form} extra={extra} setExtra={setExtra} toggleExtraList={toggleExtraList} />

            <div className="md:col-span-2">
              <label className="text-sm font-black text-slate-700">Observações</label>
              <textarea
                value={form.observations}
                onChange={(event) => setForm((old) => ({ ...old, observations: event.target.value }))}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
              />
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
                <p className="text-xs font-bold uppercase">{labelTypes.find((type) => type.value === form.type)?.label}</p>
                <p className="text-xl font-black">{form.productName || 'PRODUTO'}</p>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <PreviewRow label="Conservação" value={form.conservationMode} />
                <PreviewRow label="Lote" value={form.batch || '-'} />
                <PreviewRow label={dateLabel(form.type).replace(' em', '')} value={form.openedAt ? format(new Date(form.openedAt), 'dd/MM/yyyy HH:mm') : '-'} />
                <PreviewRow label={form.type === 'AMOSTRAS' ? 'Descarte em' : 'Válido até'} value={previewExpiration ? format(previewExpiration, 'dd/MM/yyyy HH:mm') : '-'} />
                <PreviewRow label="Responsável" value={form.responsibleName || '-'} />
              </div>
            </div>
            {selectedRule && form.type !== 'AMOSTRAS' && form.type !== 'NAO_CONFORME' && (
              <p className="mt-3 text-xs text-slate-500">Regra sugerida: {selectedRule.validityValue} {selectedRule.validityUnit === 'hours' ? 'hora(s)' : 'dia(s)'} • {selectedRule.source}</p>
            )}
            {form.type === 'AMOSTRAS' && <p className="mt-3 text-xs text-slate-500">Amostras: descarte automático 72 horas após a coleta.</p>}
            {form.type === 'NAO_CONFORME' && <p className="mt-3 text-xs text-slate-500">Não conforme: etiqueta de segregação/bloqueio, sem cálculo de validade.</p>}
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

function TypeSpecificFields({
  form,
  extra,
  setExtra,
  toggleExtraList
}: {
  form: FormState;
  extra: ExtraState;
  setExtra: Dispatch<SetStateAction<ExtraState>>;
  toggleExtraList: (field: 'nonConformities' | 'actionsTaken' | 'chemicalPurposes', value: string) => void;
}) {
  if (form.type === 'NAO_CONFORME') {
    return (
      <div className="md:col-span-2 rounded-3xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-red-700">Produto segregado — não conforme</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <DateInput label="Data identificação" value={extra.identifiedAt} onChange={(value) => setExtra((old) => ({ ...old, identifiedAt: value }))} />
          <CheckboxGroup title="Não conformidade" options={nonConformityOptions} selected={extra.nonConformities} onToggle={(value) => toggleExtraList('nonConformities', value)} />
          <Input label="Outro motivo" value={extra.nonConformityOther} onChange={(value) => setExtra((old) => ({ ...old, nonConformityOther: value }))} />
          <CheckboxGroup title="Ação tomada" options={actionOptions} selected={extra.actionsTaken} onToggle={(value) => toggleExtraList('actionsTaken', value)} />
        </div>
      </div>
    );
  }

  if (form.type === 'AMOSTRAS') {
    return (
      <div className="md:col-span-2 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">Amostras</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input label="Nome do restaurante" value={extra.restaurantName} onChange={(value) => setExtra((old) => ({ ...old, restaurantName: value }))} placeholder="Opcional; se vazio, usa o cadastro" />
          <div>
            <label className="text-sm font-black text-slate-700">Conservação da amostra</label>
            <select value={form.conservationMode} disabled className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
              <option>{form.conservationMode}</option>
            </select>
            <p className="mt-2 text-xs font-semibold text-slate-500">Use o campo “Modo de conservação” acima para alternar entre Refrigerado e Congelado.</p>
          </div>
          <div className="md:col-span-2 rounded-2xl bg-white p-3 text-sm font-bold text-emerald-700">O descarte será calculado automaticamente em 72 horas após a coleta.</div>
        </div>
      </div>
    );
  }

  if (form.type === 'PRODUTO_QUIMICO') {
    return (
      <div className="md:col-span-2 rounded-3xl border border-cyan-200 bg-cyan-50 p-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-800">Produto químico</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CheckboxGroup title="Finalidade" options={chemicalPurposeOptions} selected={extra.chemicalPurposes} onToggle={(value) => toggleExtraList('chemicalPurposes', value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Diluição mL" value={extra.dilutionMl} onChange={(value) => setExtra((old) => ({ ...old, dilutionMl: value.replace(/[^0-9,.]/g, '') }))} />
            <Input label="Litros de água" value={extra.dilutionWaterL} onChange={(value) => setExtra((old) => ({ ...old, dilutionWaterL: value.replace(/[^0-9,.]/g, '') }))} />
          </div>
          <DateTimeInput label="Data/hora preparo" value={extra.chemicalPreparedAt} onChange={(value) => setExtra((old) => ({ ...old, chemicalPreparedAt: value }))} />
          <DateInput label="Validade do químico" value={extra.chemicalValidityAt} onChange={(value) => setExtra((old) => ({ ...old, chemicalValidityAt: value }))} />
        </div>
      </div>
    );
  }

  if (form.type === 'DESCONGELAMENTO_DESSALGUE') {
    return (
      <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">Descongelamento / dessalgue</p>
        <RadioCards label="Método" options={thawingMethodOptions} value={extra.thawingMethod} onChange={(value) => setExtra((old) => ({ ...old, thawingMethod: value }))} />
      </div>
    );
  }

  if (form.type === 'ARMAZENAMENTO_CARNES') {
    return (
      <div className="md:col-span-2 rounded-3xl border border-orange-200 bg-orange-50 p-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-800">Armazenamento de carnes</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <RadioCards label="Tipo" options={meatTypeOptions} value={extra.meatType} onChange={(value) => setExtra((old) => ({ ...old, meatType: value }))} />
          <RadioCards label="Armazenamento" options={storageTypeOptions} value={extra.storageType} onChange={(value) => setExtra((old) => ({ ...old, storageType: value }))} />
          <Input label="Rastreabilidade MAPA/SIF" value={extra.mapaSif} onChange={(value) => setExtra((old) => ({ ...old, mapaSif: value }))} />
          <DateInput label="Data recebimento" value={extra.receivedAt} onChange={(value) => setExtra((old) => ({ ...old, receivedAt: value }))} />
        </div>
      </div>
    );
  }

  if (form.type === 'REEMBALAGEM') {
    return (
      <div className="md:col-span-2 rounded-3xl border border-purple-200 bg-purple-50 p-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-purple-800">Reembalagem</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <DateInput label="Data reembalagem" value={extra.repackagedAt} onChange={(value) => setExtra((old) => ({ ...old, repackagedAt: value }))} />
          <DateInput label="Validade original" value={extra.originalValidityAt} onChange={(value) => setExtra((old) => ({ ...old, originalValidityAt: value }))} />
          <DateInput label="Nova validade" value={extra.newValidityAt} onChange={(value) => setExtra((old) => ({ ...old, newValidityAt: value }))} />
        </div>
      </div>
    );
  }

  return null;
}

function ConservationField({ form, setForm }: { form: FormState; setForm: Dispatch<SetStateAction<FormState>> }) {
  const options = form.type === 'AMOSTRAS' || form.type === 'ARMAZENAMENTO_CARNES'
    ? [
        { value: 'REFRIGERADO', label: 'Refrigerado' },
        { value: 'CONGELADO', label: 'Congelado' }
      ]
    : [
        { value: 'AMBIENTE', label: 'Temperatura ambiente' },
        { value: 'REFRIGERADO', label: 'Refrigerado' },
        { value: 'CONGELADO', label: 'Congelado' }
      ];

  return (
    <div>
      <label className="text-sm font-black text-slate-700">Modo de conservação</label>
      <select
        value={form.conservationMode}
        onChange={(event) => setForm((old) => ({ ...old, conservationMode: event.target.value as ConservationMode }))}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function Input({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700">{label}</label>
      <input required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none" />
    </div>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700">{label}</label>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none" />
    </div>
  );
}

function DateTimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700">{label}</label>
      <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none" />
    </div>
  );
}

function CheckboxGroup({ title, options, selected, onToggle }: { title: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <p className="text-sm font-black text-slate-700">{title}</p>
      <div className="mt-2 grid gap-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} className="h-4 w-4 accent-emerald-600" />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function RadioCards({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="text-sm font-black text-slate-700">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-2xl border px-3 py-2 text-left text-sm font-bold transition ${value === option ? 'border-safe-green bg-white text-safe-green' : 'border-slate-200 bg-white/70 text-slate-600'}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-900">{value}</span>
    </div>
  );
}

function productLabel(type: LabelType) {
  if (type === 'PRODUTO_ABERTO') return 'Produto industrializado aberto';
  if (type === 'PRODUCAO') return 'Produto manipulado/preparado';
  if (type === 'DESCONGELAMENTO_DESSALGUE') return 'Produto';
  if (type === 'ARMAZENAMENTO_CARNES') return 'Produto/carne';
  if (type === 'REEMBALAGEM') return 'Produto reembalado';
  if (type === 'PRODUTO_QUIMICO') return 'Produto químico';
  return 'Produto';
}

function dateLabel(type: LabelType) {
  if (type === 'AMOSTRAS') return 'Data/hora da coleta';
  if (type === 'DESCONGELAMENTO_DESSALGUE') return 'Data/hora início';
  if (type === 'PRODUCAO') return 'Produzido em';
  if (type === 'REEMBALAGEM') return 'Data/hora reembalagem';
  if (type === 'NAO_CONFORME') return 'Data/hora identificação';
  if (type === 'PRODUTO_QUIMICO') return 'Data/hora preparo';
  return 'Aberto/manipulado em';
}

export default NewLabel;
