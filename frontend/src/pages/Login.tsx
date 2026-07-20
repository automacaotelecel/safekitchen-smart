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

  const [registering, setRegistering] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError('');

    try {
      const data = await api<LoginResponse>(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(
          registering
            ? { restaurantName, name, email, password }
            : { email, password }
        ),
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
    <div className="min-h-screen overflow-hidden bg-[#021E27] text-white">
      <div className="absolute inset-x-0 top-0 h-[58vh] bg-[radial-gradient(circle_at_top_right,rgba(0,229,194,0.45),transparent_34rem),linear-gradient(135deg,#052D3A_0%,#0B6F73_48%,#11D5B3_100%)]" />
      <div className="absolute left-[-10rem] top-[-10rem] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute right-[-10rem] top-20 h-96 w-96 rounded-full bg-emerald-300/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,211,238,0.12)_1px,transparent_1px)] [background-size:18px_18px] opacity-40" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center p-4 lg:p-8">
        <div className="grid w-full overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#061923] shadow-[0_30px_90px_rgba(0,0,0,0.45)] lg:grid-cols-[1.15fr_.85fr]">
          <div className="relative min-h-[560px] overflow-hidden bg-[linear-gradient(135deg,rgba(4,37,49,0.96),rgba(5,76,83,0.88)),url('/ref-dark.png')] bg-cover bg-center p-7 text-white lg:p-12">
            <div className="absolute inset-0 bg-[#021E27]/55" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,194,0.25),transparent_22rem)]" />

            <div className="relative z-20 flex items-center justify-between gap-4">
              <img
                src="/safekitchen-logo.png"
                alt="SafeKitchen Smart"
                className="h-24 w-24 rounded-3xl bg-white object-contain p-1 shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
              />
            </div>

            <div className="relative z-20 mt-12 max-w-xl">
              <h1 className="mt-6 text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">
                Economize <span className="text-[#19F5C7]">tempo</span>
                <br />
                e tenha mais <span className="text-[#19F5C7]">controle</span>
                <br />
                na sua cozinha
              </h1>

              <p className="mt-6 max-w-md text-lg font-semibold leading-relaxed text-white/85">
                Etiquetas automáticas, validade calculada e histórico para
                auditoria em tablet e celular.
              </p>

              <div className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <Tags className="text-[#19F5C7]" />

                  <p className="mt-3 text-sm font-black">Etiquetas</p>

                  <p className="mt-1 text-xs text-white/70">
                    Produto aberto, produção e mais.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <CheckCircle2 className="text-[#19F5C7]" />

                  <p className="mt-3 text-sm font-black">Validade</p>

                  <p className="mt-1 text-xs text-white/70">
                    Cálculo automático por regra.
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-24 right-[-5rem] z-10 hidden h-80 w-[36rem] rotate-[-10deg] rounded-[3rem] border-[16px] border-[#020B13] bg-[#061923] p-6 shadow-2xl lg:block">
              <div className="h-full rounded-[2rem] bg-[#0B1D26] p-5">
                <div className="flex items-center justify-between rounded-2xl bg-[linear-gradient(135deg,#1EF0A3,#16C8D6)] px-4 py-3 text-[#031B22]">
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
                          ? 'bg-red-950/70 text-red-100'
                          : index === 1
                            ? 'bg-yellow-900/70 text-yellow-100'
                            : 'bg-white/10 text-white'
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

          <form
            onSubmit={submit}
            className="relative bg-[#071922] p-6 text-white sm:p-10 lg:p-14"
          >
            <div className="mb-8 lg:hidden">
              <img
                src="/safekitchen-logo.png"
                alt="SafeKitchen Smart"
                className="h-20 w-20 rounded-3xl bg-white object-contain p-1"
              />
            </div>

            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#19F5C7]">
              Acesso seguro
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">
              {registering ? 'Criar conta' : 'Entrar no sistema'}
            </h2>

            <p className="mt-2 text-sm font-semibold text-white/65">
              {registering
                ? 'Comece com 7 dias de teste e cadastre sua operação.'
                : 'Acesse os controles da sua empresa com segurança.'}
            </p>

            {registering && (
              <>
                <label className="mt-8 block text-sm font-bold text-white/85">
                  Nome da empresa/restaurante
                </label>
                <input
                  required
                  value={restaurantName}
                  onChange={(event) => setRestaurantName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#19F5C7]"
                />

                <label className="mt-5 block text-sm font-bold text-white/85">
                  Seu nome
                </label>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#19F5C7]"
                />
              </>
            )}

            <label className={`${registering ? 'mt-5' : 'mt-8'} block text-sm font-bold text-white/85`}>
              E-mail
            </label>

            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition focus-within:border-[#19F5C7] focus-within:bg-black/30">
              <Mail size={18} className="text-white/55" />

              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
              />
            </div>

            <label className="mt-5 block text-sm font-bold text-white/85">
              Senha
            </label>

            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition focus-within:border-[#19F5C7] focus-within:bg-black/30">
              <Lock size={18} className="text-white/55" />

              <input
                type="password"
                minLength={registering ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/20 p-3 text-sm font-bold text-red-100">
                {error}
              </p>
            )}

            <button
              disabled={loading}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#35F29E,#18C9D7)] px-5 py-4 text-sm font-black text-[#031B22] shadow-[0_18px_45px_rgba(25,245,199,0.24)] transition hover:brightness-105 disabled:opacity-60"
            >
              {loading
                ? registering ? 'Criando conta...' : 'Entrando...'
                : registering ? 'Criar conta e iniciar teste' : 'Entrar'}
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              onClick={() => {
                setRegistering((old) => !old);
                setError('');
              }}
              className="mt-6 w-full rounded-3xl border border-white/10 bg-white/8 p-4 text-center text-xs font-bold text-[#19F5C7]"
            >
              {registering ? 'Já tenho conta' : 'Criar conta com 7 dias de teste'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
