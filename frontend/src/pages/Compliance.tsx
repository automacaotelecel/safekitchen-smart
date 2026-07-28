import { FormEvent, useEffect, useState } from 'react';
import {
  Archive,
  CalendarClock,
  ClipboardCheck,
  RefreshCcw,
} from 'lucide-react';

import { api } from '../api/client';
import type { ComplianceRecord, ComplianceType } from '../types';

type OperationalComplianceType = Exclude<ComplianceType, 'AUDIT'>;

const typeLabels: Record<OperationalComplianceType, string> = {
  MAINTENANCE: 'Manutenção de equipamento',
  RESERVOIR_CLEANING: 'Higienização de reservatório',
  NON_ROUTINE_CLEANING: 'Higienização não rotineira',
  TRAINING: 'Treinamento',
  RECEIVING: 'Controle de recebimento',
};

function localDateTimeInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dueState(value?: string | null) {
  if (!value) return { label: 'Sem próxima data', classes: 'bg-slate-100 text-slate-600' };
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: 'Atrasado', classes: 'bg-red-100 text-red-700' };
  if (days <= 30) return { label: `Em ${days} dia(s)`, classes: 'bg-amber-100 text-amber-700' };
  return { label: 'Em dia', classes: 'bg-emerald-100 text-emerald-700' };
}

