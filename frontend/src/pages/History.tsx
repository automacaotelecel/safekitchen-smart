import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarDays,
  FileText,
  RefreshCcw,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';

import { api, API_URL, getToken } from '../api/client';
import { shareOrOpenPdfFromUrl } from '../utils/printPdf';
import type { Label } from '../types';
import { formatDateBR, getValidityVisual } from '../utils/validityVisual';

function labelTypeName(type?: string) {
  const map: Record<string, string> = {
    PRODUTO_ABERTO: 'Produto aberto',
    PRODUCAO: 'Produção',
    DESCONGELAMENTO_DESSALGUE: 'Descongelamento/dessalgue',
    ARMAZENAMENTO_CARNES: 'Armazenamento de carnes',
    REEMBALAGEM: 'Reembalagem',
    AMOSTRAS: 'Amostras',
    NAO_CONFORME: 'Não conforme',
    PRODUTO_QUIMICO: 'Produto químico',
  };

  return map[type || ''] || type || 'Etiqueta';
}

type StatusFilter = 'TODAS' | 'VALIDAS' | 'VENCENDO' | 'VENCIDAS' | 'CANCELADAS';

export function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [labels, setLabels] = useState<Label[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) || 'TODAS'
  );
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sharingId, setSharingId] = useState<string | null>(null);

  async function loadLabels() {
    setLoading(true);
    setMessage('');

    try {
      const data = await api<Label[]>(
        `/api/labels?includeCanceled=${includeCanceled ? '1' : '0'}&limit=300`
      );

      setLabels(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setLabels([]);
      setMessage('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const status = searchParams.get('status') as StatusFilter | null;

    if (
      status &&
      ['TODAS', 'VALIDAS', 'VENCENDO', 'VENCIDAS', 'CANCELADAS'].includes(status)
    ) {
      setStatusFilter(status);

      if (status === 'CANCELADAS') {
        setIncludeCanceled(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    loadLabels();
  }, [includeCanceled]);

  const filteredLabels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return labels.filter((label) => {
      const visual = getValidityVisual(label.expiresAt, label.status);

      const content = `${label.productName} ${label.responsibleName} ${
        label.batch || ''
      } ${labelTypeName(label.type)} ${label.status || ''}`.toLowerCase();

      const searchOk = content.includes(query);

      const statusOk =
        statusFilter === 'TODAS' ||
        (statusFilter === 'VALIDAS' && visual.label === 'Válida') ||
        (statusFilter === 'VENCENDO' && visual.label === 'Vence em breve') ||
        (statusFilter === 'VENCIDAS' && visual.label === 'Vencida') ||
        (statusFilter === 'CANCELADAS' && visual.label === 'Cancelada');

      return searchOk && statusOk;
    });
  }, [labels, search, statusFilter]);

  function openPdf(label: Label) {
    const token = getToken();
    window.open(`${API_URL}/api/labels/${label.id}/pdf?token=${token || ''}`, '_blank');
  }

  async function sharePdf(label: Label) {
    setSharingId(label.id);
    setMessage('');

    try {
      const token = getToken();
      const result = await shareOrOpenPdfFromUrl(`${API_URL}/api/labels/${label.id}/pdf`, {
        token,
        fileName: `etiqueta-${label.productName || 'produto'}.pdf`,
        title: `Etiqueta - ${label.productName}`,
        text: `Etiqueta SafeKitchen de ${label.productName}.`,
      });

      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível compartilhar/imprimir a etiqueta.');
    } finally {
      setSharingId(null);
    }
  }

  async function cancelLabel(label: Label) {
    const confirmed = window.confirm(
      `Deseja cancelar a etiqueta de "${label.productName}"?\n\nEla sairá da lista principal. Você ainda pode visualizar etiquetas canceladas ativando o filtro.`
    );

    if (!confirmed) return;

    setMessage('');

    try {
      await api(`/api/labels/${label.id}`, {
        method: 'DELETE',
      });

      setMessage('Etiqueta cancelada e removida da lista principal.');
      await loadLabels();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao cancelar etiqueta.');
    }
  }

  async function deleteLabel(label: Label) {
    const confirmed = window.confirm(
      `Deseja excluir definitivamente a etiqueta de "${label.productName}"?\n\nEssa ação remove a etiqueta do histórico.`
    );

    if (!confirmed) return;

    setMessage('');

    try {
      await api(`/api/labels/${label.id}?permanent=1`, {
        method: 'DELETE',
      });

      setMessage('Etiqueta excluída definitivamente.');
      await loadLabels();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir etiqueta.');
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
            Histórico
          </p>

          <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white lg:text-4xl">
            Histórico de etiquetas
          </h1>

          <p className="mt-2 text-slate-500 dark:text-slate-300">
            Consulte, reimprima e cancele etiquetas preservando a auditoria.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLabels}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#202020] dark:text-white dark:hover:bg-white/10"
        >
          <RefreshCcw size={16} />
          Atualizar
        </button>
      </div>

      <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_auto_auto]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#202020]">
          <Search size={18} className="text-slate-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por produto, responsável, lote ou tipo..."
            className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => {
            const nextStatus = event.target.value as StatusFilter;

            setStatusFilter(nextStatus);

            if (nextStatus === 'TODAS') {
              setSearchParams({});
            } else {
              setSearchParams({ status: nextStatus });
            }

            if (nextStatus === 'CANCELADAS') {
              setIncludeCanceled(true);
            }
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-safe-dark shadow-sm outline-none dark:border-white/10 dark:bg-[#202020] dark:text-white"
        >
          <option value="TODAS">Todas</option>
          <option value="VALIDAS">Válidas</option>
          <option value="VENCENDO">Vencendo</option>
          <option value="VENCIDAS">Vencidas</option>
          <option value="CANCELADAS">Canceladas</option>
        </select>

        <button
          type="button"
          onClick={() => setIncludeCanceled((old) => !old)}
          className={`rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition ${
            includeCanceled
              ? 'bg-safe-green text-white'
              : 'bg-white text-slate-600 dark:bg-[#202020] dark:text-slate-200'
          }`}
        >
          {includeCanceled ? 'Ocultar canceladas' : 'Mostrar canceladas'}
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-2xl bg-safe-soft p-3 text-sm font-black text-safe-dark">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-white/10 dark:bg-[#202020]">
            Carregando histórico...
          </div>
        ) : filteredLabels.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-white/10 dark:bg-[#202020]">
            Nenhuma etiqueta encontrada.
          </div>
        ) : (
          filteredLabels.map((label) => {
            const visual = getValidityVisual(label.expiresAt, label.status);

            async function deleteLabel(label: Label) {
    const confirmed = window.confirm(
      `Deseja excluir definitivamente a etiqueta de "${label.productName}"?\n\nEssa ação remove a etiqueta do histórico.`
    );

    if (!confirmed) return;

    setMessage('');

    try {
      await api(`/api/labels/${label.id}?permanent=1`, {
        method: 'DELETE',
      });

      setMessage('Etiqueta excluída definitivamente.');
      await loadLabels();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir etiqueta.');
    }
  }

  return (
              <div
                key={label.id}
                className={`rounded-3xl border p-5 shadow-sm transition ${visual.cardClass}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${visual.dotClass}`} />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black text-safe-dark dark:text-white">
                          {label.productName}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${visual.badgeClass}`}
                        >
                          {visual.label}
                        </span>
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                        {labelTypeName(label.type)} • Responsável:{' '}
                        {label.responsibleName || '—'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={14} />
                          Criada: {formatDateBR(label.createdAt)}
                        </span>

                        <span>Validade: {formatDateBR(label.expiresAt)}</span>

                        <span>Lote: {label.batch || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPdf(label)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-safe-dark transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#202020] dark:text-white dark:hover:bg-white/10"
                    >
                      <FileText size={16} />
                      PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => sharePdf(label)}
                      disabled={sharingId === label.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-2 text-sm font-black text-white transition hover:brightness-105 disabled:opacity-60"
                    >
                      <Share2 size={16} />
                      {sharingId === label.id ? 'Preparando...' : 'Compartilhar / imprimir'}
                    </button>

                    {label.status !== 'CANCELADA' && (
                      <button
                        type="button"
                        onClick={() => cancelLabel(label)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                        Cancelar
                      </button>
                    )}

                    {label.status === 'CANCELADA' && (
                      <>
                        <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">
                          <Ban size={16} />
                          Cancelada
                        </span>

                        <button
                          type="button"
                          onClick={() => deleteLabel(label)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 size={16} />
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default History;