import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Printer, Search } from 'lucide-react';
import { api, API_URL, getToken } from '../api/client';
import type { Label } from '../types';
import { labelTypeName } from '../utils/labels';

export function History() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [search, setSearch] = useState('');

  async function load() {
    const data = await api<Label[]>('/api/labels');
    setLabels(data);
  }

  useEffect(() => { load().catch(console.error); }, []);

  const filtered = labels.filter((label) => `${label.productName} ${label.responsibleName} ${label.batch || ''}`.toLowerCase().includes(search.toLowerCase()));

  function openPdf(id: string) {
    const token = getToken();
    window.open(`${API_URL}/api/labels/${id}/pdf?token=${token || ''}`, '_blank');
  }

  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Auditoria</p>
      <h1 className="mt-2 text-3xl font-black text-safe-dark lg:text-4xl">Histórico de etiquetas</h1>
      <p className="mt-2 text-slate-500">Consulte, audite e reimprima etiquetas geradas.</p>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por produto, lote ou responsável..." className="w-full bg-transparent text-sm font-semibold" />
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_100px] bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-500 lg:grid">
          <span>Produto</span><span>Tipo</span><span>Validade</span><span>Responsável</span><span>Ações</span>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map((label) => (
            <div key={label.id} className="grid gap-3 p-5 lg:grid-cols-[1.2fr_1fr_1fr_1fr_100px] lg:items-center">
              <div>
                <p className="font-black text-slate-900">{label.productName}</p>
                <p className="text-xs text-slate-500">Lote: {label.batch || '-'} • {label.conservationMode}</p>
              </div>
              <p className="text-sm font-bold text-slate-600">{labelTypeName(label.type)}</p>
              <p className="text-sm font-bold text-slate-600">{label.expiresAt ? format(new Date(label.expiresAt), 'dd/MM/yyyy HH:mm') : '-'}</p>
              <p className="text-sm font-bold text-slate-600">{label.responsibleName}</p>
              <button onClick={() => openPdf(label.id)} className="flex items-center justify-center gap-2 rounded-xl bg-safe-green px-3 py-2 text-xs font-black text-white">
                <Printer size={15} /> PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
