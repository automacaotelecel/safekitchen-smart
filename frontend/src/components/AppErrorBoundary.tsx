import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface:', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8f8] p-5 text-safe-dark">
        <section className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            !
          </div>
          <h1 className="mt-5 text-2xl font-black">Não foi possível abrir esta tela</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            A página encontrou uma versão desatualizada ou uma resposta inesperada. Atualize para carregar a versão mais recente.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={this.reload} className="rounded-2xl bg-safe-green px-5 py-3 text-sm font-black text-white">
              Atualizar página
            </button>
            <button type="button" onClick={this.goHome} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black">
              Voltar ao início
            </button>
          </div>
        </section>
      </main>
    );
  }
}
