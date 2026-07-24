import { FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Boxes,
  Camera,
  Edit3,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import type { ConservationMode, Product, VisionIdentifyResponse } from '../types';

type ProductForm = {
  name: string;
  category: string;
  defaultMode: ConservationMode;
  keywords: string;
  imageUrl: string;
};

const emptyForm: ProductForm = {
  name: '',
  category: '',
  defaultMode: 'REFRIGERADO',
  keywords: '',
  imageUrl: '',
};

function mergeKeywords(...values: Array<string | undefined | null>) {
  const words = values
    .flatMap((value) => String(value || '').split(/[;,\s]+/))
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 1);

  return Array.from(new Set(words)).join(' ');
}

function confidencePercent(value?: number) {
  if (typeof value !== 'number') return '—';
  return `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
}

async function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };

      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function Products() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<'create' | 'edit' | null>(null);
  const [aiResult, setAiResult] = useState<VisionIdentifyResponse | null>(null);
  const [editAiResult, setEditAiResult] = useState<VisionIdentifyResponse | null>(null);

  async function loadProducts() {
    const data = await api<Product[]>(`/api/products?includeInactive=${showInactive ? '1' : '0'}`);
    setProducts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadProducts().catch(console.error);
  }, [showInactive]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((product) => {
      const text = `${product.name} ${product.category} ${product.keywords}`.toLowerCase();
      return text.includes(q);
    });
  }, [products, search]);

  const activeCount = products.filter((item) => item.active).length;
  const inactiveCount = products.filter((item) => !item.active).length;

  function resetMessages() {
    setError('');
    setSuccess('');
  }

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  function openProduct(product: Product) {
    navigate(`/produtos/${product.id}`);
  }

  async function handleImageFile(file: File | null, target: 'create' | 'edit') {
    if (!file) return;

    resetMessages();

    try {
      const dataUrl = await fileToCompressedDataUrl(file);

      if (target === 'create') {
        setAiResult(null);
        setForm((old) => ({ ...old, imageUrl: dataUrl }));
      } else {
        setEditAiResult(null);
        setEditForm((old) => ({ ...old, imageUrl: dataUrl }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    }
  }

  function applyAiSuggestion(target: 'create' | 'edit', result: VisionIdentifyResponse) {
    const suggestion = result.suggestion;
    const detectedBatchText = suggestion.detectedBatch
      ? `lote ${suggestion.detectedBatch}`
      : '';

    if (target === 'create') {
      setForm((old) => ({
        ...old,
        name: suggestion.productName || old.name,
        category: suggestion.category || old.category,
        defaultMode: suggestion.conservationMode || old.defaultMode,
        keywords: mergeKeywords(old.keywords, suggestion.keywords, suggestion.brand, detectedBatchText),
      }));
      setAiResult(result);
    } else {
      setEditForm((old) => ({
        ...old,
        name: suggestion.productName || old.name,
        category: suggestion.category || old.category,
        defaultMode: suggestion.conservationMode || old.defaultMode,
        keywords: mergeKeywords(old.keywords, suggestion.keywords, suggestion.brand, detectedBatchText),
      }));
      setEditAiResult(result);
    }
  }

  async function identifyWithAi(target: 'create' | 'edit') {
    resetMessages();

    const imageBase64 = target === 'create' ? form.imageUrl : editForm.imageUrl;

    if (!imageBase64) {
      setError('Adicione uma foto do produto antes de pedir a análise da Sana.');
      return;
    }

    setAiLoading(target);

    try {
      const result = await api<VisionIdentifyResponse>('/api/vision/identify-product', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
        }),
      });

      applyAiSuggestion(target, result);

      const exists = result.matchedProduct
        ? ` Produto parecido encontrado no cadastro: ${result.matchedProduct.name}.`
        : '';

      setSuccess(`A Sana identificou o produto. Confira os dados antes de salvar.${exists}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A Sana não conseguiu identificar o produto.');
    } finally {
      setAiLoading(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    resetMessages();
    setSaving(true);

    try {
      await api<Product>('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          defaultMode: form.defaultMode,
          keywords: form.keywords,
          imageUrl: form.imageUrl || null,
        }),
      });

      setForm(emptyForm);
      setAiResult(null);
      setSuccess('Produto cadastrado com sucesso.');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(product: Product) {
    resetMessages();
    setEditAiResult(null);

    setEditing(product);
    setEditForm({
      name: product.name || '',
      category: product.category || '',
      defaultMode: product.defaultMode || 'REFRIGERADO',
      keywords: product.keywords || '',
      imageUrl: product.imageUrl || '',
    });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();

    if (!editing) return;

    resetMessages();
    setSaving(true);

    try {
      await api<Product>(`/api/products/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category,
          defaultMode: editForm.defaultMode,
          keywords: editForm.keywords,
          imageUrl: editForm.imageUrl || null,
        }),
      });

      setEditing(null);
      setEditAiResult(null);
      setSuccess('Produto atualizado com sucesso.');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar produto.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: Product) {
    resetMessages();

    try {
      await api<Product>(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !product.active }),
      });

      setSuccess(product.active ? 'Produto inativado.' : 'Produto reativado.');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar produto.');
    }
  }

  async function removeProduct(product: Product) {
    const labelsCount = product._count?.labels || 0;

    const confirmed = window.confirm(
      labelsCount > 0
        ? `O produto "${product.name}" possui ${labelsCount} etiqueta(s).\n\nEle será INATIVADO para preservar o histórico. Deseja continuar?`
        : `Deseja remover definitivamente o produto "${product.name}"?`
    );

    if (!confirmed) return;

    resetMessages();

    try {
      const result = await api<any>(`/api/products/${product.id}`, {
        method: 'DELETE',
      });

      setSuccess(result?.message || 'Produto removido/inativado com sucesso.');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover produto.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
              Produtos
            </p>

            <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white lg:text-4xl">
              Cadastro de produtos
            </h1>

            <p className="mt-2 text-slate-500 dark:text-slate-300">
              Cadastre produtos manualmente ou conte com a Sana para preencher os dados a partir de uma foto.
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 sm:gap-3 lg:w-auto">
            <StatCard label="Ativos" value={activeCount} />
            <StatCard label="Inativos" value={inactiveCount} />
            <StatCard label="Total" value={products.length} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search size={18} className="text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, categoria ou palavras-chave..."
              className="w-full bg-transparent text-sm font-semibold text-safe-dark outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowInactive((old) => !old)}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              showInactive
                ? 'bg-safe-green text-white shadow-lg shadow-emerald-200'
                : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {success}
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filteredProducts.map((product) => {
            const labelsCount = product._count?.labels || 0;

            return (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => openProduct(product)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') openProduct(product);
                }}
                className={`cursor-pointer rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-app ${
                  product.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-safe-soft text-safe-green">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Boxes size={24} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {product.category} • {product.defaultMode}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                          product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {product.keywords || 'Sem palavras-chave cadastradas.'}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs font-black text-slate-500">
                      {labelsCount > 0 ? (
                        <>
                          <AlertTriangle size={14} />
                          {labelsCount} etiqueta(s) vinculada(s)
                        </>
                      ) : (
                        <>
                          <BadgeCheck size={14} />
                          Sem histórico vinculado
                        </>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          stop(event);
                          startEdit(product);
                        }}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100"
                      >
                        <Edit3 size={15} />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          stop(event);
                          toggleActive(product);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition ${
                          product.active
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {product.active ? <Ban size={15} /> : <BadgeCheck size={15} />}
                        {product.active ? 'Inativar' : 'Ativar'}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          stop(event);
                          removeProduct(product);
                        }}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 size={15} />
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <Boxes className="mx-auto text-slate-300" size={42} />
              <p className="mt-3 font-black text-slate-700">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark">
          <Plus size={20} />
          Novo produto
        </h2>

        <p className="mt-2 text-xs font-semibold text-slate-500">
          Tire uma foto ou selecione uma imagem. Depois clique em “Analisar com a Sana”.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <PhotoPicker
            label="Foto do produto"
            imageUrl={form.imageUrl}
            onClear={() => {
              setForm((old) => ({ ...old, imageUrl: '' }));
              setAiResult(null);
            }}
            onPick={(file) => handleImageFile(file, 'create')}
            onAi={() => identifyWithAi('create')}
            aiLoading={aiLoading === 'create'}
          />

          <AiResultCard result={aiResult} />

          <Field label="Nome" value={form.name} onChange={(value) => setForm((old) => ({ ...old, name: value }))} required />

          <Field
            label="Categoria"
            value={form.category}
            onChange={(value) => setForm((old) => ({ ...old, category: value }))}
            required
            placeholder="Ex.: Carnes, Laticínios, Produção..."
          />

          <div>
            <label className="block text-sm font-black text-slate-700">Conservação padrão</label>

            <select
              value={form.defaultMode}
              onChange={(event) =>
                setForm((old) => ({ ...old, defaultMode: event.target.value as ConservationMode }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-safe-dark outline-none transition focus:border-safe-green focus:bg-white"
            >
              <option value="AMBIENTE">Ambiente</option>
              <option value="REFRIGERADO">Refrigerado</option>
              <option value="CONGELADO">Congelado</option>
            </select>
          </div>

          <Field
            label="Palavras-chave"
            value={form.keywords}
            onChange={(value) => setForm((old) => ({ ...old, keywords: value }))}
            placeholder="Ex.: leite, molho, frango, marca..."
          />

          <button
            disabled={saving}
            className="w-full rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar produto'}
          </button>
        </form>
      </aside>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={saveEdit} className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Editar</p>
                <h2 className="mt-1 text-2xl font-black text-safe-dark">Produto</h2>
              </div>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <PhotoPicker
                label="Foto do produto"
                imageUrl={editForm.imageUrl}
                onClear={() => {
                  setEditForm((old) => ({ ...old, imageUrl: '' }));
                  setEditAiResult(null);
                }}
                onPick={(file) => handleImageFile(file, 'edit')}
                onAi={() => identifyWithAi('edit')}
                aiLoading={aiLoading === 'edit'}
              />

              <AiResultCard result={editAiResult} />

              <Field
                label="Nome"
                value={editForm.name}
                onChange={(value) => setEditForm((old) => ({ ...old, name: value }))}
                required
              />

              <Field
                label="Categoria"
                value={editForm.category}
                onChange={(value) => setEditForm((old) => ({ ...old, category: value }))}
                required
              />

              <div>
                <label className="block text-sm font-black text-slate-700">Conservação padrão</label>

                <select
                  value={editForm.defaultMode}
                  onChange={(event) =>
                    setEditForm((old) => ({ ...old, defaultMode: event.target.value as ConservationMode }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-safe-dark outline-none transition focus:border-safe-green focus:bg-white"
                >
                  <option value="AMBIENTE">Ambiente</option>
                  <option value="REFRIGERADO">Refrigerado</option>
                  <option value="CONGELADO">Congelado</option>
                </select>
              </div>

              <Field
                label="Palavras-chave"
                value={editForm.keywords}
                onChange={(value) => setEditForm((old) => ({ ...old, keywords: value }))}
              />
            </div>

            <button
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AiResultCard({ result }: { result: VisionIdentifyResponse | null }) {
  if (!result) return null;

  const suggestion = result.suggestion;

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <div className="flex items-center gap-2 font-black">
        <Sparkles size={17} />
        Sugestão da Sana • confiança {confidencePercent(suggestion.confidence)}
      </div>

      <div className="mt-3 space-y-1 text-xs font-semibold">
        <p><strong>Produto:</strong> {suggestion.productName || '—'}</p>
        <p><strong>Marca:</strong> {suggestion.brand || 'não identificada'}</p>
        <p><strong>Lote:</strong> {suggestion.detectedBatch || 'não identificado'}</p>
        <p><strong>Categoria:</strong> {suggestion.category || '—'}</p>
        <p><strong>Conservação:</strong> {suggestion.conservationMode || '—'}</p>
        {result.matchedProduct && (
          <p><strong>Atenção:</strong> já existe produto parecido: {result.matchedProduct.name}</p>
        )}
        <p className="pt-2 text-emerald-700">{result.warning || suggestion.notes}</p>
      </div>
    </div>
  );
}

function PhotoPicker({
  label,
  imageUrl,
  onPick,
  onClear,
  onAi,
  aiLoading,
}: {
  label: string;
  imageUrl: string;
  onPick: (file: File | null) => void;
  onClear: () => void;
  onAi: () => void;
  aiLoading: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-black text-slate-700">{label}</label>

      <div className="mt-2 rounded-3xl border border-slate-200 bg-slate-50 p-3">
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src={imageUrl} alt="Foto do produto" className="h-44 w-full object-cover" />

            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600 shadow"
            >
              <X size={17} />
            </button>
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center">
            <ImagePlus size={34} className="text-safe-green" />
            <p className="mt-2 text-sm font-black text-safe-dark">Adicionar foto</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Use a câmera ou escolha uma imagem da galeria.
            </p>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-safe-green px-3 py-3 text-xs font-black text-white">
            <Camera size={16} />
            Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => onPick(event.target.files?.[0] || null)}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-black text-safe-dark shadow-sm">
            <ImagePlus size={16} />
            Galeria
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onPick(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onAi}
          disabled={!imageUrl || aiLoading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {aiLoading ? 'Sana está analisando...' : 'Analisar com a Sana'}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
      <p className="text-xl font-black text-safe-dark">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-black text-slate-700">{label}</label>

      <input
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-safe-dark outline-none transition focus:border-safe-green focus:bg-white"
      />
    </div>
  );
}

export default Products;
