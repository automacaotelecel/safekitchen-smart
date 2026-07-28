import { Download, FileCheck2, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';

import { API_URL, getToken } from '../api/client';

function dateInput(date: Date) { return date.toISOString().slice(0, 10); }

export function Reports() {
  const [from, setFrom] = useState(dateInput(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(dateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sheetKind, setSheetKind] = useState('RECEIVING');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('');

  async function download(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({
        from: new Date(`${from}T00:00:00`).toISOString(),
        to: new Date(`${to}T23:59:59`).toISOString(),
      });
      const response = await fetch(`${API_URL}/api/reports/compliance-dossier?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Não foi possível gerar o dossiê.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dossie-safekitchen-${from}-${to}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Dossiê gerado com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao gerar relatório.');
    } finally { setLoading(false); }
  }

  async function downloadSheet(event: FormEvent) {
    event.preventDefault();
    setSheetLoading(true);
    setSheetMessage('');

    try {
      const params = new URLSearchParams({
        kind: sheetKind,
        from: new Date(`${from}T00:00:00`).toISOString(),
        to: new Date(`${to}T23:59:59`).toISOString(),
      });
      const response = await fetch(`${API_URL}/api/reports/operational-sheet?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Não foi possível gerar a planilha.');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download =
        nameMatch?.[1] || `controle-${sheetKind.toLowerCase()}-${from}-${to}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSheetMessage('Planilha gerada no modelo operacional selecionado.');
    } catch (error) {
      setSheetMessage(
        error instanceof Error ? error.message : 'Erro ao gerar planilha.'
      );
    } finally {
      setSheetLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border bg-white p-5 shadow-sm md:p-7">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-safe-green">Auditoria e fiscalização</p>
        <h1 className="mt-2 text-3xl font-black">Dossiê de conformidade</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">Reúna etiquetas, temperaturas, documentos, controles sanitários e trilha de auditoria em um único PDF.</p>
      </section>
      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={download} className="h-fit rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Gerar novo dossiê</h2>
          <label className="mt-5 block text-sm font-black text-slate-700">Data inicial<input required type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base mt-2" /></label>
          <label className="mt-4 block text-sm font-black text-slate-700">Data final<input required type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base mt-2" /></label>
          <button disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-4 text-sm font-black text-white disabled:opacity-60"><Download size={18} /> {loading ? 'Gerando PDF...' : 'Baixar dossiê em PDF'}</button>
          {message && <p className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold">{message}</p>}
        </form>
        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2"><Feature icon={FileCheck2} title="Evidências organizadas" text="Listagens detalhadas e resumo executivo para facilitar a conferência." /><Feature icon={ShieldCheck} title="Trilha de auditoria" text="Ações, responsáveis e datas reunidos em um documento padronizado." /></div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">O dossiê apoia a inspeção e a gestão interna, mas deve ser revisado e validado pelo responsável técnico do estabelecimento.</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form
          onSubmit={downloadSheet}
          className="h-fit rounded-[28px] border bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-black">Exportar planilha operacional</h2>
          <label className="mt-5 block text-sm font-black text-slate-700">
            Modelo
            <select
              value={sheetKind}
              onChange={(event) => setSheetKind(event.target.value)}
              className="input-base mt-2"
            >
              <option value="RECEIVING">Controle de recebimento</option>
              <option value="EQUIPMENT">Temperatura dos equipamentos</option>
              <option value="PREPARATION">Temperatura durante o preparo</option>
              <option value="DELIVERY">Temperatura durante a entrega</option>
              <option value="FRYING_OIL">Temperatura do óleo de fritura</option>
              <option value="READY_FOOD">Temperatura do alimento pronto</option>
              <option value="REFRIGERATED_FOOD">
                Temperatura do alimento refrigerado
              </option>
              <option value="DISTRIBUTION">Temperatura na distribuição</option>
              <option value="MAINTENANCE">Manutenção de equipamentos</option>
              <option value="RESERVOIR_CLEANING">
                Higienização do reservatório
              </option>
              <option value="NON_ROUTINE_CLEANING">
                Higienização não rotineira
              </option>
              <option value="TRAINING">Ata de treinamento</option>
            </select>
          </label>
          <button
            disabled={sheetLoading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            <FileSpreadsheet size={18} />
            {sheetLoading ? 'Gerando XLSX...' : 'Baixar planilha XLSX'}
          </button>
          {sheetMessage && (
            <p className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold">
              {sheetMessage}
            </p>
          )}
        </form>

        <div className="rounded-[28px] border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Modelos separados por controle</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
            Cada download usa as mesmas colunas dos modelos operacionais aprovados:
            recebimento, equipamentos, preparo, óleo de fritura, alimento pronto,
            alimento refrigerado, distribuição, manutenção, higienização e
            treinamento.
          </p>
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
            O período selecionado acima é reaproveitado. O arquivo é independente do
            dossiê em PDF e pode ser aberto no Excel, LibreOffice ou Google Planilhas.
          </div>
        </div>
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof FileCheck2; title: string; text: string }) {
  return <div className="rounded-2xl bg-slate-50 p-5"><Icon className="text-safe-green" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>;
}
