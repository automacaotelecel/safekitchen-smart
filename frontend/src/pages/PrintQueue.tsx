import { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  FileText,
  RefreshCcw,
  Search,
  Share2,
  Square,
} from 'lucide-react';

import { api, API_URL, getToken } from '../api/client';
import { formatDateBR, getValidityVisual } from '../utils/validityVisual';
import {
  getMobilePrintHelpText,
  shareOrOpenPdfFromPost,
  shareOrOpenPdfFromUrl,
} from '../utils/printPdf';

type LabelItem = {
  id: string;
  type?: string;
  labelType?: string;
  productName: string;
  responsibleName?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  status?: string | null;
};

type PrintSelection = {
  id: string;
  copies: number;
};

function labelTypeText(type?: string) {
  const map: Record<string, string> = {
    PRODUTO_ABERTO: 'Produto aberto',
    PRODUCAO: 'Produção',
    DESCONGELAMENTO_DESSALGUE: 'Descongelamento/dessalgue',
    ARMAZENAMENTO_CARNES: 'Armazenamento de carnes',
    REEMBALAGEM: 'Reembalagem',
    AMOSTRAS: 'Amostras',
    NAO_CONFORME: 'Não conforme',
    PRODUTO_QUIMICO: 'Produto químico',

    OPEN_PRODUCT: 'Produto aberto',
    PRODUCTION: 'Produção',
    THAWING: 'Descongelamento/dessalgue',
    MEAT_STORAGE: 'Armazenamento de carnes',
    REPACKAGING: 'Reembalagem',
    SAMPLE: 'Amostras',
    NON_CONFORMING: 'Não conforme',
    CHEMICAL: 'Produto químico',
  };

  return map[type || ''] || type || 'Etiqueta';
}

function getLabelType(item: LabelItem) {
  return item.type || item.labelType || '';
}

