import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Printer,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { addDays, addHours, format } from 'date-fns';

import { api, API_URL, getToken } from '../api/client';
import { shareOrOpenPdfFromUrl } from '../utils/printPdf';
import type {
  ConservationMode,
  Employee,
  Label,
  LabelType,
  Product,
} from '../types';
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
  receivingTemperatureC: string;
};

type ExtraState = {
  restaurantName: string;
  sampleShift: string;

  collectionDate: string;
  collectionTime: string;

  chemicalPurpose: string;
  dilutionMl: string;
  dilutionLiters: string;
  preparationDate: string;
  preparationTime: string;
  chemicalValidity: string;

  nonConformityReasons: string[];
  otherNonConformity: string;
  identificationDate: string;
  actionTaken: string[];

  thawingMethod: string;
  startDate: string;
  startTime: string;

  meatType: string;
  mapaSif: string;
  receiptDate: string;
  storageType: string;

  repackagingDate: string;
  originalValidity: string;
  newValidity: string;
};

const now = new Date();

const initialForm: FormState = {
  type: 'PRODUTO_ABERTO',
  productId: '',
  productName: '',
  brand: '',
  supplier: '',
  batch: '',
  conservationMode: 'REFRIGERADO',
  openedAt: now.toISOString().slice(0, 16),
  responsibleName: '',
  employeeId: '',
  quantity: '',
  observations: '',
  manualValidityValue: '',
  manualValidityUnit: 'days',
  receivingTemperatureC: '',
};

const initialExtra: ExtraState = {
  restaurantName: 'SafeKitchen Smart',
  sampleShift: '',

  collectionDate: now.toISOString().slice(0, 10),
  collectionTime: now.toTimeString().slice(0, 5),

  chemicalPurpose: '',
  dilutionMl: '',
  dilutionLiters: '',
  preparationDate: now.toISOString().slice(0, 10),
  preparationTime: now.toTimeString().slice(0, 5),
  chemicalValidity: '',

  nonConformityReasons: [],
  otherNonConformity: '',
  identificationDate: now.toISOString().slice(0, 10),
  actionTaken: [],

  thawingMethod: '',
  startDate: now.toISOString().slice(0, 10),
  startTime: now.toTimeString().slice(0, 5),

  meatType: '',
  mapaSif: '',
  receiptDate: now.toISOString().slice(0, 10),
  storageType: '',

  repackagingDate: now.toISOString().slice(0, 10),
  originalValidity: '',
  newValidity: '',
};


function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowInputTime() {
  return new Date().toTimeString().slice(0, 5);
}

function buildLocalDateTime(dateValue?: string, timeValue?: string) {
  const date = dateValue || todayInputDate();
  const time = timeValue || '00:00';

  return `${date}T${time}`;
}

function dateToInputDate(value?: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return '';

  return value.toISOString().slice(0, 10);
}


const nonConformityOptions = [
  'Vencido',
  'Temperatura inadequada',
  'Embalagem violada',
  'Contaminação',
  'Sem identificação',
  'Outro',
];

const actionOptions = [
  'Descarte',
  'Devolução fornecedor',
  'Avaliação responsável técnico',
];

const thawingOptions = [
  'Refrigerado (0°C a 5°C)',
  'Micro-ondas',
  'Água corrente controlada',
];

const meatOptions = ['Bovino', 'Frango', 'Suíno', 'Peixe'];

const storageOptions = ['Resfriado', 'Congelado'];

const chemicalPurposeOptions = ['Higienização', 'Desinfecção', 'Limpeza pesada'];

const sampleShiftOptions = ['Almoço', 'Jantar', 'Ceia', 'Café da manhã', 'Lanche', 'Outro'];

const visibleBrandTypes: LabelType[] = ['REEMBALAGEM'];

const hiddenProductSearchTypes: LabelType[] = ['AMOSTRAS'];

const hideConservationTypes: LabelType[] = ['PRODUTO_QUIMICO'];

const hideOpenedAtTypes: LabelType[] = [
  'AMOSTRAS',
  'DESCONGELAMENTO_DESSALGUE',
  'REEMBALAGEM',
  'NAO_CONFORME',
  'PRODUTO_QUIMICO',
];

const openedAtInAdditionalTypes: LabelType[] = ['ARMAZENAMENTO_CARNES'];

const showSupplierBatchInAdditionalTypes: LabelType[] = [
  'PRODUTO_ABERTO',
  'PRODUCAO',
  'DESCONGELAMENTO_DESSALGUE',
  'ARMAZENAMENTO_CARNES',
  'REEMBALAGEM',
  'NAO_CONFORME',
  'PRODUTO_QUIMICO',
];

const showBrandInAdditionalTypes: LabelType[] = [
  'PRODUTO_ABERTO',
  'PRODUCAO',
  'DESCONGELAMENTO_DESSALGUE',
  'ARMAZENAMENTO_CARNES',
  'NAO_CONFORME',
  'PRODUTO_QUIMICO',
];

