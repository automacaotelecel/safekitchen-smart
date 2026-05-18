import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  ArrowLeft,
  Camera,
  CalendarClock,
  CheckCircle2,
  ImageIcon,
  PackagePlus,
  Printer,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { api, pdfUrl } from '../api/client';
import type { Label, ProductDetails as ProductDetailsType } from '../types';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    reader.readAsDataURL(file);
  });
}

function statusOf(label: Label) {
  if (!label.expiresAt) return 'no-expiration';
  const days = differenceInCalendarDays(new Date(label.expiresAt), new Date());
  if (days < 0) return 'expired';
  if (days <= 7) return 'next';
  return 'valid';
}

function statusText(label: Label) {
  if (!label.expiresAt) return 'Sem validade automática';
  const days = differenceInCalendarDays(new Date(label.expiresAt), new Date());
  if (days < 0) return `Venceu há ${Math.abs(days)} dia(s)`;
  if (days === 0) return 'Vence hoje';
  return `Vence em ${days} dia(s)`;
}

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetailsType | null>(null);
  const [filter, setFilter] = useState<'expired' | 'next' | 'valid'>('expired');
  const [error, setError] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!id) return;
    const data = await api<ProductDetailsType>(`/api/products/${id}`);
    setProduct(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar produto.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !product) return;

    setSavingPhoto(true);
    setError('');

    try {
      if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.');
      if (file.size > 4 * 1024 * 1024) throw new Error('A imagem está muito grande. Use uma imagem de até 4MB.');

      const imageUrl = await fileToDataUrl(file);
      const updated = await api<ProductDetailsType | ProductDetailsType['validityRules'][number]>(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ imageUrl })
      });

      setProduct((old) => old ? { ...old, imageUrl: (updated as ProductDetailsType).imageUrl || imageUrl } : old);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar foto.');
    } finally {
      setSavingPhoto(false);
      event.target.value = '';
    }
  }

  const labels = product?.labels || [];

  const filteredLabels = useMemo(() => {
    return labels.filter((label) => statusOf(label) === filter);
  }, [labels, filter]);

  const expiredCount = labels.filter((label) => statusOf(label) === 'expired').length;
  const nextCount = labels.filter((label) => statusOf(label) === 'next').length;
  const validCount = labels.filter((label) => statusOf(label) === 'valid').length;

  if (!product && !error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">
        Carregando produto...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
        <p className="font-black text-red-700">{error || 'Produto não encontrado.'}</p>
        <button onClick={() => navigate('/produtos')} className="mt-4 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white">
          Voltar para produtos
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate('/produtos')} className="mb-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm">
        <ArrowLeft size={18} /> Voltar aos produtos
      </button>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-app">
        <div className="bg-safe-green px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/produtos')} className="rounded-2xl bg-white/15 p-2">
                <ArrowLeft size={20} />
              </button>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">Detalhes</p>
                <h1 className="text-xl font-black leading-tight">{product.name}</h1>
              </div>
            </div>

            <Link to={`/nova-etiqueta?productId=${product.id}`} className="rounded-2xl bg-white/15 px-4 py-2 text-xs font-black text-white">
              Gerar etiqueta
            </Link>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-4 ring-safe-soft">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-safe-green">
                  <ImageIcon size={36} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                <Info label="Categoria" value={product.category} />
                <Info label="Conservação" value={product.defaultMode} />
                <Info label="Tipo" value={product.isGlobal ? 'Base global' : 'Produto personalizado'} />
                <Info label="Adicionado em" value={product.createdAt ? format(new Date(product.createdAt), 'dd/MM/yyyy') : '-'} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => cameraInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl bg-safe-green px-4 py-3 text-xs font-black text-white">
                  <Camera size={16} /> Tirar foto
                </button>

                <button type="button" onClick={() => galleryInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-safe-dark">
                  <UploadCloud size={16} /> Anexar foto
                </button>

                <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-safe-dark shadow-sm">
                  <RefreshCw size={16} /> Atualizar
                </button>
              </div>

              {savingPhoto && <p className="mt-2 text-xs font-bold text-safe-green">Salvando foto...</p>}
              {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            </div>
          </div>

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

          <div className="mt-6">
            <p className="text-sm font-black text-safe-green">Lotes ainda não tratados</p>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2">
              <FilterButton active={filter === 'expired'} onClick={() => setFilter('expired')} label={`Vencidos (${expiredCount})`} />
              <FilterButton active={filter === 'next'} onClick={() => setFilter('next')} label={`Próximos (${nextCount})`} />
              <FilterButton active={filter === 'valid'} onClick={() => setFilter('valid')} label={`Não vencidos (${validCount})`} />
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[1fr_120px_120px_100px] bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 max-md:hidden">
                <span>Nome</span>
                <span>Vence em</span>
                <span>Quantidade</span>
                <span className="text-right">Ações</span>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredLabels.map((label) => (
                  <div key={label.id} className={`grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_120px_120px_100px] md:items-center ${statusOf(label) === 'expired' ? 'bg-red-50/70' : statusOf(label) === 'next' ? 'bg-yellow-50/70' : 'bg-white'}`}>
                    <div>
                      <p className="font-black text-slate-900">{label.productName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Lote: {label.batch || '-'} • Resp.: {label.responsibleName}</p>
                    </div>

                    <div className="font-bold text-slate-600">
                      {label.expiresAt ? format(new Date(label.expiresAt), 'dd/MM/yyyy') : '-'}
                      <p className="text-[11px] font-black text-safe-blue">{statusText(label)}</p>
                    </div>

                    <div className="font-bold text-slate-600">{label.quantity || '-'}</div>

                    <div className="flex justify-end">
                      <button type="button" onClick={() => window.open(pdfUrl(label.id), '_blank')} className="inline-flex items-center gap-1 rounded-xl bg-safe-dark px-3 py-2 text-xs font-black text-white">
                        <Printer size={14} /> PDF
                      </button>
                    </div>
                  </div>
                ))}

                {filteredLabels.length === 0 && (
                  <div className="p-5 text-sm font-bold text-slate-500">
                    Nenhum lote encontrado neste filtro.
                  </div>
                )}
              </div>
            </div>

            <Link to={`/nova-etiqueta?productId=${product.id}`} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-safe-green px-5 py-3 text-sm font-black text-white shadow-lg">
              <PackagePlus size={18} /> Adicionar lote / gerar etiqueta
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {product.validityRules.map((rule) => (
              <div key={rule.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-safe-green">Regra</p>
                <p className="mt-2 text-lg font-black text-safe-dark">
                  {rule.validityValue} {rule.validityUnit === 'hours' ? 'hora(s)' : 'dia(s)'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{rule.conservationMode}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 font-black text-safe-dark">{value}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-black transition ${active ? 'bg-slate-950 text-white' : 'bg-white text-slate-700'}`}
    >
      {label}
    </button>
  );
}

export default ProductDetails;