function slugText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function PrintQueue() {
  const [items, setItems] = useState<LabelItem[]>([]);
  const [selected, setSelected] = useState<PrintSelection[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');

  async function loadItems() {
    setLoading(true);
    setMessage('');

    try {
      const response = await api<unknown>('/api/labels?includeCanceled=0&limit=300');

      const labels = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.labels)
          ? (response as any).labels
          : [];

      setItems(labels as LabelItem[]);
    } catch (error) {
      console.error(error);
      setItems([]);
      setMessage('Não foi possível carregar as etiquetas para impressão.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return items;

    return items.filter((item) => {
      const content = `${item.productName || ''} ${getLabelType(item)} ${
        item.responsibleName || ''
      } ${item.status || ''}`.toLowerCase();

      return content.includes(term);
    });
  }, [items, search]);

  const selectedIds = selected.map((item) => item.id);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));

  function isSelected(id: string) {
    return selectedIds.includes(id);
  }

  function toggleItem(id: string) {
    setSelected((old) => {
      if (old.some((item) => item.id === id)) {
        return old.filter((item) => item.id !== id);
      }

      return [...old, { id, copies: 1 }];
    });
  }

  function setCopies(id: string, copies: number) {
    const safeCopies = Math.min(Math.max(copies || 1, 1), 30);

    setSelected((old) =>
      old.map((item) => (item.id === id ? { ...item, copies: safeCopies } : item))
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelected((old) =>
        old.filter(
          (selectedItem) => !filteredItems.some((item) => item.id === selectedItem.id)
        )
      );

      return;
    }

    setSelected((old) => {
      const next = [...old];

      filteredItems.forEach((item) => {
        if (!next.some((selectedItem) => selectedItem.id === item.id)) {
          next.push({
            id: item.id,
            copies: 1,
          });
        }
      });

      return next;
    });
  }

  function openSinglePdf(id: string) {
    const token = getToken();
    window.open(`${API_URL}/api/labels/${id}/pdf?token=${token || ''}`, '_blank');
  }

  async function shareSinglePdf(item: LabelItem) {
    setSharing(true);
    setMessage('');

    try {
      const token = getToken();
      const fileName = `etiqueta-${slugText(item.productName || 'produto')}.pdf`;

      const result = await shareOrOpenPdfFromUrl(`${API_URL}/api/labels/${item.id}/pdf`, {
        token,
        fileName,
        title: `Etiqueta - ${item.productName}`,
        text: `Etiqueta SafeKitchen de ${item.productName}.`,
      });

      setMessage(result.message);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível compartilhar ou abrir a etiqueta.'
      );
    } finally {
      setSharing(false);
    }
  }

  async function shareBatchPdf() {
    if (!selected.length) {
      setMessage('Selecione pelo menos uma etiqueta.');
      return;
    }

    setSharing(true);
    setMessage('');

    try {
      const token = getToken();

      const result = await shareOrOpenPdfFromPost(
        `${API_URL}/api/labels/batch-pdf`,
        {
          items: selected.map((item) => ({
            id: item.id,
            copies: item.copies,
          })),
        },
        {
          token,
          fileName: 'etiquetas-safekitchen.pdf',
          title: 'Etiquetas SafeKitchen',
          text: 'Etiquetas geradas pelo SafeKitchen Smart.',
        }
      );

      setMessage(result.message);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao gerar etiquetas para compartilhar/imprimir.'
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Impressão
            </p>

            <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white">
              Central de impressão
            </h1>

            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
              Selecione etiquetas, defina a quantidade de cópias e use o botão
              compartilhar/imprimir para enviar pelo celular ou abrir no computador.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadItems}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-safe-dark transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#151515] dark:text-white dark:hover:bg-white/10"
            >
              <RefreshCcw size={16} />
              Atualizar
            </button>

            <button
              type="button"
              onClick={shareBatchPdf}
              disabled={!selected.length || sharing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Share2 size={16} />
              {sharing
                ? 'Preparando...'
                : `Compartilhar / imprimir (${selected.length})`}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-safe-soft px-4 py-3 text-xs font-bold leading-5 text-safe-dark">
          {getMobilePrintHelpText()}
        </div>

        <div className="relative mt-5">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por produto, tipo ou responsável..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
          />
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {message}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-safe-dark dark:text-white">
              Etiquetas disponíveis
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-300">
              {filteredItems.length} resultado(s)
            </p>
          </div>

          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allVisibleSelected ? 'Desmarcar visíveis' : 'Marcar visíveis'}
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-500 dark:border-white/10 dark:text-slate-300">
            Carregando etiquetas...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-medium text-slate-500 dark:border-white/10 dark:text-slate-300">
            Nenhuma etiqueta encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const checked = isSelected(item.id);
              const selectedItem = selected.find((selection) => selection.id === item.id);
              const visual = getValidityVisual(item.expiresAt, item.status);

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 transition ${visual.cardClass}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="flex flex-1 items-start gap-3 text-left"
                    >
                      <div className="mt-1 text-safe-green">
                        {checked ? <CheckSquare size={20} /> : <Square size={20} />}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-black text-safe-dark dark:text-white">
                            {item.productName || 'Produto sem nome'}
                          </p>

                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${visual.badgeClass}`}
                          >
                            {visual.label}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
                          {labelTypeText(getLabelType(item))}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span>Responsável: {item.responsibleName || '—'}</span>
                          <span>Validade: {formatDateBR(item.expiresAt)}</span>
                          <span>Criada em: {formatDateBR(item.createdAt)}</span>
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {checked && (
                        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-[#202020] dark:text-slate-200">
                          Cópias
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={selectedItem?.copies || 1}
                            onChange={(event) => setCopies(item.id, Number(event.target.value))}
                            className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-center text-sm outline-none dark:border-white/10 dark:bg-[#151515]"
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        onClick={() => openSinglePdf(item.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-safe-dark transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#202020] dark:text-white dark:hover:bg-white/10"
                      >
                        <FileText size={16} />
                        Abrir PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => shareSinglePdf(item)}
                        disabled={sharing}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
                      >
                        <Share2 size={16} />
                        Compartilhar / imprimir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default PrintQueue;