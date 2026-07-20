import { ChangeEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import type { VisionIdentifyResponse } from '../types';

type AiHealth = {
  enabled: boolean;
  model: string;
  message: string;
};

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
        const maxSize = 1000;
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
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function AiAssistant() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [result, setResult] = useState<VisionIdentifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');

  async function loadHealth() {
    setChecking(true);

    try {
      const data = await api<AiHealth>('/api/vision/health');
      setHealth(data);
    } catch (error) {
      setHealth(null);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível verificar a configuração da IA.'
      );
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      setMessage('');
      setResult(null);
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageUrl(dataUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar imagem.');
    }
  }

  async function identify() {
    if (!imageUrl) {
      setMessage('Tire uma foto ou escolha uma imagem antes de usar a IA.');
      return;
    }

    setLoading(true);
    setMessage('');
    setResult(null);

    try {
      const data = await api<VisionIdentifyResponse>('/api/vision/identify-product', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: imageUrl,
          mimeType: 'image/jpeg',
        }),
      });

      setResult(data);
      setMessage('IA respondeu. Confira as informações antes de usar no cadastro ou na etiqueta.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao identificar produto com IA.');
    } finally {
      setLoading(false);
    }
  }

  function useSuggestion() {
    if (!result) return;

    sessionStorage.setItem(
      'safekitchen_ai_suggestion',
      JSON.stringify({
        ...result.suggestion,
        matchedProductId: result.matchedProduct?.id || null,
      })
    );
    navigate('/nova-etiqueta');
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Inteligência artificial
            </p>

            <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white">
              Módulo de IA
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
              Use uma foto para sugerir nome do produto, marca, lote visível, categoria e tipo de etiqueta. A IA não substitui a validação da nutricionista/responsável técnico.
            </p>
          </div>

          <button
            type="button"
            onClick={loadHealth}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-safe-dark transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#151515] dark:text-white dark:hover:bg-white/10"
          >
            <Sparkles size={16} />
            Testar configuração
          </button>
        </div>

        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${
            health?.enabled
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          {checking ? (
            <Loader2 className="mt-0.5 animate-spin" size={18} />
          ) : health?.enabled ? (
            <CheckCircle2 className="mt-0.5" size={18} />
          ) : (
            <AlertTriangle className="mt-0.5" size={18} />
          )}

          <div>
            <p>{checking ? 'Verificando IA...' : health?.message || 'IA não verificada.'}</p>
            {health?.model && <p className="mt-1 text-xs opacity-80">Modelo: {health.model}</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
          <h2 className="text-xl font-black text-safe-dark dark:text-white">Foto para análise</h2>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#151515]">
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020]">
                <img src={imageUrl} alt="Imagem para IA" className="max-h-[480px] w-full object-contain" />

                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setResult(null);
                  }}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-red-600 shadow"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-white/10 dark:bg-[#202020]">
                <ImagePlus size={42} className="text-safe-green" />
                <p className="mt-3 text-lg font-black text-safe-dark dark:text-white">Adicionar foto</p>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                  Prefira foto nítida, com rótulo visível e boa iluminação.
                </p>
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white">
                <Camera size={16} />
                Tirar foto
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
              </label>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm dark:bg-[#202020] dark:text-white">
                <ImagePlus size={16} />
                Galeria
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </div>

            <button
              type="button"
              onClick={identify}
              disabled={!imageUrl || loading || health?.enabled === false}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {loading ? 'Analisando imagem...' : 'Identificar com IA'}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-safe-soft px-4 py-3 text-sm font-bold text-safe-dark">
              {message}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
          <h2 className="text-xl font-black text-safe-dark dark:text-white">Resultado da IA</h2>

          {!result ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              O resultado aparecerá aqui depois da análise. Use como sugestão e confira todos os dados antes de cadastrar ou gerar etiqueta.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <ResultRow label="Produto" value={result.suggestion.productName || '—'} />
              <ResultRow label="Marca" value={result.suggestion.brand || 'não identificada'} />
              <ResultRow label="Lote" value={result.suggestion.detectedBatch || 'não identificado'} />
              <ResultRow label="Categoria" value={result.suggestion.category || '—'} />
              <ResultRow label="Conservação" value={result.suggestion.conservationMode || '—'} />
              <ResultRow label="Tipo sugerido" value={result.suggestion.labelType || '—'} />
              <ResultRow label="Confiança" value={confidencePercent(result.suggestion.confidence)} />

              {result.matchedProduct && (
                <div className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  Produto parecido encontrado no cadastro: {result.matchedProduct.name}
                </div>
              )}

              <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
                {result.warning || result.suggestion.notes}
              </div>

              <button
                type="button"
                onClick={useSuggestion}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white"
              >
                Usar na nova etiqueta
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#151515]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 font-black text-safe-dark dark:text-white">{value}</p>
    </div>
  );
}

export default AiAssistant;
