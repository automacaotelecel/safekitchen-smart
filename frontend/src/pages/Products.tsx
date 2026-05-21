import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Boxes,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import type { ConservationMode, Product } from '../types';

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

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

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
        body: JSON.stringify({
          active: !product.active,
        }),
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
              Gerencie produtos usados nas etiquetas. Produtos com histórico são inativados, não apagados.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Ativos" value={activeCount} />
            <StatCard label="Inativos" value={inactiveCount} />
            <StatCard label="Total" value={products.length} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#202020]">
            <Search size={18} className="text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, categoria ou palavras-chave..."
              className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowInactive((old) => !old)}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              showInactive
                ? 'bg-safe-green text-white shadow-lg shadow-emerald-200'
                : 'bg-white text-slate-600 shadow-sm dark:bg-[#202020] dark:text-slate-200'
            }`}
          >
            {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
            {success}
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filteredProducts.map((product) => {
            const labelsCount = product._count?.labels || 0;

            return (
              <div
                key={product.id}
                className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-app ${
                  product.active
                    ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020]'
                    : 'border-slate-200 bg-slate-50 opacity-75 dark:border-white/10 dark:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-safe-soft text-safe-green">
                    <Boxes size={24} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">
                          {product.name}
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                          {product.category} • {product.defaultMode}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                          product.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                            : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                        }`}
                      >
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {product.keywords || 'Sem palavras-chave cadastradas.'}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-300">
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
                        onClick={() => startEdit(product)}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        <Edit3 size={15} />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActive(product)}
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
                        onClick={() => removeProduct(product)}
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
            <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#202020]">
              <Boxes className="mx-auto text-slate-300" size={42} />

              <p className="mt-3 font-black text-slate-700 dark:text-white">
                Nenhum produto encontrado
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
        <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark dark:text-white">
          <Plus size={20} />
          Novo produto
        </h2>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field
            label="Nome"
            value={form.name}
            onChange={(value) => setForm((old) => ({ ...old, name: value }))}
            required
          />

          <Field
            label="Categoria"
            value={form.category}
            onChange={(value) => setForm((old) => ({ ...old, category: value }))}
            required
            placeholder="Ex.: Carnes, Laticínios, Produção..."
          />

          <div>
            <label className="block text-sm font-black text-slate-700 dark:text-slate-200">
              Conservação padrão
            </label>

            <select
              value={form.defaultMode}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  defaultMode: event.target.value as ConservationMode,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
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
            placeholder="Ex.: leite, molho, frango..."
          />

          <Field
            label="URL da foto"
            value={form.imageUrl}
            onChange={(value) => setForm((old) => ({ ...old, imageUrl: value }))}
            placeholder="Opcional"
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
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#202020]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
                  Editar
                </p>

                <h2 className="mt-1 text-2xl font-black text-safe-dark dark:text-white">
                  Produto
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
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
                <label className="block text-sm font-black text-slate-700 dark:text-slate-200">
                  Conservação padrão
                </label>

                <select
                  value={editForm.defaultMode}
                  onChange={(event) =>
                    setEditForm((old) => ({
                      ...old,
                      defaultMode: event.target.value as ConservationMode,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
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

              <Field
                label="URL da foto"
                value={editForm.imageUrl}
                onChange={(value) => setEditForm((old) => ({ ...old, imageUrl: value }))}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-[#202020]">
      <p className="text-xl font-black text-safe-dark dark:text-white">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>
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
      <label className="block text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <input
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
      />
    </div>
  );
}

export default Products;