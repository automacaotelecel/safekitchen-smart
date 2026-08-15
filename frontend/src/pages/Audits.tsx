import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileUp,
  MinusCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

import { api } from '../api/client';
import { localDateTimeInput } from '../utils/date';
import {
  openEvidenceDocument,
  uploadEvidenceDocument,
  validateEvidenceFile,
  type StorageInfo,
} from '../utils/evidence';
import type {
  AuditChecklistResult,
  AuditRecord,
  AuditTemplate,
} from '../types';

type AnswerState = {
  result?: AuditChecklistResult;
  notes: string;
};

function recordScore(record: AuditRecord) {
  const data = record.data;
  return typeof data?.score === 'number' ? data.score : 0;
}

function recordEvidenceCount(record: AuditRecord) {
  return (record.data?.answers || []).filter((answer) => answer.evidenceDocumentId)
    .length;
}

export function Audits() {
  const [jurisdiction, setJurisdiction] = useState<'BR' | 'SP'>('BR');
  const [template, setTemplate] = useState<AuditTemplate | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [form, setForm] = useState({
    title: 'Auditoria interna de Boas Práticas',
    occurredAt: localDateTimeInput(),
    responsibleName: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File | null>>({});
  const [storage, setStorage] = useState<StorageInfo>({
    enabled: false,
    maxDocumentBytes: 0,
  });

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const [templateData, historyData, storageInfo] = await Promise.all([
        api<AuditTemplate>(`/api/audits/template?jurisdiction=${jurisdiction}`),
        api<AuditRecord[]>('/api/audits'),
        api<StorageInfo>('/api/documents/storage'),
      ]);
      setTemplate(templateData);
      setHistory(historyData);
      setStorage(storageInfo);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o checklist.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [jurisdiction]);

  const sections = useMemo(() => {
    const groups = new Map<string, NonNullable<AuditTemplate['items']>>();
    for (const item of template?.items || []) {
      groups.set(item.section, [...(groups.get(item.section) || []), item]);
    }
    return Array.from(groups.entries());
  }, [template]);

  const completion = useMemo(() => {
    const total = template?.items.length || 0;
    const answered = Object.values(answers).filter((answer) => answer.result).length;
    return { total, answered };
  }, [answers, template]);

  function setResult(itemId: string, result: AuditChecklistResult) {
    setAnswers((current) => ({
      ...current,
      [itemId]: {
        notes: current[itemId]?.notes || '',
        result,
      },
    }));
  }

  function setNotes(itemId: string, notes: string) {
    setAnswers((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        notes,
      },
    }));
  }

  function setEvidence(itemId: string, file: File | null) {
    setEvidenceFiles((current) => ({ ...current, [itemId]: file }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!template) return;

    if (completion.answered !== completion.total) {
      setMessage(
        `Responda todos os itens. Faltam ${completion.total - completion.answered}.`
      );
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const uploadedEvidence: Record<
        string,
        { evidenceDocumentId: string; evidenceFileName: string }
      > = {};

      for (const item of template.items) {
        const file = evidenceFiles[item.id];
        if (!file) continue;

        validateEvidenceFile(file, storage);
        const document = await uploadEvidenceDocument({
          file,
          name: `Evidência de auditoria - ${item.reference}`,
          category: 'Evidências de auditoria',
          notes: item.requirement,
        });
        uploadedEvidence[item.id] = {
          evidenceDocumentId: document.id,
          evidenceFileName: document.fileName || file.name,
        };
      }

      const record = await api<AuditRecord>('/api/audits', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          occurredAt: new Date(form.occurredAt).toISOString(),
          jurisdiction,
          notes: form.notes || null,
          answers: template.items.map((item) => ({
            itemId: item.id,
            result: answers[item.id].result,
            notes: answers[item.id].notes || null,
            evidenceDocumentId:
              uploadedEvidence[item.id]?.evidenceDocumentId || null,
            evidenceFileName: uploadedEvidence[item.id]?.evidenceFileName || null,
          })),
        }),
      });

      setHistory((current) => [record, ...current]);
      setAnswers({});
      setEvidenceFiles({});
      setForm((current) => ({
        ...current,
        occurredAt: localDateTimeInput(),
        notes: '',
      }));
      setMessage('Auditoria salva com sucesso e incluída na trilha da conta.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Não foi possível salvar a auditoria.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    if (!window.confirm('Arquivar esta auditoria?')) return;
    await api(`/api/audits/${id}`, { method: 'DELETE' });
    setHistory((current) => current.filter((record) => record.id !== id));
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[28px] sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-safe-green">
              Conformidade sanitária
            </p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">
              Checklist de auditoria RDC 216
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Faça a auditoria interna por evidências, identifique não conformidades e
              mantenha o resultado registrado por estabelecimento.
            </p>
          </div>

          <label className="block min-w-[210px]">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Jurisdição complementar
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
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold text-safe-dark">
            {message}
          </div>
        )}
      </section>

      {loading || !template ? (
        <section className="rounded-[24px] border bg-white p-8 text-center text-sm font-bold text-slate-500">
          Carregando checklist...
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[28px]">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Identificação da auditoria">
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="input-base"
                />
              </Field>
              <Field label="Data e horário">
                <input
                  required
                  type="datetime-local"
                  value={form.occurredAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      occurredAt: event.target.value,
                    }))
                  }
                  className="input-base"
                />
              </Field>
              <Field label="Responsável">
                <input
                  required
                  value={form.responsibleName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      responsibleName: event.target.value,
                    }))
                  }
                  className="input-base"
                />
              </Field>
              <Field label="Observação geral">
                <input
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="input-base"
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-safe-dark">
                  {completion.answered} de {completion.total} itens respondidos
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Marque conforme, não conforme ou não aplicável.
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 sm:w-56">
                <div
                  className="h-full rounded-full bg-safe-green transition-all"
                  style={{
                    width: `${
                      completion.total
                        ? (completion.answered / completion.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {jurisdiction === 'SP' && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-semibold leading-5 text-blue-900">
                A opção São Paulo está ativa: o checklist combina a RDC 216 com os itens
                complementares estaduais e sinaliza a transição entre as Portarias CVS nº
                5/2013 e nº 3/2026.
              </div>
            )}

            {!storage.enabled && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">
                As respostas podem ser salvas normalmente. Para anexar fotos em cada pergunta,
                configure o armazenamento de arquivos no servidor.
              </div>
            )}
          </section>

          {sections.map(([section, items]) => (
            <section
              key={section}
              className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5"
            >
              <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark">
                <ClipboardCheck className="text-safe-green" size={21} />
                {section}
              </h2>

              <div className="mt-4 space-y-3">
                {items.map((item) => {
                  const answer = answers[item.id];
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-sm font-black leading-6 text-safe-dark">
                        {item.requirement}
                      </p>
                      <p className="mt-1 text-xs font-bold text-safe-green">
                        {item.reference}
                      </p>
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                        Evidência sugerida: {item.evidenceHint}
                      </p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <ResultButton
                          active={answer?.result === 'CONFORM'}
                          tone="green"
                          icon={CheckCircle2}
                          label="Conforme"
                          onClick={() => setResult(item.id, 'CONFORM')}
                        />
                        <ResultButton
                          active={answer?.result === 'NON_CONFORM'}
                          tone="red"
                          icon={XCircle}
                          label="Não conforme"
                          onClick={() => setResult(item.id, 'NON_CONFORM')}
                        />
                        <ResultButton
                          active={answer?.result === 'NOT_APPLICABLE'}
                          tone="slate"
                          icon={MinusCircle}
                          label="Não aplicável"
                          onClick={() => setResult(item.id, 'NOT_APPLICABLE')}
                        />
                      </div>

                      <textarea
                        value={answer?.notes || ''}
                        onChange={(event) => setNotes(item.id, event.target.value)}
                        className="input-base mt-3 min-h-20"
                        placeholder="Evidência, não conformidade ou ação corretiva..."
                      />

                      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-black text-slate-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                        <FileUp size={15} />
                        {evidenceFiles[item.id]?.name || 'Anexar foto ou PDF da evidência'}
                        <input
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          capture="environment"
                          disabled={!storage.enabled}
                          className="sr-only"
                          onChange={(event) =>
                            setEvidence(item.id, event.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900">
              {template.disclaimer}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {template.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-safe-blue"
                >
                  {source.title}
                  <ExternalLink size={12} />
                </a>
              ))}
            </div>

            <button
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-4 text-sm font-black text-white disabled:opacity-60"
            >
              <ShieldAlert size={18} />
              {saving ? 'Salvando auditoria...' : 'Concluir e salvar auditoria'}
            </button>
          </section>
        </form>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[28px]">
        <h2 className="text-xl font-black text-safe-dark">Histórico de auditorias</h2>
        {history.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm font-semibold text-slate-500">
            Nenhuma auditoria registrada.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {history.map((record) => (
              <article
                key={record.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-black text-safe-dark">{record.subject}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {new Date(record.occurredAt).toLocaleString('pt-BR')} •{' '}
                    {record.responsibleName}
                  </p>
                  {recordEvidenceCount(record) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(record.data?.answers || [])
                        .filter((answer) => answer.evidenceDocumentId)
                        .map((answer) => (
                          <button
                            key={`${record.id}-${answer.itemId}`}
                            type="button"
                            onClick={() =>
                              void openEvidenceDocument(answer.evidenceDocumentId as string)
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800"
                          >
                            <ExternalLink size={11} />
                            {answer.evidenceFileName || `Evidência ${answer.itemId}`}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-safe-soft px-3 py-2 text-xs font-black text-safe-green">
                    {recordScore(record)}% conforme
                  </span>
                  <button
                    type="button"
                    onClick={() => archive(record.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"
                    aria-label="Arquivar auditoria"
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ResultButton({
  active,
  tone,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  tone: 'green' | 'red' | 'slate';
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
}) {
  const classes =
    tone === 'green'
      ? active
        ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
        : 'border-emerald-200 bg-white text-emerald-700'
      : tone === 'red'
        ? active
          ? 'border-red-500 bg-red-100 text-red-800'
          : 'border-red-200 bg-white text-red-700'
        : active
          ? 'border-slate-500 bg-slate-200 text-slate-800'
          : 'border-slate-200 bg-white text-slate-600';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black transition ${classes}`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

export default Audits;