export function NewLabel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(initialForm);
  const [extra, setExtra] = useState<ExtraState>(initialExtra);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [created, setCreated] = useState<Label | null>(null);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  const [showTypeOptions, setShowTypeOptions] = useState(false);
  const [showProductOptions, setShowProductOptions] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);

  const selectedType = labelTypes.find((type) => type.value === form.type);

  const isSampleLabel = form.type === 'AMOSTRAS';
  const shouldShowProductSearch = !hiddenProductSearchTypes.includes(form.type);
  const shouldShowConservation = !hideConservationTypes.includes(form.type);
  const shouldShowOpenedAt =
    !hideOpenedAtTypes.includes(form.type) && !openedAtInAdditionalTypes.includes(form.type);

  const shouldShowOpenedAtInAdditional = openedAtInAdditionalTypes.includes(form.type);

  const shouldShowVisibleBrand = visibleBrandTypes.includes(form.type);
  const shouldShowBrandAdditional =
    showBrandInAdditionalTypes.includes(form.type) && !shouldShowVisibleBrand;

  const shouldShowSupplierBatchAdditional = showSupplierBatchInAdditionalTypes.includes(form.type);

  useEffect(() => {
    setCatalogError('');
    api<Product[]>('/api/products?includeInactive=0')
      .then((data) => {
        const activeProducts = Array.isArray(data)
          ? data.filter((product) => product.active !== false)
          : [];

        setProducts(activeProducts);

        const aiRaw = sessionStorage.getItem('safekitchen_ai_suggestion');

        if (aiRaw) {
          try {
            const ai = JSON.parse(aiRaw) as {
              productName?: string;
              brand?: string;
              detectedBatch?: string;
              conservationMode?: ConservationMode;
              labelType?: LabelType;
              matchedProductId?: string;
            };
            const matched = ai.matchedProductId
              ? activeProducts.find((item) => item.id === ai.matchedProductId)
              : null;

            setForm((old) => ({
              ...old,
              type: ai.labelType || old.type,
              productId: matched?.id || '',
              productName: matched?.name || ai.productName || '',
              brand: ai.brand || '',
              batch: ai.detectedBatch || '',
              conservationMode:
                matched?.defaultMode || ai.conservationMode || old.conservationMode,
            }));
            setSearch(matched?.name || ai.productName || '');
            setShowAdditionalFields(Boolean(ai.brand || ai.detectedBatch));
            sessionStorage.removeItem('safekitchen_ai_suggestion');
            return;
          } catch {
            sessionStorage.removeItem('safekitchen_ai_suggestion');
          }
        }

        const productId = searchParams.get('productId');

        const product = productId
          ? activeProducts.find((item) => item.id === productId)
          : null;

        if (product) {
          setForm((old) => ({
            ...old,
            productId: product.id,
            productName: product.name,
            conservationMode: product.defaultMode,
          }));

          setSearch(product.name);
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        setCatalogError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar o catálogo de produtos.'
        );
      });

    api<Employee[]>('/api/employees')
      .then(setEmployees)
      .catch((loadError) => {
        console.error(loadError);
        setCatalogError((current) =>
          current ||
          (loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os responsáveis.')
        );
      });
  }, [searchParams]);

  const productOptions = useMemo(() => {
    const q = search.trim().toLowerCase();

    const activeProducts = products.filter((product) => product.active !== false);

    if (!q) {
      return activeProducts.slice(0, 20);
    }

    return activeProducts
      .filter((product) =>
        `${product.name} ${product.category} ${product.keywords}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 14);
  }, [products, search]);

  const selectedProduct = products.find((product) => product.id === form.productId);

  const selectedRule =
    selectedProduct?.validityRules.find(
      (rule) => rule.conservationMode === form.conservationMode
    ) || selectedProduct?.validityRules[0];

  const previewExpiration = useMemo(() => {
    const baseDate =
      form.type === 'AMOSTRAS'
        ? new Date(buildLocalDateTime(extra.collectionDate, extra.collectionTime))
        : form.type === 'DESCONGELAMENTO_DESSALGUE'
          ? new Date(buildLocalDateTime(extra.startDate, extra.startTime))
          : form.type === 'REEMBALAGEM'
            ? new Date(buildLocalDateTime(extra.repackagingDate, '00:00'))
            : new Date(form.openedAt);

    if (Number.isNaN(baseDate.getTime()) || form.type === 'NAO_CONFORME') {
      return null;
    }

    if (form.type === 'AMOSTRAS') {
      return addHours(baseDate, 72);
    }

    if (form.type === 'PRODUTO_QUIMICO' && extra.chemicalValidity) {
      const chemicalDate = new Date(extra.chemicalValidity);

      if (!Number.isNaN(chemicalDate.getTime())) {
        return chemicalDate;
      }
    }

    if (form.type === 'REEMBALAGEM' && extra.newValidity) {
      const repackDate = new Date(extra.newValidity);

      if (!Number.isNaN(repackDate.getTime())) {
        return repackDate;
      }
    }

    const manual = Number(form.manualValidityValue);

    if (manual > 0) {
      return form.manualValidityUnit === 'hours'
        ? addHours(baseDate, manual)
        : addDays(baseDate, manual);
    }

    if (!selectedRule) return null;

    return selectedRule.validityUnit === 'hours'
      ? addHours(baseDate, selectedRule.validityValue)
      : addDays(baseDate, selectedRule.validityValue);
  }, [
    form.openedAt,
    form.manualValidityUnit,
    form.manualValidityValue,
    form.type,
    selectedRule,
    extra.chemicalValidity,
    extra.newValidity,
    extra.collectionDate,
    extra.collectionTime,
    extra.startDate,
    extra.startTime,
    extra.repackagingDate,
  ]);

  function pickProduct(product: Product) {
    setForm((old) => ({
      ...old,
      productId: product.id,
      productName: product.name,
      conservationMode: product.defaultMode,
    }));

    setSearch(product.name);
    setShowProductOptions(false);
  }

  function clearProduct() {
    setForm((old) => ({
      ...old,
      productId: '',
      productName: '',
    }));

    setSearch('');
    setShowProductOptions(true);
  }

  function pickEmployee(employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);

    setForm((old) => ({
      ...old,
      employeeId,
      responsibleName: employee?.name || old.responsibleName,
    }));
  }

  function pickLabelType(type: LabelType) {
    const freshNow = new Date();
    const freshDate = freshNow.toISOString().slice(0, 10);
    const freshTime = freshNow.toTimeString().slice(0, 5);

    setForm({
      ...initialForm,
      type,
      conservationMode: type === 'PRODUTO_QUIMICO' ? 'AMBIENTE' : 'REFRIGERADO',
      openedAt: freshNow.toISOString().slice(0, 16),
    });

    setExtra({
      ...initialExtra,
      collectionDate: freshDate,
      collectionTime: freshTime,
      preparationDate: freshDate,
      preparationTime: freshTime,
      identificationDate: freshDate,
      startDate: freshDate,
      startTime: freshTime,
      receiptDate: freshDate,
      repackagingDate: freshDate,
    });

    setSearch('');
    setCreated(null);
    setError('');
    setShowAdditionalFields(false);
    setShowProductOptions(type !== 'AMOSTRAS');
    setShowTypeOptions(false);
  }

  function toggleExtraArray(
    field: 'nonConformityReasons' | 'actionTaken',
    value: string
  ) {
    setExtra((old) => {
      const current = old[field];

      return {
        ...old,
        [field]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  }

  function buildExtraData() {
    if (form.type === 'AMOSTRAS') {
      return {
        restaurantName: extra.restaurantName,
        sampleShift: extra.sampleShift,
        collectionDate: extra.collectionDate,
        collectionTime: extra.collectionTime,
        discardAt: previewExpiration?.toISOString() || null,
      };
    }

    if (form.type === 'PRODUTO_QUIMICO') {
      return {
        chemicalPurpose: extra.chemicalPurpose,
        dilutionMl: extra.dilutionMl,
        dilutionLiters: extra.dilutionLiters,
        preparationDate: extra.preparationDate,
        preparationTime: extra.preparationTime,
        chemicalValidity: extra.chemicalValidity,
      };
    }

    if (form.type === 'NAO_CONFORME') {
      return {
        nonConformityReasons: extra.nonConformityReasons,
        otherNonConformity: extra.otherNonConformity,
        identificationDate: extra.identificationDate,
        actionTaken: extra.actionTaken,
      };
    }

    if (form.type === 'DESCONGELAMENTO_DESSALGUE') {
      return {
        thawingMethod: extra.thawingMethod,
        startDate: extra.startDate,
        startTime: extra.startTime,
      };
    }

    if (form.type === 'ARMAZENAMENTO_CARNES') {
      return {
        meatType: extra.meatType,
        mapaSif: extra.mapaSif,
        receiptDate: extra.receiptDate,
        storageType: extra.storageType,
        openedAt: form.openedAt,
      };
    }

    if (form.type === 'REEMBALAGEM') {
      return {
        repackagingDate: extra.repackagingDate,
        originalValidity: extra.originalValidity,
        newValidity: extra.newValidity || dateToInputDate(previewExpiration),
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
      const baseLabelOpenedAt =
        form.type === 'AMOSTRAS'
          ? buildLocalDateTime(extra.collectionDate, extra.collectionTime)
          : form.type === 'DESCONGELAMENTO_DESSALGUE'
            ? buildLocalDateTime(extra.startDate, extra.startTime)
            : form.type === 'REEMBALAGEM'
              ? buildLocalDateTime(extra.repackagingDate, '00:00')
              : form.openedAt;

      const payload = {
        ...form,
        openedAt: baseLabelOpenedAt,
        productId: form.productId || null,
        employeeId: form.employeeId || null,
        brand: form.brand || null,
        supplier: form.supplier || null,
        batch: form.batch || null,
        quantity: form.quantity || null,
        observations: form.observations || null,
        manualValidityValue: form.manualValidityValue
          ? Number(form.manualValidityValue)
          : null,
        manualValidityUnit: form.manualValidityValue
          ? form.manualValidityUnit
          : null,
        receivingTemperatureC: form.receivingTemperatureC
          ? Number(form.receivingTemperatureC)
          : null,
        extraData: buildExtraData(),
      };

      const label = await api<Label>('/api/labels', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreated(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar etiqueta.');
    } finally {
      setLoading(false);
    }
  }

  function printNow(id: string) {
    navigate(`/imprimir-folha?items=${encodeURIComponent(`${id}:1`)}`);
  }

  async function sharePdf(label: Label) {
    setSharingPdf(true);
    setError('');

    try {
      const token = getToken();
      const result = await shareOrOpenPdfFromUrl(`${API_URL}/api/labels/${label.id}/pdf`, {
        token,
        fileName: `etiqueta-${label.productName || 'produto'}.pdf`,
        title: `Etiqueta - ${label.productName}`,
        text: `Etiqueta SafeKitchen de ${label.productName}.`,
      });

      if (result.mode !== 'cancelled') {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível compartilhar/imprimir a etiqueta.');
    } finally {
      setSharingPdf(false);
    }
  }

  return (
    <div>
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
          Geração de etiqueta
        </p>

        <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white lg:text-4xl">
          Nova etiqueta
        </h1>

        <p className="mt-2 text-slate-500 dark:text-slate-300">
          Escolha o tipo, pesquise o produto e gere a etiqueta com os dados necessários.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-6 xl:grid-cols-[1fr_390px]">
        <section className="overflow-visible rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#202020] sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-black text-slate-700 dark:text-slate-200">
                Tipo de etiqueta
              </label>

              <div className="mt-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#151515]">
                <button
                  type="button"
                  onClick={() => setShowTypeOptions((old) => !old)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-safe-dark dark:text-white">
                      {selectedType?.label || 'Selecionar tipo de etiqueta'}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {selectedType?.description ||
                        'Escolha o modelo de etiqueta que será preenchido.'}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-safe-soft text-safe-green dark:bg-white/10">
                    {showTypeOptions ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </div>
                </button>

                {showTypeOptions && (
                  <div className="border-t border-slate-100 p-3 dark:border-white/10">
                    <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:max-h-none sm:grid-cols-2 sm:overflow-visible sm:pr-0">
                      {labelTypes.map((type) => {
                        const active = form.type === type.value;

                        return (
                          <button
                            type="button"
                            key={type.value}
                            onClick={() => pickLabelType(type.value)}
                            className={`rounded-2xl border p-3 text-left transition ${
                              active
                                ? 'border-safe-green bg-safe-soft text-safe-dark dark:bg-emerald-950/40 dark:text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
                            }`}
                          >
                            <p className="text-sm font-black">{type.label}</p>

                            <p className="mt-1 text-xs font-semibold opacity-70">
                              {type.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {shouldShowProductSearch && (
              <ProductSearch
                search={search}
                setSearch={setSearch}
                form={form}
                setForm={setForm}
                productOptions={productOptions}
                showProductOptions={showProductOptions}
                setShowProductOptions={setShowProductOptions}
                pickProduct={pickProduct}
                clearProduct={clearProduct}
              />
            )}

            {catalogError && (
              <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                {catalogError}
              </div>
            )}

            <SpecificFields
              type={form.type}
              extra={extra}
              setExtra={setExtra}
              toggleExtraArray={toggleExtraArray}
            />

            {isSampleLabel && (
              <Input
                label="Produto da amostra"
                value={form.productName}
                onChange={(value) =>
                  setForm((old) => ({
                    ...old,
                    productName: value,
                  }))
                }
                required
                placeholder="Ex.: salada, arroz, feijão, molho..."
              />
            )}

            <ResponsibleFields
              employees={employees}
              form={form}
              pickEmployee={pickEmployee}
            />

            {shouldShowVisibleBrand && (
              <Input
                label="Marca"
                value={form.brand}
                onChange={(value) =>
                  setForm((old) => ({
                    ...old,
                    brand: value,
                  }))
                }
              />
            )}

            {shouldShowConservation && (
              <div>
                <label className="text-sm font-black text-slate-700 dark:text-slate-200">
                  Modo de conservação
                </label>

                <select
                  value={form.conservationMode}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      conservationMode: event.target.value as ConservationMode,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-[#151515] dark:text-white"
                >
                  <option value="AMBIENTE">Temperatura ambiente</option>
                  <option value="REFRIGERADO">Refrigerado</option>
                  <option value="CONGELADO">Congelado</option>
                </select>
              </div>
            )}

            {shouldShowOpenedAt && (
              <OpenedAtField form={form} setForm={setForm} />
            )}

            <AdditionalFields
              form={form}
              setForm={setForm}
              showAdditionalFields={showAdditionalFields}
              setShowAdditionalFields={setShowAdditionalFields}
              shouldShowBrandAdditional={shouldShowBrandAdditional}
              shouldShowSupplierBatchAdditional={shouldShowSupplierBatchAdditional}
              shouldShowOpenedAtInAdditional={shouldShowOpenedAtInAdditional}
            />
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
          >
            <Sparkles size={18} />
            {loading ? 'Gerando...' : 'Gerar etiqueta'}
          </button>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
              Prévia
            </p>

            <div className="mt-4 overflow-hidden rounded-3xl border-2 border-safe-green bg-white dark:bg-[#151515]">
              <div className="bg-safe-green p-4 text-white">
                <p className="text-xs font-bold uppercase">{selectedType?.label}</p>

                <p className="text-xl font-black">
                  {form.productName || 'PRODUTO'}
                </p>
              </div>

              <div className="space-y-2 p-4 text-sm">
                {shouldShowConservation && (
                  <PreviewRow label="Conservação" value={form.conservationMode} />
                )}

                {form.batch && <PreviewRow label="Lote" value={form.batch} />}

                {shouldShowOpenedAt && (
                  <PreviewRow
                    label="Data base"
                    value={
                      form.openedAt
                        ? format(new Date(form.openedAt), 'dd/MM/yyyy HH:mm')
                        : '-'
                    }
                  />
                )}

                {form.type === 'ARMAZENAMENTO_CARNES' && (
                  <>
                    <PreviewRow label="Tipo" value={extra.meatType || '-'} />
                    <PreviewRow label="MAPA/SIF" value={extra.mapaSif || '-'} />
                    <PreviewRow label="Recebimento" value={formatDatePreview(extra.receiptDate)} />
                    <PreviewRow label="Armazenamento" value={extra.storageType || '-'} />
                  </>
                )}

                {form.type === 'AMOSTRAS' && (
                  <>
                    <PreviewRow label="Turno" value={extra.sampleShift || '-'} />
                    <PreviewRow label="Coleta" value={`${formatDatePreview(extra.collectionDate)} ${extra.collectionTime || ''}`} />
                  </>
                )}

                {form.type === 'DESCONGELAMENTO_DESSALGUE' && (
                  <>
                    <PreviewRow
                      label="Início"
                      value={`${formatDatePreview(extra.startDate)} ${extra.startTime || ''}`}
                    />
                    <PreviewRow label="Método" value={extra.thawingMethod || '-'} />
                  </>
                )}

                {form.type === 'REEMBALAGEM' && (
                  <>
                    <PreviewRow
                      label="Data reembalagem"
                      value={formatDatePreview(extra.repackagingDate)}
                    />
                    <PreviewRow
                      label="Validade original"
                      value={formatDatePreview(extra.originalValidity)}
                    />
                  </>
                )}

                {form.type === 'PRODUTO_QUIMICO' && (
                  <>
                    <PreviewRow label="Finalidade" value={extra.chemicalPurpose || '-'} />
                    <PreviewRow label="Validade" value={formatDatePreview(extra.chemicalValidity)} />
                  </>
                )}

                <PreviewRow
                  label={form.type === 'AMOSTRAS' ? 'Descarte' : form.type === 'REEMBALAGEM' ? 'Nova validade' : 'Validade'}
                  value={
                    previewExpiration
                      ? format(previewExpiration, 'dd/MM/yyyy HH:mm')
                      : '-'
                  }
                />

                <PreviewRow
                  label="Responsável"
                  value={form.responsibleName || '-'}
                />
              </div>
            </div>

            {selectedRule && form.type !== 'NAO_CONFORME' && form.type !== 'PRODUTO_QUIMICO' && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                Regra sugerida: {selectedRule.validityValue}{' '}
                {selectedRule.validityUnit === 'hours' ? 'hora(s)' : 'dia(s)'} •{' '}
                {selectedRule.source}
              </p>
            )}

            {form.type === 'AMOSTRAS' && (
              <p className="mt-3 rounded-2xl bg-safe-soft p-3 text-xs font-bold text-safe-dark">
                Amostras: descarte automático 72 horas após a coleta.
              </p>
            )}
          </div>

          {created && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-black text-emerald-800">
                Etiqueta gerada com sucesso!
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                Agora você pode compartilhar com a impressora do celular ou abrir o PDF.
              </p>

              <button
                type="button"
                onClick={() => sharePdf(created)}
                disabled={sharingPdf}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                <Share2 size={18} />
                {sharingPdf ? 'Preparando...' : 'Compartilhar / imprimir'}
              </button>

              <button
                type="button"
                onClick={() => printNow(created.id)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-700"
              >
                <Printer size={18} />
                Imprimir agora
              </button>

              <Link
                to="/historico"
                className="mt-3 block text-center text-sm font-black text-emerald-700"
              >
                Ver histórico
              </Link>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}

function ProductSearch({
  search,
  setSearch,
  form,
  setForm,
  productOptions,
  showProductOptions,
  setShowProductOptions,
  pickProduct,
  clearProduct,
}: {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  productOptions: Product[];
  showProductOptions: boolean;
  setShowProductOptions: Dispatch<SetStateAction<boolean>>;
  pickProduct: (product: Product) => void;
  clearProduct: () => void;
}) {
  return (
    <div className="md:col-span-2">
      <label className="text-sm font-black text-slate-700 dark:text-slate-200">
        Produto/produção
      </label>

      <div
        className="relative mt-2"
        onBlur={() => {
          window.setTimeout(() => setShowProductOptions(false), 160);
        }}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-safe-green focus-within:bg-white dark:border-white/10 dark:bg-[#151515] dark:focus-within:bg-[#151515]">
          <Search size={18} className="text-slate-400" />

          <input
            required
            value={search}
            onFocus={() => setShowProductOptions(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowProductOptions(true);

              setForm((old) => ({
                ...old,
                productName: event.target.value,
                productId: '',
              }));
            }}
            placeholder="Clique ou digite para buscar um produto..."
            className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
          />

          {search && (
            <button
              type="button"
              onClick={clearProduct}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:bg-white/10"
            >
              <X size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowProductOptions((old) => !old)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-safe-soft text-safe-green dark:bg-white/10"
          >
            {showProductOptions ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        </div>

        {showProductOptions && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#202020]">
            <div className="max-h-[320px] overflow-y-auto p-2">
              {productOptions.length > 0 ? (
                productOptions.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => pickProduct(product)}
                    className={`flex w-full items-start justify-between gap-3 rounded-2xl p-3 text-left transition ${
                      form.productId === product.id
                        ? 'bg-safe-soft text-safe-dark dark:bg-emerald-950/40 dark:text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {product.name}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {product.category} • {product.defaultMode}
                      </p>
                    </div>

                    {form.productId === product.id && (
                      <span className="rounded-full bg-safe-green px-3 py-1 text-[10px] font-black uppercase text-white">
                        Selecionado
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Nenhum produto encontrado. Você pode continuar preenchendo manualmente.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {form.productId && (
        <div className="mt-3 rounded-2xl border border-safe-green bg-safe-soft p-3 dark:border-emerald-500/40 dark:bg-emerald-950/30">
          <p className="text-xs font-black uppercase tracking-wider text-safe-green">
            Produto selecionado
          </p>

          <p className="mt-1 text-sm font-black text-safe-dark dark:text-white">
            {form.productName}
          </p>
        </div>
      )}
    </div>
  );
}

function ResponsibleFields({
  employees,
  form,
  pickEmployee,
}: {
  employees: Employee[];
  form: FormState;
  pickEmployee: (employeeId: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700 dark:text-slate-200">
        Responsável
      </label>

      <select
        required
        value={form.employeeId}
        onChange={(event) => pickEmployee(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-[#151515] dark:text-white"
      >
        <option value="">Selecionar funcionário</option>

        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function OpenedAtField({
  form,
  setForm,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700 dark:text-slate-200">
        Aberto/manipulado em
      </label>

      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#151515]">
        <CalendarDays size={18} className="text-slate-400" />

        <input
          type="datetime-local"
          value={form.openedAt}
          onChange={(event) =>
            setForm((old) => ({
              ...old,
              openedAt: event.target.value,
            }))
          }
          className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
        />
      </div>
    </div>
  );
}

function AdditionalFields({
  form,
  setForm,
  showAdditionalFields,
  setShowAdditionalFields,
  shouldShowBrandAdditional,
  shouldShowSupplierBatchAdditional,
  shouldShowOpenedAtInAdditional,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  showAdditionalFields: boolean;
  setShowAdditionalFields: Dispatch<SetStateAction<boolean>>;
  shouldShowBrandAdditional: boolean;
  shouldShowSupplierBatchAdditional: boolean;
  shouldShowOpenedAtInAdditional: boolean;
}) {
  return (
    <div className="md:col-span-2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#151515]">
      <button
        type="button"
        onClick={() => setShowAdditionalFields((old) => !old)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <div className="min-w-0">
          <p className="text-sm font-black text-safe-dark dark:text-white">
            Detalhes adicionais
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
            Informações opcionais da etiqueta.
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-safe-soft text-safe-green dark:bg-white/10">
          {showAdditionalFields ? (
            <ChevronUp size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </div>
      </button>

      {showAdditionalFields && (
        <div className="grid gap-4 border-t border-slate-100 p-4 dark:border-white/10 md:grid-cols-2">
          {shouldShowBrandAdditional && (
            <Input
              label="Marca"
              value={form.brand}
              onChange={(value) =>
                setForm((old) => ({
                  ...old,
                  brand: value,
                }))
              }
            />
          )}

          {shouldShowSupplierBatchAdditional && (
            <>
              <Input
                label="Fornecedor"
                value={form.supplier}
                onChange={(value) =>
                  setForm((old) => ({
                    ...old,
                    supplier: value,
                  }))
                }
              />

              <Input
                label="Lote"
                value={form.batch}
                onChange={(value) =>
                  setForm((old) => ({
                    ...old,
                    batch: value,
                  }))
                }
              />
            </>
          )}

          {shouldShowOpenedAtInAdditional && (
            <OpenedAtField form={form} setForm={setForm} />
          )}

          <Input
            label="Quantidade"
            value={form.quantity}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                quantity: value,
              }))
            }
            placeholder="Ex.: 2kg, 1 bandeja, 20 unidades"
          />

          <Input
            label="Temperatura de recebimento (°C)"
            type="number"
            value={form.receivingTemperatureC}
            onChange={(value) =>
              setForm((old) => ({
                ...old,
                receivingTemperatureC: value,
              }))
            }
            placeholder="Opcional — será registrada no controle, não na etiqueta"
          />

          <div className="grid grid-cols-[1fr_120px] gap-3 sm:grid-cols-[1fr_130px]">
            <Input
              label="Validade manual"
              value={form.manualValidityValue}
              onChange={(value) =>
                setForm((old) => ({
                  ...old,
                  manualValidityValue: value.replace(/\D/g, ''),
                }))
              }
              placeholder="Opcional"
            />

            <div>
              <label className="text-sm font-black text-slate-700 dark:text-slate-200">
                Unidade
              </label>

              <select
                value={form.manualValidityUnit}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    manualValidityUnit: event.target.value as 'days' | 'hours',
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none dark:border-white/10 dark:bg-[#151515] dark:text-white"
              >
                <option value="days">Dias</option>
                <option value="hours">Horas</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-black text-slate-700 dark:text-slate-200">
              Observações
            </label>

            <textarea
              value={form.observations}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  observations: event.target.value,
                }))
              }
              rows={3}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none dark:border-white/10 dark:bg-[#151515] dark:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SpecificFields({
  type,
  extra,
  setExtra,
  toggleExtraArray,
}: {
  type: LabelType;
  extra: ExtraState;
  setExtra: Dispatch<SetStateAction<ExtraState>>;
  toggleExtraArray: (
    field: 'nonConformityReasons' | 'actionTaken',
    value: string
  ) => void;
}) {
  if (type === 'AMOSTRAS') {
    return (
      <FieldBox title="Dados de amostras">
        <Input
          label="Nome do restaurante"
          value={extra.restaurantName}
          onChange={(value) =>
            setExtra((old) => ({ ...old, restaurantName: value }))
          }
        />

        <SelectTextField
          label="Turno"
          value={extra.sampleShift}
          options={sampleShiftOptions}
          onChange={(value) =>
            setExtra((old) => ({ ...old, sampleShift: value }))
          }
        />

        <Input
          label="Data da coleta"
          type="date"
          value={extra.collectionDate}
          onChange={(value) =>
            setExtra((old) => ({ ...old, collectionDate: value }))
          }
        />

        <Input
          label="Hora da coleta"
          type="time"
          value={extra.collectionTime}
          onChange={(value) =>
            setExtra((old) => ({ ...old, collectionTime: value }))
          }
        />
      </FieldBox>
    );
  }

  if (type === 'PRODUTO_QUIMICO') {
    return (
      <FieldBox title="Dados do produto químico">
        <OptionGroup
          label="Finalidade"
          options={chemicalPurposeOptions}
          value={extra.chemicalPurpose}
          onChange={(value) =>
            setExtra((old) => ({ ...old, chemicalPurpose: value }))
          }
        />

        <Input
          label="Validade"
          type="date"
          value={extra.chemicalValidity}
          onChange={(value) =>
            setExtra((old) => ({ ...old, chemicalValidity: value }))
          }
        />

        <ChemicalDilutionBox extra={extra} setExtra={setExtra} />
      </FieldBox>
    );
  }

  if (type === 'NAO_CONFORME') {
    return (
      <FieldBox title="Produto segregado / Não conforme">
        <CheckboxGroup
          label="Não conformidade"
          options={nonConformityOptions}
          values={extra.nonConformityReasons}
          onToggle={(value) => toggleExtraArray('nonConformityReasons', value)}
        />

        {extra.nonConformityReasons.includes('Outro') && (
          <Input
            label="Outro motivo"
            value={extra.otherNonConformity}
            onChange={(value) =>
              setExtra((old) => ({ ...old, otherNonConformity: value }))
            }
          />
        )}

        <Input
          label="Data identificação"
          type="date"
          value={extra.identificationDate}
          onChange={(value) =>
            setExtra((old) => ({ ...old, identificationDate: value }))
          }
        />

        <CheckboxGroup
          label="Ação tomada"
          options={actionOptions}
          values={extra.actionTaken}
          onToggle={(value) => toggleExtraArray('actionTaken', value)}
        />
      </FieldBox>
    );
  }

  if (type === 'DESCONGELAMENTO_DESSALGUE') {
    return (
      <FieldBox title="Dados de descongelamento/dessalgue">
        <Input
          label="Data início"
          type="date"
          value={extra.startDate}
          onChange={(value) =>
            setExtra((old) => ({ ...old, startDate: value }))
          }
        />

        <Input
          label="Hora início"
          type="time"
          value={extra.startTime}
          onChange={(value) =>
            setExtra((old) => ({ ...old, startTime: value }))
          }
        />

        <OptionGroup
          label="Método"
          options={thawingOptions}
          value={extra.thawingMethod}
          onChange={(value) =>
            setExtra((old) => ({ ...old, thawingMethod: value }))
          }
        />
      </FieldBox>
    );
  }

  if (type === 'ARMAZENAMENTO_CARNES') {
    return (
      <FieldBox title="Dados de armazenamento de carnes">
        <OptionGroup
          label="Tipo"
          options={meatOptions}
          value={extra.meatType}
          onChange={(value) =>
            setExtra((old) => ({ ...old, meatType: value }))
          }
        />

        <Input
          label="Rastreabilidade MAPA/SIF"
          value={extra.mapaSif}
          onChange={(value) =>
            setExtra((old) => ({ ...old, mapaSif: value }))
          }
        />

        <Input
          label="Data recebimento"
          type="date"
          value={extra.receiptDate}
          onChange={(value) =>
            setExtra((old) => ({ ...old, receiptDate: value }))
          }
        />

        <OptionGroup
          label="Armazenamento"
          options={storageOptions}
          value={extra.storageType}
          onChange={(value) =>
            setExtra((old) => ({ ...old, storageType: value }))
          }
        />
      </FieldBox>
    );
  }

  if (type === 'REEMBALAGEM') {
    return (
      <FieldBox title="Dados de reembalagem">
        <Input
          label="Data reembalagem"
          type="date"
          value={extra.repackagingDate}
          onChange={(value) =>
            setExtra((old) => ({ ...old, repackagingDate: value }))
          }
        />

        <Input
          label="Validade original"
          type="date"
          value={extra.originalValidity}
          onChange={(value) =>
            setExtra((old) => ({ ...old, originalValidity: value }))
          }
        />

        <Input
          label="Nova validade manual"
          type="date"
          value={extra.newValidity}
          onChange={(value) =>
            setExtra((old) => ({ ...old, newValidity: value }))
          }
          placeholder="Deixe em branco para calcular automaticamente"
        />
      </FieldBox>
    );
  }

  return null;
}

function ChemicalDilutionBox({
  extra,
  setExtra,
}: {
  extra: ExtraState;
  setExtra: Dispatch<SetStateAction<ExtraState>>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:col-span-2 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#151515]">
      <button
        type="button"
        onClick={() => setOpen((old) => !old)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <div>
          <p className="text-sm font-black text-safe-dark dark:text-white">
            Diluição
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
            Preencha apenas se o produto químico for diluído.
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-safe-soft text-safe-green dark:bg-white/10">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 dark:border-white/10 md:grid-cols-2">
          <Input
            label="Diluição - mL"
            value={extra.dilutionMl}
            onChange={(value) =>
              setExtra((old) => ({ ...old, dilutionMl: value }))
            }
            placeholder="Ex.: 50"
          />

          <Input
            label="Diluição - litros de água"
            value={extra.dilutionLiters}
            onChange={(value) =>
              setExtra((old) => ({ ...old, dilutionLiters: value }))
            }
            placeholder="Ex.: 10"
          />

          <Input
            label="Data preparo"
            type="date"
            value={extra.preparationDate}
            onChange={(value) =>
              setExtra((old) => ({ ...old, preparationDate: value }))
            }
          />

          <Input
            label="Hora preparo"
            type="time"
            value={extra.preparationTime}
            onChange={(value) =>
              setExtra((old) => ({ ...old, preparationTime: value }))
            }
          />
        </div>
      )}
    </div>
  );
}

function FieldBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="md:col-span-2 rounded-3xl border border-safe-green/30 bg-safe-soft/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
      <p className="mb-4 text-sm font-black text-safe-dark dark:text-white">
        {title}
      </p>

      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <input
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
      />
    </div>
  );
}

function SelectTextField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
      >
        <option value="">Selecionar</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <p className="text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onChange(option)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
              value === option
                ? 'border-safe-green bg-safe-green text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <p className="text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = values.includes(option);

          return (
            <button
              type="button"
              key={option}
              onClick={() => onToggle(option)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                checked
                  ? 'border-safe-green bg-safe-green text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
              }`}
            >
              {checked ? '☑' : '☐'} {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 dark:border-white/10">
      <span className="font-bold text-slate-500 dark:text-slate-300">{label}</span>

      <span className="text-right font-black text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function formatDatePreview(value?: string) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return format(date, 'dd/MM/yyyy');
}

export default NewLabel;
