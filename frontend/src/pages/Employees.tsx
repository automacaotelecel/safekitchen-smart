import { FormEvent, useEffect, useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { api } from '../api/client';
import type { Employee } from '../types';

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const data = await api<Employee[]>('/api/employees');
    setEmployees(data);
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api<Employee>('/api/employees', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar funcionário.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">Equipe</p>
        <h1 className="mt-2 text-3xl font-black text-safe-dark lg:text-4xl">Funcionários</h1>
        <p className="mt-2 text-slate-500">Cadastre responsáveis para aparecer nas etiquetas.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {employees.map((employee) => (
            <div key={employee.id} className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-safe-soft text-safe-blue"><UserRound size={22} /></div>
              <div>
                <p className="font-black text-slate-900">{employee.name}</p>
                <p className="text-sm font-bold text-slate-500">{employee.active ? 'Ativo' : 'Inativo'}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submit} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark"><Plus size={20} /> Novo funcionário</h2>
        <label className="mt-5 block text-sm font-black text-slate-700">Nome</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold" />
        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button className="mt-5 w-full rounded-2xl bg-safe-green px-4 py-3 text-sm font-black text-white">Salvar funcionário</button>
      </form>
    </div>
  );
}
