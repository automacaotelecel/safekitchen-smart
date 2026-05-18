import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Tags,
} from 'lucide-react';
import { api, setToken } from '../api/client';

type LoginResponse = {
  token: string;
  user: {
    name: string;
    email: string;
  };
};

export function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@safekitchen.com.br');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError('');

    try {
      const data = await api<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setToken(data.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f6fbfb]">
      <div className="absolute inset-x-0 top-0 h-[58vh] bg-safe-gradient" />
      <div className="absolute left-[-10rem] top-[-10rem] h-80 w-80 rounded-full bg-safe-purple/30 blur-3xl" />
      <div className="absolute right-[-10rem] top-20 h-96 w-96 rounded-full bg-safe-green/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center p-4 lg:p-8">
        <div className="grid w-full overflow-hidden rounded-[2.2rem] bg-white shadow-app lg:grid-cols-[1.15fr_.85fr]">
          <div className="relative min-h-[560px] overflow-hidden bg-safe-red p-7 text-white lg:p-12">
            <div className="relative z-20 flex items-center justify-between gap-4">
              <img
                src="/safekitchen-logo.png"
                alt="SafeKitchen Smart"
                className="h-24 w-24 rounded-3xl bg-white/95 object-contain p-1 shadow-lg"
              />
            </div>

            <div className="relative z-20 mt-12 max-w-xl">
              <h1 className="mt-6 text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">
                Sua cozinha livre da caneta.
              </h1>

              <p className="mt-6 max-w-md text-lg font-semibold leading-relaxed text-white/90">
                Etiquetas automáticas, validade calculada e histórico para
                auditoria sanitária em tablet e celular.
              </p>

              <div className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-white/12 p-4 backdrop-blur">
                  <Tags className="text-safe-yellow" />

                  <p className="mt-3 text-sm font-black">Etiquetas</p>

                  <p className="mt-1 text-xs text-white/75">
                    Produto aberto, produção e mais.
                  </p>
                </div>

                <div className="rounded-3xl bg-white/12 p-4 backdrop-blur">
                  <CheckCircle2 className="text-safe-yellow" />

                  <p className="mt-3 text-sm font-black">Validade</p>

                  <p className="mt-1 text-xs text-white/75">
                    Cálculo automático por regra.
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-24 right-[-5rem] z-10 hidden h-80 w-[36rem] rotate-[-10deg] rounded-[3rem] border-[16px] border-slate-950 bg-white p-6 shadow-2xl lg:block">
              <div className="h-full rounded-[2rem] bg-slate-50 p-5">
                <div className="flex items-center justify-between rounded-2xl bg-safe-green px-4 py-3 text-white">
                  <span className="text-sm font-black">SafeKitchen Smart</span>
                  <span className="text-xs font-bold">05:47</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    'Presunto fatiado 200g',
                    'Leite integral 1L',
                    'Iogurte natural 170g',
                    'Pão de forma integral',
                  ].map((item, index) => (
                    <div
                      key={item}
                      className={`rounded-2xl p-4 shadow-sm ${
                        index === 0
                          ? 'bg-red-100 text-red-800'
                          : index === 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-white text-slate-700'
                      }`}
                    >
                      <p className="text-xs font-black uppercase">{item}</p>

                      <p className="mt-2 text-[11px] font-semibold opacity-75">
                        Validade calculada automaticamente
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="relative p-6 sm:p-10 lg:p-14">
            <div className="mb-8 lg:hidden">
              <img
                src="/safekitchen-logo.png"
                alt="SafeKitchen Smart"
                className="h-20 w-20 rounded-3xl object-contain"
              />
            </div>

            <p className="text-sm font-black uppercase tracking-[0.2em] text-safe-green">
              Acesso seguro
            </p>

            <h2 className="mt-2 text-3xl font-black text-safe-dark">
              Entrar no sistema
            </h2>

            <p className="mt-2 text-sm font-semibold text-slate-500">
              Use o acesso demo para testar a primeira versão.
            </p>

            <label className="mt-8 block text-sm font-bold text-slate-700">
              E-mail
            </label>

            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-safe-green focus-within:bg-white">
              <Mail size={18} className="text-slate-400" />

              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>

            <label className="mt-5 block text-sm font-bold text-slate-700">
              Senha
            </label>

            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-safe-green focus-within:bg-white">
              <Lock size={18} className="text-slate-400" />

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}

            <button
              disabled={loading}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-safe-green px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:brightness-95 disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
              <ArrowRight size={18} />
            </button>

            <div className="mt-6 rounded-3xl bg-safe-soft p-4 text-center text-xs font-bold text-safe-dark">
              Demo: admin@safekitchen.com.br / 123456
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;