export function Compliance() {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [form, setForm] = useState({
    type: 'MAINTENANCE' as OperationalComplianceType,
    subject: '',
    occurredAt: localDateTimeInput(),
    nextDueAt: '',
    responsibleName: '',
    notes: '',
    supplier: '',
    packaging: '',
    conservation: '',
    temperatureC: '',
    deliverer: '',
    expirationDate: '',
    maintenancePerformed: '',
    productUsed: '',
    contents: '',
    workload: '',
    participants: '',
    shifts: '',
    signatures: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      setRecords(await api<ComplianceRecord[]>('/api/compliance'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar registros.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    try {
      await api<ComplianceRecord>('/api/compliance', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          occurredAt: new Date(form.occurredAt).toISOString(),
          nextDueAt: form.nextDueAt
            ? new Date(form.nextDueAt).toISOString()
            : null,
          notes: form.notes || null,
          data: {
            supplier: form.supplier || null,
            packaging: form.packaging || null,
            conservation: form.conservation || null,
            temperatureC: form.temperatureC ? Number(form.temperatureC) : null,
            deliverer: form.deliverer || null,
            expirationDate: form.expirationDate
              ? new Date(`${form.expirationDate}T12:00:00`).toISOString()
              : null,
            maintenancePerformed: form.maintenancePerformed || null,
            productUsed: form.productUsed || null,
            contents: form.contents || null,
            workload: form.workload || null,
            participants: form.participants || null,
            shifts: form.shifts || null,
            signatures: form.signatures || null,
          },
        }),
      });

      setForm((old) => ({
        ...old,
        subject: '',
        occurredAt: localDateTimeInput(),
        nextDueAt: '',
        notes: '',
        supplier: '',
        packaging: '',
        conservation: '',
        temperatureC: '',
        deliverer: '',
        expirationDate: '',
        maintenancePerformed: '',
        productUsed: '',
        contents: '',
        workload: '',
        participants: '',
        shifts: '',
        signatures: '',
      }));
      setMessage('Registro salvo com sucesso.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar registro.');
    }
  }

  async function archive(id: string) {
    if (!window.confirm('Arquivar este registro?')) return;
    await api<ComplianceRecord>(`/api/compliance/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Registros operacionais
            </p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">Manutenção, higiene e treinamento</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Substitui as planilhas de manutenção, higienização, recebimento e atas de treinamento,
              mantendo responsável, histórico e próxima data.
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

        {message && (
          <div className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold">{message}</div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-safe-dark">Novo registro</h2>
          <div className="mt-4 space-y-4">
            <Field label="Tipo">
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((old) => ({ ...old, type: event.target.value as OperationalComplianceType }))
                }
                className="input-base"
              >
                {(Object.keys(typeLabels) as OperationalComplianceType[]).map((type) => (
                  <option key={type} value={type}>{typeLabels[type]}</option>
                ))}
              </select>
            </Field>
            <Field
              label={
                form.type === 'TRAINING'
                  ? 'Tema do treinamento'
                  : form.type === 'RECEIVING'
                    ? 'Produto'
                    : 'Equipamento/assunto'
              }
            >
              <input
                required
                value={form.subject}
                onChange={(event) => setForm((old) => ({ ...old, subject: event.target.value }))}
                className="input-base"
              />
            </Field>

            {form.type === 'RECEIVING' && (
              <>
                <Field label="Fornecedor">
                  <input
                    value={form.supplier}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, supplier: event.target.value }))
                    }
                    className="input-base"
                  />
                </Field>
                <Field label="Embalagem">
                  <input
                    value={form.packaging}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, packaging: event.target.value }))
                    }
                    className="input-base"
                    placeholder="Ex.: íntegra, sem avarias"
                  />
                </Field>
                <Field label="Conservação">
                  <select
                    value={form.conservation}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        conservation: event.target.value,
                      }))
                    }
                    className="input-base"
                  >
                    <option value="">Selecionar</option>
                    <option value="AMBIENTE">Ambiente</option>
                    <option value="REFRIGERADO">Refrigerado</option>
                    <option value="CONGELADO">Congelado</option>
                  </select>
                </Field>
                <Field label="Temperatura de recebimento (°C)">
                  <input
                    type="number"
                    step="0.1"
                    value={form.temperatureC}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        temperatureC: event.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </Field>
                <Field label="Entregador">
                  <input
                    value={form.deliverer}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, deliverer: event.target.value }))
                    }
                    className="input-base"
                  />
                </Field>
                <Field label="Data de validade">
                  <input
                    type="date"
                    value={form.expirationDate}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        expirationDate: event.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </Field>
              </>
            )}

            {form.type === 'MAINTENANCE' && (
              <Field label="Manutenção realizada">
                <input
                  value={form.maintenancePerformed}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      maintenancePerformed: event.target.value,
                    }))
                  }
                  className="input-base"
                />
              </Field>
            )}

            {form.type === 'NON_ROUTINE_CLEANING' && (
              <Field label="Produto utilizado">
                <input
                  value={form.productUsed}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, productUsed: event.target.value }))
                  }
                  className="input-base"
                />
              </Field>
            )}

            {form.type === 'TRAINING' && (
              <>
                <Field label="Conteúdos">
                  <textarea
                    value={form.contents}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, contents: event.target.value }))
                    }
                    className="input-base min-h-20"
                  />
                </Field>
                <Field label="Carga horária">
                  <input
                    value={form.workload}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, workload: event.target.value }))
                    }
                    className="input-base"
                    placeholder="Ex.: 2 horas"
                  />
                </Field>
                <Field label="Participantes">
                  <input
                    value={form.participants}
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        participants: event.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </Field>
                <Field label="Turnos">
                  <input
                    value={form.shifts}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, shifts: event.target.value }))
                    }
                    className="input-base"
                  />
                </Field>
              </>
            )}
            <Field label="Data realizada">
              <input
                required
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) => setForm((old) => ({ ...old, occurredAt: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Próxima data">
              <input
                type="datetime-local"
                value={form.nextDueAt}
                onChange={(event) => setForm((old) => ({ ...old, nextDueAt: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Responsável">
              <input
                required
                value={form.responsibleName}
                onChange={(event) =>
                  setForm((old) => ({ ...old, responsibleName: event.target.value }))
                }
                className="input-base"
              />
            </Field>
            <Field label="Atividade, produto utilizado ou observações">
              <textarea
                value={form.notes}
                onChange={(event) => setForm((old) => ({ ...old, notes: event.target.value }))}
                className="input-base min-h-28"
              />
            </Field>
          </div>
          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-4 text-sm font-black text-white">
            <ClipboardCheck size={18} />
            Salvar registro
          </button>
        </form>

        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-safe-dark">Histórico e próximos vencimentos</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Carregando...</p>
          ) : records.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
              Nenhum registro cadastrado.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {records.map((record) => {
                const state = dueState(record.nextDueAt);
                return (
                  <article key={record.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CalendarClock size={18} className="text-safe-green" />
                          <p className="font-black text-safe-dark">{record.subject}</p>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${state.classes}`}>
                            {state.label}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {record.type === 'AUDIT'
                            ? 'Auditoria sanitária'
                            : typeLabels[record.type]}{' '}
                          • realizado em{' '}
                          {new Date(record.occurredAt).toLocaleString('pt-BR')} •{' '}
                          {record.responsibleName}
                        </p>
                        {record.notes && <p className="mt-2 text-sm text-slate-600">{record.notes}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => archive(record.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black text-slate-600"
                      >
                        <Archive size={14} />
                        Arquivar
                      </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export default Compliance;
