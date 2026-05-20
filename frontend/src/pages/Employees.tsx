import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Edit3,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import { api } from '../api/client';
import type { Employee } from '../types';

type EmployeeForm = {
  name: string;
  role: string;
  phone: string;
  email: string;
  active: boolean;
};

const emptyForm: EmployeeForm = {
  name: '',
  role: '',
  phone: '',
  email: '',
  active: true,
};

const roleSuggestions = [
  'Cozinha',
  'Nutrição',
  'Responsável técnico',
  'Estoquista',
  'Auxiliar de cozinha',
  'Gerente',
  'Administrador',
];

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EmployeeForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api<Employee[]>('/api/employees');
    setEmployees(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const activeEmployees = employees.filter((employee) => employee.active);
  const inactiveEmployees = employees.filter((employee) => !employee.active);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (!showInactive && !employee.active) return false;

      const content = `${employee.name} ${employee.role || ''} ${employee.phone || ''} ${
        employee.email || ''
      }`.toLowerCase();

      return content.includes(query);
    });
  }, [employees, search, showInactive]);

  function resetMessages() {
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    resetMessages();
    setSaving(true);

    try {
      await api<Employee>('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          role: form.role || null,
          phone: form.phone || null,
          email: form.email || null,
          active: true,
        }),
      });

      setForm(emptyForm);
      setSuccess('Funcionário cadastrado com sucesso.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar funcionário.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(employee: Employee) {
    resetMessages();

    setEditing(employee);
    setEditForm({
      name: employee.name || '',
      role: employee.role || '',
      phone: employee.phone || '',
      email: employee.email || '',
      active: employee.active,
    });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();

    if (!editing) return;

    resetMessages();
    setSaving(true);

    try {
      await api<Employee>(`/api/employees/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          role: editForm.role || null,
          phone: editForm.phone || null,
          email: editForm.email || null,
          active: editForm.active,
        }),
      });

      setEditing(null);
      setSuccess('Funcionário atualizado com sucesso.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar funcionário.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee: Employee) {
    resetMessages();

    try {
      await api<Employee>(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          active: !employee.active,
        }),
      });

      setSuccess(employee.active ? 'Funcionário inativado.' : 'Funcionário reativado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status.');
    }
  }

  async function removeEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `Deseja remover "${employee.name}" da equipe ativa?\n\nEle será inativado e não aparecerá como responsável padrão, mas o histórico de etiquetas será mantido.`
    );

    if (!confirmed) return;

    resetMessages();

    try {
      await api(`/api/employees/${employee.id}`, {
        method: 'DELETE',
      });

      setSuccess('Funcionário removido da equipe ativa.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover funcionário.');
    }
  }

  return (
    <div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
                Equipe
              </p>

              <h1 className="mt-2 text-3xl font-black text-safe-dark dark:text-white lg:text-4xl">
                Funcionários
              </h1>

              <p className="mt-2 text-slate-500 dark:text-slate-300">
                Cadastre responsáveis para aparecer nas etiquetas e controlar quem está ativo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Ativos" value={activeEmployees.length} />
              <StatCard label="Inativos" value={inactiveEmployees.length} />
              <StatCard label="Total" value={employees.length} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#202020]">
              <Search size={18} className="text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, função, telefone ou e-mail..."
                className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowInactive((old) => !old)}
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                showInactive
                  ? 'bg-safe-green text-white shadow-lg shadow-emerald-200'
                  : 'bg-white text-slate-600 shadow-sm dark:bg-[#202020] dark:text-slate-200'
              }`}
            >
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
              {success}
            </p>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredEmployees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onEdit={() => startEdit(employee)}
                onToggleActive={() => toggleActive(employee)}
                onRemove={() => removeEmployee(employee)}
              />
            ))}

            {filteredEmployees.length === 0 && (
              <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#202020]">
                <Users className="mx-auto text-slate-300" size={42} />

                <p className="mt-3 font-black text-slate-700 dark:text-white">
                  Nenhum funcionário encontrado
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                  Cadastre um novo responsável ou ajuste os filtros.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#202020]">
          <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark dark:text-white">
            <Plus size={20} />
            Novo funcionário
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
            Estes dados ajudam na rastreabilidade das etiquetas.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field
              label="Nome"
              value={form.name}
              onChange={(value) => setForm((old) => ({ ...old, name: value }))}
              required
            />

            <Field
              label="Função/cargo"
              value={form.role}
              onChange={(value) => setForm((old) => ({ ...old, role: value }))}
              placeholder="Ex.: Cozinha, Nutrição, Estoque..."
              suggestions={roleSuggestions}
            />

            <Field
              label="Telefone"
              value={form.phone}
              onChange={(value) => setForm((old) => ({ ...old, phone: value }))}
              placeholder="Opcional"
            />

            <Field
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(value) => setForm((old) => ({ ...old, email: value }))}
              placeholder="Opcional"
            />

            <button
              disabled={saving}
              className="w-full rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar funcionário'}
            </button>
          </form>

          <div className="mt-5 rounded-3xl bg-safe-soft p-4">
            <p className="text-sm font-black text-safe-dark">
              Como isso aparece no sistema?
            </p>

            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
              Funcionários ativos aparecem no campo “Responsável” ao gerar etiquetas.
              Inativos ficam preservados para manter histórico e auditoria.
            </p>
          </div>
        </aside>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#202020]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
                  Editar
                </p>

                <h2 className="mt-1 text-2xl font-black text-safe-dark dark:text-white">
                  Funcionário
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Field
                label="Nome"
                value={editForm.name}
                onChange={(value) => setEditForm((old) => ({ ...old, name: value }))}
                required
              />

              <Field
                label="Função/cargo"
                value={editForm.role}
                onChange={(value) => setEditForm((old) => ({ ...old, role: value }))}
                suggestions={roleSuggestions}
              />

              <Field
                label="Telefone"
                value={editForm.phone}
                onChange={(value) => setEditForm((old) => ({ ...old, phone: value }))}
              />

              <Field
                label="E-mail"
                type="email"
                value={editForm.email}
                onChange={(value) => setEditForm((old) => ({ ...old, email: value }))}
              />

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#151515]">
                <div>
                  <p className="text-sm font-black text-slate-700 dark:text-white">
                    Funcionário ativo
                  </p>

                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                    Ativos aparecem como responsáveis nas etiquetas.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(event) =>
                    setEditForm((old) => ({
                      ...old,
                      active: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-emerald-500"
                />
              </label>
            </div>

            <button
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function EmployeeCard({
  employee,
  onEdit,
  onToggleActive,
  onRemove,
}: {
  employee: Employee;
  onEdit: () => void;
  onToggleActive: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-app dark:bg-[#202020] ${
        employee.active
          ? 'border-slate-200 dark:border-white/10'
          : 'border-slate-200 opacity-70 dark:border-white/10'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
            employee.active
              ? 'bg-safe-soft text-safe-green'
              : 'bg-slate-100 text-slate-400 dark:bg-white/5'
          }`}
        >
          <UserRound size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-slate-900 dark:text-white">
                {employee.name}
              </p>

              <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                {employee.role || 'Sem função cadastrada'}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                employee.active
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
              }`}
            >
              {employee.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {employee.phone && (
              <p className="flex items-center gap-2 font-semibold text-slate-500 dark:text-slate-300">
                <Phone size={15} />
                {employee.phone}
              </p>
            )}

            {employee.email && (
              <p className="flex items-center gap-2 break-all font-semibold text-slate-500 dark:text-slate-300">
                <Mail size={15} />
                {employee.email}
              </p>
            )}

            {!employee.phone && !employee.email && (
              <p className="text-sm font-semibold text-slate-400">
                Sem contato cadastrado.
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <Edit3 size={15} />
              Editar
            </button>

            <button
              type="button"
              onClick={onToggleActive}
              className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition ${
                employee.active
                  ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {employee.active ? <Ban size={15} /> : <BadgeCheck size={15} />}
              {employee.active ? 'Inativar' : 'Ativar'}
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100"
            >
              <Trash2 size={15} />
              Remover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm dark:border-white/10 dark:bg-[#202020]">
      <p className="text-xl font-black text-safe-dark dark:text-white">
        {value}
      </p>

      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
  suggestions?: string[];
}) {
  const listId = suggestions?.length
    ? `${label.toLowerCase().replace(/\s+/g, '-')}-suggestions`
    : undefined;

  return (
    <div>
      <label className="block text-sm font-black text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <input
        required={required}
        type={type}
        value={value}
        list={listId}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-safe-green focus:bg-white dark:border-white/10 dark:bg-[#151515] dark:text-white"
      />

      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

export default Employees;