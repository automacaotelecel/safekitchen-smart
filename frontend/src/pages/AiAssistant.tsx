import { ChangeEvent, useEffect, useState } from 'react';
import {
  Camera,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
  ArrowRight,
  BookOpenCheck,
  ExternalLink,
  Send,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import type {
  RegulatoryAnswer,
  VisionIdentifyResponse,
} from '../types';

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
  const [regulatoryQuestion, setRegulatoryQuestion] = useState('');
  const [jurisdiction, setJurisdiction] = useState<'BR' | 'SP'>('BR');
  const [regulatoryAnswer, setRegulatoryAnswer] =
    useState<RegulatoryAnswer | null>(null);
  const [askingRegulation, setAskingRegulation] = useState(false);
  const [regulatoryMessage, setRegulatoryMessage] = useState('');

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
          : 'Não foi possível verificar a configuração da Sana.'
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
      setMessage('Tire uma foto ou escolha uma imagem para a Sana analisar.');
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
      setMessage('A Sana concluiu a leitura. Confira as sugestões antes de usar no cadastro ou na etiqueta.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A Sana não conseguiu identificar o produto.');
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

  async function askRegulation() {
    if (regulatoryQuestion.trim().length < 5) {
      setRegulatoryMessage('Escreva uma pergunta com um pouco mais de detalhe.');
      return;
    }

    setAskingRegulation(true);
    setRegulatoryMessage('');
    setRegulatoryAnswer(null);

    try {
      const data = await api<RegulatoryAnswer>('/api/vision/ask-regulation', {
        method: 'POST',
        body: JSON.stringify({
          question: regulatoryQuestion.trim(),
          jurisdiction,
        }),
      });
      setRegulatoryAnswer(data);
    } catch (error) {
      setRegulatoryMessage(
        error instanceof Error
          ? error.message
          : 'A Sana não conseguiu consultar a base regulatória.'
      );
    } finally {
      setAskingRegulation(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020] sm:rounded-[28px] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#19d09c,#0a7c86)] text-white shadow-lg shadow-emerald-100">
              <Sparkles size={25} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-safe-green sm:text-xs sm:tracking-[0.26em]">
                Sana · assistente inteligente
              </p>

              <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white">
                Olá, eu sou a Sana
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
                Envie uma foto e eu ajudo a reconhecer o produto, a marca, o lote visível, a categoria e o tipo de etiqueta. Minhas sugestões sempre devem ser conferidas pela equipe responsável.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHealth}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-safe-dark transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#151515] dark:text-white dark:hover:bg-white/10"
          >
            <Sparkles size={16} />
            {checking ? 'Verificando Sana...' : 'Verificar Sana'}
          </button>
        </div>

        <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${health?.enabled ? 'bg-emerald-50 text-emerald-700' : checking ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
          <span className={`h-2 w-2 rounded-full ${health?.enabled ? 'bg-emerald-500' : checking ? 'bg-slate-400' : 'bg-amber-500'}`} />
          {checking ? 'Verificando disponibilidade' : health?.enabled ? 'Sana pronta para ajudar' : 'Sana temporariamente indisponível'}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#202020] sm:rounded-[28px] sm:p-5">
          <h2 className="text-xl font-black text-safe-dark dark:text-white">Foto para análise</h2>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#151515]">
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020]">
                <img src={imageUrl} alt="Imagem enviada para a Sana" className="max-h-[480px] w-full object-contain" />

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
              {loading ? 'Sana está analisando...' : 'Analisar com a Sana'}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-safe-soft px-4 py-3 text-sm font-bold text-safe-dark">
              {message}
            </div>
          )}
        </div>

        <aside className="h-fit min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#202020] sm:rounded-[28px] sm:p-5">
          <h2 className="text-xl font-black text-safe-dark dark:text-white">Sugestão da Sana</h2>

          {!result ? (
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              Assim que eu analisar a foto, minhas sugestões aparecerão aqui. Confira os dados antes de cadastrar ou gerar a etiqueta.
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

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020] sm:rounded-[28px] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-safe-soft text-safe-green">
            <BookOpenCheck size={23} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-safe-green">
              Base regulatória oficial
            </p>
            <h2 className="mt-1 text-2xl font-black text-safe-dark dark:text-white">
              Pergunte à Sana sobre Boas Práticas
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
              Consulte a RDC Anvisa nº 216/2004 e, para São Paulo, a transição entre
              as Portarias CVS nº 5/2013 e nº 3/2026. A resposta mostra as fontes
              utilizadas e não substitui o responsável técnico.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[180px_1fr_auto]">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Jurisdição
            </span>
            <select
              value={jurisdiction}
              onChange={(event) =>
                setJurisdiction(event.target.value as 'BR' | 'SP')
              }
              className="input-base mt-2"
            >
              <option value="BR">Nacional</option>
              <option value="SP">São Paulo</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Pergunta
            </span>
            <textarea
              value={regulatoryQuestion}
              onChange={(event) => setRegulatoryQuestion(event.target.value)}
              className="input-base mt-2 min-h-[52px] resize-y"
              placeholder="Ex.: O que devo verificar no recebimento de alimentos refrigerados?"
            />
          </label>

          <button
            type="button"
            onClick={askRegulation}
            disabled={askingRegulation}
            className="mt-6 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-safe-dark px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {askingRegulation ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
            {askingRegulation ? 'Consultando...' : 'Perguntar'}
          </button>
        </div>

        {regulatoryMessage && (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {regulatoryMessage}
          </p>
        )}

        {regulatoryAnswer && (
          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
            <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-safe-dark">
              {regulatoryAnswer.answer}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {regulatoryAnswer.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700"
                >
                  {source.title}
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>

            <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
              {regulatoryAnswer.disclaimer}
            </p>
          </div>
        )}
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
