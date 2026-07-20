import { FormEvent, useEffect, useState } from 'react';
import {
  Archive,
  ExternalLink,
  FileClock,
  FileText,
  RefreshCcw,
  Upload,
} from 'lucide-react';

import { api, uploadToSignedUrl } from '../api/client';
import type { StoredDocument } from '../types';

const categories = [
  'Licenças e alvarás',
  'Certificados',
  'Laudos',
  'Treinamentos',
  'Fornecedores',
  'Procedimentos',
  'Outros',
];

function localDateToIso(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function expiryState(value?: string | null) {
  if (!value) return { label: 'Sem vencimento', classes: 'bg-slate-100 text-slate-600' };

  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: 'Vencido', classes: 'bg-red-100 text-red-700' };
  if (days <= 30) return { label: `Vence em ${days} dia(s)`, classes: 'bg-amber-100 text-amber-700' };
  return { label: 'Vigente', classes: 'bg-emerald-100 text-emerald-700' };
}

export function Documents() {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [storage, setStorage] = useState({ enabled: false, maxDocumentBytes: 0 });
  const [form, setForm] = useState({
    name: '',
    category: categories[0],
    issuedAt: '',
    expiresAt: '',
    reminderDays: '30',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const [items, storageInfo] = await Promise.all([
        api<StoredDocument[]>('/api/documents'),
        api<typeof storage>('/api/documents/storage'),
      ]);

      setDocuments(items);
      setStorage(storageInfo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar documentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      let storageKey: string | null = null;

      if (file) {
        if (!storage.enabled) {
          throw new Error('Configure o armazenamento S3 antes de enviar arquivos.');
        }

        const signed = await api<{
          uploadUrl: string;
          storageKey: string;
          headers: Record<string, string>;
        }>('/api/documents/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        });

        await uploadToSignedUrl(signed.uploadUrl, file, signed.headers);
        storageKey = signed.storageKey;
      }

      await api<StoredDocument>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          fileName: file?.name || null,
          mimeType: file?.type || null,
          sizeBytes: file?.size || null,
          storageKey,
          issuedAt: localDateToIso(form.issuedAt),
          expiresAt: localDateToIso(form.expiresAt),
          reminderDays: Number(form.reminderDays),
          notes: form.notes || null,
        }),
      });

      setForm({
        name: '',
        category: categories[0],
        issuedAt: '',
        expiresAt: '',
        reminderDays: '30',
        notes: '',
      });
      setFile(null);
      setMessage('Documento cadastrado com sucesso.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar documento.');
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(id: string) {
    try {
      const data = await api<{ url: string }>(`/api/documents/${id}/download-url`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Documento sem arquivo.');
    }
  }

  async function archiveDocument(id: string) {
    if (!window.confirm('Arquivar este documento?')) return;

    try {
      await api<StoredDocument>(`/api/documents/${id}`, { method: 'DELETE' });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao arquivar documento.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Gestão documental
            </p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">Documentos e vencimentos</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Centralize licenças, laudos, treinamentos e certificados com alerta de validade.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>

        {!storage.enabled && (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
            Os registros podem ser cadastrados, mas o envio do arquivo depende da configuração
            do armazenamento S3 no servidor.
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold text-safe-dark">
            {message}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={submit}
          className="h-fit rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-black text-safe-dark">Novo documento</h2>

          <div className="mt-4 space-y-4">
            <Input
              label="Nome"
              value={form.name}
              onChange={(value) => setForm((old) => ({ ...old, name: value }))}
              required
            />

            <label className="block">
              <span className="text-sm font-black text-slate-700">Categoria</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((old) => ({ ...old, category: event.target.value }))
                }
                className="input-base mt-2"
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                label="Emissão"
                value={form.issuedAt}
                onChange={(value) => setForm((old) => ({ ...old, issuedAt: value }))}
              />
              <Input
                type="date"
                label="Vencimento"
                value={form.expiresAt}
                onChange={(value) => setForm((old) => ({ ...old, expiresAt: value }))}
              />
            </div>

            <Input
              type="number"
              label="Avisar antes (dias)"
              value={form.reminderDays}
              onChange={(value) => setForm((old) => ({ ...old, reminderDays: value }))}
            />

            <label className="block">
              <span className="text-sm font-black text-slate-700">Arquivo</span>
              <input
                type="file"
                disabled={!storage.enabled}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 p-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">Observações</span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((old) => ({ ...old, notes: event.target.value }))
                }
                className="input-base mt-2 min-h-24"
              />
            </label>
          </div>

          <button
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            <Upload size={18} />
            {saving ? 'Salvando...' : 'Salvar documento'}
          </button>
        </form>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-safe-dark">Documentos cadastrados</h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Carregando...</p>
          ) : documents.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed p-8 text-center">
              <FileText className="mx-auto text-slate-400" size={36} />
              <p className="mt-3 text-sm font-bold text-slate-500">Nenhum documento cadastrado.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document) => {
                const state = expiryState(document.expiresAt);

                return (
                  <article key={document.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <FileClock size={18} className="text-safe-green" />
                          <p className="font-black text-safe-dark">{document.name}</p>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${state.classes}`}>
                            {state.label}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {document.category}
                          {document.fileName ? ` • ${document.fileName}` : ' • sem arquivo'}
                          {document.expiresAt
                            ? ` • validade ${new Date(document.expiresAt).toLocaleDateString('pt-BR')}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openDocument(document.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-safe-dark px-3 py-2 text-xs font-black text-white"
                        >
                          <ExternalLink size={14} />
                          Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveDocument(document.id)}
                          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black text-slate-600"
                        >
                          <Archive size={14} />
                          Arquivar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-base mt-2"
      />
    </label>
  );
}

export default Documents;

