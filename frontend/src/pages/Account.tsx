import { FormEvent, useEffect, useState } from 'react';
import {
  CalendarClock,
  RefreshCcw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';

type AccountInfo = {
  id: string;
  name: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  maxUsers: number;
  _count: {
    users: number;
  };
};

type AccountUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  active: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
};

const roleLabels = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Operador',
};

export function Account() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as AccountUser['role'],
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const accountData = await api<AccountInfo>('/api/account');
      setAccount(accountData);

      try {
        setUsers(await api<AccountUser[]>('/api/account/users'));
      } catch {
        setUsers([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar a conta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setMessage('');

    try {
      await api<AccountUser>('/api/account/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
      setMessage('Usuário criado com sucesso.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao criar usuário.');
    }
  }

  async function toggleUser(user: AccountUser) {
    try {
      await api<AccountUser>(`/api/account/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !user.active }),
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao atualizar usuário.');
    }
  }

  const planEnd = account?.subscriptionStatus === 'TRIALING'
    ? account.trialEndsAt
    : account?.subscriptionEndsAt;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Conta e acesso
            </p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">
              {account?.name || 'Minha empresa'}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Gerencie plano, limite de acessos e equipe.
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

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoCard
            icon={ShieldCheck}
            label="Plano"
            value={account?.plan || '—'}
          />
          <InfoCard
            icon={Users}
            label="Usuários"
            value={account ? `${account._count.users}/${account.maxUsers}` : '—'}
          />
          <InfoCard
            icon={CalendarClock}
            label={account?.subscriptionStatus === 'TRIALING' ? 'Fim do teste' : 'Renovação'}
            value={planEnd ? new Date(planEnd).toLocaleDateString('pt-BR') : '—'}
          />
        </div>

        <Link
          to="/assinatura"
          className="mt-4 inline-flex items-center justify-center rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white"
        >
          Gerenciar plano e cobrança
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={createUser} className="h-fit rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-safe-dark">Adicionar usuário</h2>
          <p className="mt-2 text-sm text-slate-500">
            Administradores podem criar acessos até o limite do plano.
          </p>

          <div className="mt-4 space-y-3">
            <input
              required
              value={form.name}
              onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))}
              className="input-base"
              placeholder="Nome"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))}
              className="input-base"
              placeholder="E-mail"
            />
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))}
              className="input-base"
              placeholder="Senha inicial (mín. 8 caracteres)"
            />
            <select
              value={form.role}
              onChange={(event) =>
                setForm((old) => ({ ...old, role: event.target.value as AccountUser['role'] }))
              }
              className="input-base"
            >
              <option value="EMPLOYEE">Operador</option>
              <option value="MANAGER">Gerente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-4 text-sm font-black text-white">
            <UserPlus size={18} />
            Criar acesso
          </button>
        </form>

        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-safe-dark">Equipe com acesso</h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Carregando...</p>
          ) : users.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
              Seu perfil não permite listar a equipe ou ainda não há usuários.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {users.map((user) => (
                <article key={user.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-safe-dark">{user.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {user.email} • {roleLabels[user.role]}
                        {user.lastLoginAt
                          ? ` • último acesso ${new Date(user.lastLoginAt).toLocaleString('pt-BR')}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleUser(user)}
                      className={`rounded-xl px-3 py-2 text-xs font-black ${
                        user.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-safe-soft p-4 text-safe-dark">
      <Icon size={20} />
      <p className="mt-3 text-xl font-black">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

export default Account;
