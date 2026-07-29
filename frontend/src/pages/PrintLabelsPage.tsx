import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer, RefreshCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import type { Label, LabelExtraData, LabelType } from '../types';

const labelTypeMap: Record<string, string> = {
  PRODUTO_ABERTO: 'Produto aberto',
  PRODUCAO: 'Produção',
  DESCONGELAMENTO_DESSALGUE: 'Descongelamento/dessalgue',
  ARMAZENAMENTO_CARNES: 'Armazenamento de carnes',
  REEMBALAGEM: 'Reembalagem',
  AMOSTRAS: 'Amostras',
  NAO_CONFORME: 'Não conforme',
  PRODUTO_QUIMICO: 'Produto químico',
};

function labelTypeName(type?: LabelType | string | null) {
  return labelTypeMap[type || ''] || type || 'Etiqueta';
}

function brDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function brDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('pt-BR');
}

function conservationName(mode?: string | null) {
  const map: Record<string, string> = {
    AMBIENTE: 'Ambiente',
    REFRIGERADO: 'Refrigerado',
    CONGELADO: 'Congelado',
  };

  return map[mode || ''] || mode || '—';
}

function getExtraData(label: Label): LabelExtraData {
  if (!label.extraData) return {};

  if (typeof label.extraData === 'object') return label.extraData;

  try {
    const parsed = JSON.parse(label.extraData);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function asText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '—') return null;

  return (
    <div className="print-label-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LabelCard({ label }: { label: Label }) {
  const extra = getExtraData(label);
  const isSample = label.type === 'AMOSTRAS';
  const validityTitle = isSample ? 'Descarte' : 'Validade';

  return (
    <article className="print-label-card">
      <header className="print-label-header">
        <div>
          <p>{labelTypeName(label.type)}</p>
          <h2>{label.productName || 'Produto'}</h2>
        </div>
      </header>

      <main className="print-label-body">
        <Row label="Responsável" value={label.responsibleName || '—'} />
        <Row label={validityTitle} value={brDateTime(label.expiresAt)} />

        {!isSample && <Row label="Conservação" value={conservationName(label.conservationMode)} />}
        {!isSample && <Row label="Aberto/manipulado" value={brDateTime(label.openedAt)} />}

        {isSample && <Row label="Restaurante" value={asText(extra.restaurantName) || '—'} />}
        {isSample && <Row label="Turno" value={asText(extra.sampleShift) || '—'} />}
        {isSample && (
          <Row
            label="Coleta"
            value={`${brDate(asText(extra.collectionDate))} ${asText(extra.collectionTime)}`.trim()}
          />
        )}

        {label.type === 'ARMAZENAMENTO_CARNES' && (
          <>
            <Row label="Tipo" value={asText(extra.meatType)} />
            <Row label="MAPA/SIF" value={asText(extra.mapaSif)} />
            <Row label="Recebimento" value={brDate(asText(extra.receiptDate))} />
            <Row label="Armazenamento" value={asText(extra.storageType)} />
          </>
        )}

        {label.type === 'PRODUTO_QUIMICO' && (
          <>
            <Row label="Finalidade" value={asText(extra.chemicalPurpose)} />
            <Row label="Validade" value={brDate(asText(extra.chemicalValidity))} />
            <Row label="Diluição ml" value={asText(extra.dilutionMl)} />
            <Row label="Diluição água" value={asText(extra.dilutionLiters)} />
          </>
        )}

        {label.type === 'NAO_CONFORME' && (
          <>
            <Row label="Não conformidade" value={asText(extra.nonConformityReasons)} />
            <Row label="Ação" value={asText(extra.actionTaken)} />
          </>
        )}

        <Row label="Marca" value={label.brand || undefined} />
        <Row label="Fornecedor" value={label.supplier || undefined} />
        <Row label="Lote" value={label.batch || undefined} />
        <Row label="Quantidade" value={label.quantity || undefined} />
        <Row label="Obs." value={label.observations || undefined} />
      </main>

      <footer className="print-label-footer">
        SafeKitchen Smart • {label.id}
      </footer>
    </article>
  );
}

function parsePrintItems(raw: string | null) {
  if (!raw) return [] as Array<{ id: string; copies: number }>;

  return raw
    .split(',')
    .map((piece) => {
      const [id, copiesRaw] = piece.split(':');
      const copies = Number(copiesRaw || 1);
      return {
        id: decodeURIComponent(id || '').trim(),
        copies: Number.isFinite(copies) && copies > 0 ? Math.min(copies, 30) : 1,
      };
    })
    .filter((item) => item.id);
}

export function PrintLabelsPage() {
  const [params] = useSearchParams();
  const printItems = useMemo(() => parsePrintItems(params.get('items')), [params]);

  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadLabels() {
      setLoading(true);
      setError('');

      if (printItems.length === 0) {
        setLabels([]);
        setLoading(false);
        return;
      }

      try {
        const allLabels = await api<Label[]>('/api/labels/by-ids', {
          method: 'POST',
          body: JSON.stringify({
            ids: Array.from(new Set(printItems.map((item) => item.id))),
          }),
        });

        const orderedLabels: Label[] = [];

        printItems.forEach((item) => {
          const label = allLabels.find((candidate) => candidate.id === item.id);
          if (!label) return;

          for (let index = 0; index < item.copies; index += 1) {
            orderedLabels.push(label);
          }
        });

        setLabels(orderedLabels);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Erro ao preparar impressão.');
      } finally {
        setLoading(false);
      }
    }

    loadLabels();
  }, [printItems]);

  useEffect(() => {
    if (loading || error || labels.length === 0) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [loading, error, labels.length]);

  return (
    <div className="print-page-screen">
      <div className="no-print print-page-toolbar">
        <Link
          to="/impressao"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || labels.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50"
        >
          <Printer size={16} />
          Imprimir agora
        </button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm"
        >
          <RefreshCcw size={16} />
          Recarregar
        </button>
      </div>

      <div className="no-print print-page-help">
        <strong>Niimbot B21:</strong> conecte a impressora por USB e instale o software
        oficial da Niimbot no Windows. Na janela de impressão, selecione a B21, use papel
        50 × 30 mm, escala 100%, margens ausentes e desative cabeçalhos e rodapés. Se a
        B21 não aparecer em Destino, ela ainda não está registrada como impressora do
        Windows.
      </div>

      {loading && <p className="no-print print-page-status">Preparando etiquetas...</p>}
      {error && <p className="no-print print-page-error">{error}</p>}
      {!loading && !error && labels.length === 0 && (
        <p className="no-print print-page-error">Nenhuma etiqueta selecionada para impressão.</p>
      )}

      <section className="print-label-sheet">
        {labels.map((label, index) => (
          <LabelCard key={`${label.id}-${index}`} label={label} />
        ))}
      </section>
    </div>
  );
}

export default PrintLabelsPage;
