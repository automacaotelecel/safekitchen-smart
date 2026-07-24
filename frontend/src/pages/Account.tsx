import { FormEvent, useEffect, useState } from 'react';
import {
  Building2,
  CalendarClock,
  RefreshCcw,
  Save,
  ShieldCheck,
  UserRound,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../api/client';

type AccountInfo = {
  id: string;
  name: string;
  document?: string | null;
  timezone: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  maxUsers: number;
  _count: {
    users: number;
  };
};

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: AccountUser['role'];
};

type BillingInfo = {
  subscription: {
    status: string;
    currentPeriodEnd?: string | null;
    canceledAt?: string | null;
  } | null;
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [companyForm, setCompanyForm] = useState({ name: '', document: '', timezone: 'America/Sao_Paulo' });
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '' });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as AccountUser['role'],
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(resetMessage = true) {
    setLoading(true);
    if (resetMessage) setMessage('');

    try {
      const accountData = await api<AccountInfo>('/api/account');
      setAccount(accountData);
      setCompanyForm({
        name: accountData.name,
        document: accountData.document || '',
        timezone: accountData.timezone || 'America/Sao_Paulo',
      });

      const [meData, billingData] = await Promise.all([
        api<{ user: CurrentUser }>('/api/auth/me'),
        api<BillingInfo>('/api/billing/subscription'),
      ]);
      setCurrentUser(meData.user);
      setProfileForm({ name: meData.user.name, email: meData.user.email, password: '' });
      setBilling(billingData);

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
      await load(false);
      setMessage('Usuário criado com sucesso.');
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
      await load(false);
      setMessage(user.active ? 'Acesso desativado.' : 'Acesso reativado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao atualizar usuário.');
    }
  }

  async function updateUserRole(user: AccountUser, role: AccountUser['role']) {
    setMessage('');
    try {
      await api<AccountUser>(`/api/account/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await load(false);
      setMessage('Perfil de acesso atualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao atualizar perfil.');
    }
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/api/account', {
        method: 'PATCH',
        body: JSON.stringify({
          name: companyForm.name,
          document: companyForm.document || null,
          timezone: companyForm.timezone,
        }),
      });
      await load(false);
      setMessage('Dados da empresa atualizados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao atualizar a empresa.');
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/api/account/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          password: profileForm.password || undefined,
        }),
      });
      setProfileForm((old) => ({ ...old, password: '' }));
      await load(false);
      setMessage('Seus dados foram atualizados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao atualizar seus dados.');
    }
  }

  const planEnd = billing?.subscription?.currentPeriodEnd || account?.subscriptionEndsAt || account?.trialEndsAt;

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Ativo',
    PENDING: 'Aguardando contratação',
    PENDING_IMPLEMENTATION: 'Implantação pendente',
    AWAITING_IMPLEMENTATION: 'Aguardando implantação',
    PAST_DUE: 'Pagamento pendente',
    CANCELED: 'Cancelado',
    TRIALING: 'Teste antigo',
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-safe-green">
              Administração
            </p>
            <h1 className="mt-2 text-3xl font-black text-safe-dark">
              {account?.name || 'Minha empresa'}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Plano, cobrança, empresa, administrador e equipe em um só lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-safe-soft p-4 text-sm font-bold">{message}</div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            icon={ShieldCheck}
            label="Plano"
            value={account?.plan || '—'}
          />
          <InfoCard
            icon={ShieldCheck}
            label="Status"
            value={account ? statusLabel[account.subscriptionStatus] || account.subscriptionStatus : '—'}
          />
          <InfoCard
            icon={Users}
            label="Usuários"
            value={account ? `${account._count.users}/${account.maxUsers}` : '—'}
          />
          <InfoCard
            icon={CalendarClock}
            label="Próxima cobrança"
            value={planEnd ? new Date(planEnd).toLocaleDateString('pt-BR') : '—'}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/assinatura" className="inline-flex items-center justify-center rounded-2xl bg-safe-dark px-4 py-3 text-sm font-black text-white">
            Plano, contrato e cancelamento
          </Link>
          <Link to="/funcionarios" className="inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black">
            Editar equipe operacional
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={saveCompany} className="rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark"><Building2 size={20} /> Dados da empresa</h2>
          <p className="mt-2 text-sm text-slate-500">Informações usadas na identificação da sua operação.</p>
          <div className="mt-4 space-y-3">
            <input required value={companyForm.name} onChange={(event) => setCompanyForm((old) => ({ ...old, name: event.target.value }))} className="input-base" placeholder="Nome da empresa" />
            <input value={companyForm.document} onChange={(event) => setCompanyForm((old) => ({ ...old, document: event.target.value }))} className="input-base" placeholder="CPF ou CNPJ" />
            <select value={companyForm.timezone} onChange={(event) => setCompanyForm((old) => ({ ...old, timezone: event.target.value }))} className="input-base">
              <option value="America/Sao_Paulo">Brasília (São Paulo)</option>
              <option value="America/Manaus">Manaus</option>
              <option value="America/Rio_Branco">Rio Branco</option>
              <option value="America/Noronha">Fernando de Noronha</option>
            </select>
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-4 py-4 text-sm font-black text-white"><Save size={18} /> Salvar empresa</button>
        </form>

        <form onSubmit={saveProfile} className="rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black text-safe-dark"><UserRound size={20} /> Meu acesso administrativo</h2>
          <p className="mt-2 text-sm text-slate-500">Edite seu nome, e-mail e, se desejar, defina uma nova senha.</p>
          <div className="mt-4 space-y-3">
            <input required value={profileForm.name} onChange={(event) => setProfileForm((old) => ({ ...old, name: event.target.value }))} className="input-base" placeholder="Seu nome" />
            <input required type="email" value={profileForm.email} onChange={(event) => setProfileForm((old) => ({ ...old, email: event.target.value }))} className="input-base" placeholder="Seu e-mail" />
            <input minLength={8} type="password" value={profileForm.password} onChange={(event) => setProfileForm((old) => ({ ...old, password: event.target.value }))} className="input-base" placeholder="Nova senha (opcional)" />
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-dark px-4 py-4 text-sm font-black text-white"><Save size={18} /> Salvar meu acesso</button>
          {currentUser && <p className="mt-3 text-center text-xs font-bold text-slate-500">Perfil atual: {roleLabels[currentUser.role]}</p>}
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={createUser} className="h-fit rounded-[28px] border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-safe-dark">Adicionar acesso</h2>
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
                    <select
                      value={user.role}
                      onChange={(event) => updateUserRole(user, event.target.value as AccountUser['role'])}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"
                      aria-label={`Perfil de ${user.name}`}
                    >
                      <option value="EMPLOYEE">Operador</option>
                      <option value="MANAGER">Gerente</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
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
