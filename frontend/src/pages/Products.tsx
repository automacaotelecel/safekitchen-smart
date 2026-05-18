import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, ImageIcon, Plus, Search, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ConservationMode, Product } from '../types';

type ProductForm = {
  name: string;
  category: string;
  imageUrl: string;
  defaultMode: ConservationMode;
  validityValue: string;
  validityUnit: 'days' | 'hours';
  keywords: string;
};

const emptyForm: ProductForm = {
  name: '',
  category: '',
  imageUrl: '',
  defaultMode: 'REFRIGERADO',
  validityValue: '',
  validityUnit: 'days',
  keywords: ''
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const data = await api<Product[]>('/api/products');
    setProducts(data);
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoLoading(true);
    setError('');

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Selecione um arquivo de imagem.');
      }

      if (file.size > 4 * 1024 * 1024) {
        throw new Error('A imagem está muito grande. Use uma imagem de até 4MB.');
      }

      const dataUrl = await fileToDataUrl(file);
      setForm((old) => ({ ...old, imageUrl: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    } finally {
      setPhotoLoading(false);
      event.target.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    try {
      await api<Product>('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          validityValue: Number(form.validityValue),
          imageUrl: form.imageUrl.trim()
        })
      });

      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar produto.');
    }
  }

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return products.filter((p) => `${p.name} ${p.category} ${p.keywords}`.toLowerCase().includes(query));
  }, [products, search]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Banco de validade</p>
        <h1 className="mt-2 text-3xl font-black text-safe-dark lg:text-4xl">Produtos</h1>
        <p className="mt-2 text-slate-500">
          Base global + produtos personalizados do restaurante. Clique em um produto para abrir o submenu de detalhes.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-transparent text-sm font-semibold"
          />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {filtered.map((product) => (
            <Link
              key={product.id}
              to={`/produtos/${product.id}`}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-app"
            >
              <div className="flex items-start gap-4">
                <ProductImage product={product} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{product.category}</p>
                    </div>

                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${product.isGlobal ? 'bg-safe-soft text-safe-blue' : 'bg-purple-50 text-purple-700'}`}>
                      {product.isGlobal ? 'Base' : 'Personalizado'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
                    <span>
                      {product.validityRules[0]?.validityValue || '-'} {product.validityRules[0]?.validityUnit === 'hours' ? 'hora(s)' : 'dia(s)'} • {product.defaultMode}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-black text-safe-green">
                      Detalhes <ChevronRight size={15} className="transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <form onSubmit={submit} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark"><Plus size={20} /> Cadastrar produto</h2>
        <p className="mt-1 text-sm text-slate-500">Use para produtos manipulados próprios do restaurante.</p>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-4">
            <ProductPreview imageUrl={form.imageUrl} />

            <div className="flex-1">
              <p className="text-sm font-black text-slate-700">Foto do produto</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Tire foto pela câmera ou anexe do aparelho.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-3 py-2 text-xs font-black text-white"
                >
                  <Camera size={16} /> Câmera
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-safe-dark shadow-sm"
                >
                  <UploadCloud size={16} /> Anexar
                </button>
              </div>

              {photoLoading && <p className="mt-2 text-xs font-bold text-safe-green">Carregando foto...</p>}
            </div>
          </div>

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        <Field label="Nome" value={form.name} onChange={(v) => setForm((old) => ({ ...old, name: v }))} required />
        <Field label="Categoria" value={form.category} onChange={(v) => setForm((old) => ({ ...old, category: v }))} required />
        <Field label="URL da foto do produto" value={form.imageUrl} onChange={(v) => setForm((old) => ({ ...old, imageUrl: v }))} placeholder="Opcional: URL ou foto carregada automaticamente" />

        <label className="mt-4 block text-sm font-black text-slate-700">Conservação</label>
        <select value={form.defaultMode} onChange={(e) => setForm((old) => ({ ...old, defaultMode: e.target.value as ConservationMode }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
          <option value="AMBIENTE">Ambiente</option>
          <option value="REFRIGERADO">Refrigerado</option>
          <option value="CONGELADO">Congelado</option>
        </select>

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Validade" value={form.validityValue} onChange={(v) => setForm((old) => ({ ...old, validityValue: v.replace(/\D/g, '') }))} required />

          <div>
            <label className="mt-4 block text-sm font-black text-slate-700">Unidade</label>
            <select value={form.validityUnit} onChange={(e) => setForm((old) => ({ ...old, validityUnit: e.target.value as 'days' | 'hours' }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
              <option value="days">Dias</option>
              <option value="hours">Horas</option>
            </select>
          </div>
        </div>

        <Field label="Palavras-chave" value={form.keywords} onChange={(v) => setForm((old) => ({ ...old, keywords: v }))} />

        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <button className="mt-5 w-full rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white">Salvar produto</button>
      </form>
    </div>
  );
}

function ProductImage({ product }: { product: Product }) {
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 object-cover" />;
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-safe-green">
      <ImageIcon size={24} />
    </div>
  );
}

function ProductPreview({ imageUrl }: { imageUrl: string }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="Prévia do produto" className="h-20 w-20 shrink-0 rounded-3xl border border-slate-200 bg-white object-cover" />;
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-slate-200 bg-white text-safe-green">
      <ImageIcon size={28} />
    </div>
  );
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mt-4 block text-sm font-black text-slate-700">{label}</label>
      <input required={required} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold" />
    </div>
  );
}
