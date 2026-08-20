import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bluetooth, Printer, RefreshCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import type { Label, LabelExtraData, LabelType } from '../types';
import { formatPtDate, formatPtDateTime } from '../utils/date';
import { labelBaseDateName } from '../utils/labels';
import {
  getDirectPrintSupport,
  printDirectToTomate,
  TOMATE_PRINT_BUILD,
} from '../utils/niimbotDirectPrint';

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
  return formatPtDateTime(value);
}

function brDate(value?: string | null) {
  return formatPtDate(value);
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
        {!isSample && label.type !== 'ARMAZENAMENTO_CARNES' && (
          <Row label={labelBaseDateName(label.type)} value={brDateTime(label.openedAt)} />
        )}

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
            <Row
              label="Temperatura"
              value={
                extra.receivingTemperatureC !== null &&
                extra.receivingTemperatureC !== undefined &&
                asText(extra.receivingTemperatureC) !== ''
                  ? `${asText(extra.receivingTemperatureC)} °C`
                  : undefined
              }
            />
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
        SafeKitchen Smart - {label.id}
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
      let decodedId = '';

      try {
        decodedId = decodeURIComponent(id || '').trim();
      } catch {
        // Ignora apenas o item malformado, sem derrubar toda a tela de impressão.
      }

      return {
        id: decodedId,
        copies:
          Number.isFinite(copies) && copies > 0
            ? Math.min(Math.floor(copies), 30)
            : 1,
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
  const [directPrinting, setDirectPrinting] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const directPrintingRef = useRef(false);
  const directSupport = useMemo(() => getDirectPrintSupport(), []);

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

  async function printOnTomate() {
    if (!labels.length || directPrintingRef.current) return;

    directPrintingRef.current = true;
    setDirectPrinting(true);
    setError('');
    setPrintMessage('');

    try {
      await printDirectToTomate(labels, (progress) => {
        setPrintMessage(progress.message);
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao imprimir diretamente na MDK-022.');
    } finally {
      directPrintingRef.current = false;
      setDirectPrinting(false);
    }
  }

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

        {directSupport.supported && (
          <button
            type="button"
            onClick={printOnTomate}
            disabled={loading || labels.length === 0 || directPrinting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-50"
          >
            <Bluetooth size={17} />
            {directPrinting ? 'Enviando para MDK-022…' : 'Imprimir direto na Tomate MDK-022'}
          </button>
        )}

        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || labels.length === 0 || directPrinting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm disabled:opacity-50"
        >
          <Printer size={16} />
          Imprimir pelo navegador
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
        {directSupport.supported ? (
          <>
            <strong>Impressão direta TSPL:</strong> ligue a Tomate MDK-022 e feche o
            Print-Label/BarTender. No Android, selecione “MDK-022” na janela BLE. No Windows,
            emparelhe antes a impressora (PIN 0000) e selecione sua porta Bluetooth/USB. Faça
            o primeiro teste com uma única etiqueta.
          </>
        ) : (
          <>
            <strong>Bluetooth direto indisponível:</strong> {directSupport.reason} No
            Windows, instale o driver 4BARCODE fornecido com a impressora e use “Imprimir pelo
            navegador” com papel 102 × 152 mm, escala 100% e sem margens.
          </>
        )}
      </div>

      <p className="no-print mb-3 text-center text-[10px] font-bold text-slate-400">
        Build de impressão: {TOMATE_PRINT_BUILD}
      </p>

      {loading && <p className="no-print print-page-status">Preparando etiquetas...</p>}
      {printMessage && !error && (
        <p className="no-print print-page-status">{printMessage}</p>
      )}
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
