import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckSquare, FileText, Printer, Search, Square, X } from 'lucide-react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import type { Label, LabelType } from '../types';
import { labelTypeName, labelTypes } from '../utils/labels';

type SelectedState = Record<string, number>;

export function LabelManagement() {
  const navigate = useNavigate();
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<SelectedState>({});
  const [search, setSearch] = useState('');
  const [type, setType] = useState<LabelType | 'TODOS'>('TODOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const data = await api<Label[]>('/api/labels');
    setLabels(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar etiquetas.'));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return labels.filter((label) => {
      const matchesSearch = `${label.productName} ${label.responsibleName} ${label.batch || ''} ${label.brand || ''}`
        .toLowerCase()
        .includes(q);
      const matchesType = type === 'TODOS' || label.type === type;
      return matchesSearch && matchesType;
    });
  }, [labels, search, type]);

  const selectedItems = Object.entries(selected)
    .filter(([, copies]) => copies > 0)
    .map(([id, copies]) => ({ id, copies }));

  const selectedCount = selectedItems.length;
  const totalCopies = selectedItems.reduce((sum, item) => sum + item.copies, 0);

  function toggleLabel(id: string) {
    setSelected((old) => {
      if (old[id]) {
        const next = { ...old };
        delete next[id];
        return next;
      }

      return { ...old, [id]: 1 };
    });
  }

  function updateCopies(id: string, copies: number) {
    setSelected((old) => ({
      ...old,
      [id]: Math.max(1, Math.min(30, Number.isFinite(copies) ? copies : 1)),
    }));
  }

  function selectVisible() {
    setSelected((old) => {
      const next = { ...old };
      filtered.forEach((label) => {
        next[label.id] = next[label.id] || 1;
      });
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  function printSelected() {
    setError('');

    if (selectedItems.length === 0) {
      setError('Selecione pelo menos uma etiqueta para imprimir.');
      return;
    }

    const items = selectedItems.map((item) => `${item.id}:${item.copies}`).join(',');
    navigate(`/imprimir-folha?items=${encodeURIComponent(items)}`);
  }

  function openSinglePdf(label: Label) {
    const copies = selected[label.id] || 1;
    navigate(`/imprimir-folha?items=${encodeURIComponent(`${label.id}:${copies}`)}`);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Impressão</p>
          <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white lg:text-4xl">
            Gerenciamento de etiquetas
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-300">
            Selecione uma ou várias etiquetas, defina a quantidade de cópias e gere uma folha pronta para impressão.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#202020]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Selecionadas</p>
          <p className="mt-1 text-2xl font-black text-safe-dark dark:text-white">
            {selectedCount} <span className="text-sm font-bold text-slate-500">itens</span> / {totalCopies}{' '}
            <span className="text-sm font-bold text-slate-500">cópias</span>
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#202020]">
        <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto_auto_auto] lg:items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#151515]">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por produto, lote, marca ou responsável..."
              className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
            />
          </div>

          <select
            value={type}
            onChange={(event) => setType(event.target.value as LabelType | 'TODOS')}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-safe-dark outline-none dark:border-white/10 dark:bg-[#151515] dark:text-white"
          >
            <option value="TODOS">Todos os tipos</option>
            {labelTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={selectVisible}
            className="rounded-2xl bg-safe-soft px-4 py-3 text-sm font-black text-safe-blue transition hover:brightness-95"
          >
            Selecionar visíveis
          </button>

          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#202020] dark:text-slate-200"
          >
            <X size={16} /> Limpar
          </button>

          <button
            type="button"
            onClick={printSelected}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:brightness-95 disabled:opacity-60 dark:shadow-black/30"
          >
            <Printer size={17} /> {loading ? 'Gerando...' : 'Imprimir lote'}
          </button>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-100">{error}</p>}
      </section>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#202020]">
        <div className="hidden grid-cols-[52px_1.2fr_1fr_1fr_110px_110px] bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:bg-white/5 dark:text-slate-300 lg:grid">
          <span />
          <span>Produto</span>
          <span>Tipo</span>
          <span>Validade</span>
          <span>Cópias</span>
          <span>Ações</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {filtered.map((label) => {
            const isSelected = Boolean(selected[label.id]);
            const copies = selected[label.id] || 1;

            return (
              <div
                key={label.id}
                className={`grid gap-3 p-5 transition lg:grid-cols-[52px_1.2fr_1fr_1fr_110px_110px] lg:items-center ${
                  isSelected ? 'bg-safe-soft/70 dark:bg-emerald-400/10' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-safe-green dark:border-white/10 dark:bg-[#151515]"
                  title={isSelected ? 'Remover seleção' : 'Selecionar etiqueta'}
                >
                  {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>

                <div>
                  <p className="font-black text-slate-900 dark:text-white">{label.productName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Lote: {label.batch || '-'} • {label.conservationMode} • Resp.: {label.responsibleName}
                  </p>
                </div>

                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{labelTypeName(label.type)}</p>

                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {label.expiresAt ? format(new Date(label.expiresAt), 'dd/MM/yyyy HH:mm') : 'Sem validade'}
                </p>

                <input
                  type="number"
                  min={1}
                  max={30}
                  value={copies}
                  onChange={(event) => updateCopies(label.id, Number(event.target.value))}
                  onFocus={() => {
                    if (!selected[label.id]) toggleLabel(label.id);
                  }}
                  className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black outline-none focus:border-safe-green dark:border-white/10 dark:bg-[#151515] dark:text-white"
                />

                <button
                  type="button"
                  onClick={() => openSinglePdf(label)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-safe-green px-3 py-2 text-xs font-black text-white"
                >
                  <FileText size={15} /> PDF
                </button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm font-bold text-slate-500 dark:text-slate-300">
              Nenhuma etiqueta encontrada com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LabelManagement;
