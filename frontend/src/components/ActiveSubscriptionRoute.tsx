import { useEffect, useState, type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

import { api } from '../api/client';

type BillingAccess = {
  restaurant: {
    subscriptionStatus: string;
    trialEndsAt?: string | null;
    subscriptionEndsAt?: string | null;
  } | null;
};

function hasOperationalAccess(restaurant: BillingAccess['restaurant']) {
  if (!restaurant) return false;
  const now = Date.now();

  if (restaurant.subscriptionStatus === 'ACTIVE') {
    return !restaurant.subscriptionEndsAt || new Date(restaurant.subscriptionEndsAt).getTime() >= now;
  }

  if (restaurant.subscriptionStatus === 'PAST_DUE') {
    return Boolean(
      restaurant.subscriptionEndsAt && new Date(restaurant.subscriptionEndsAt).getTime() >= now
    );
  }

  // Mantém apenas testes antigos já concedidos. Novos cadastros nascem como PENDING.
  if (restaurant.subscriptionStatus === 'TRIALING') {
    return Boolean(restaurant.trialEndsAt && new Date(restaurant.trialEndsAt).getTime() >= now);
  }

  return false;
}

export function ActiveSubscriptionRoute({ children }: { children: ReactElement }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'blocked' | 'error'>('loading');

  useEffect(() => {
    let active = true;

    api<BillingAccess>('/api/billing/subscription')
      .then((billing) => {
        if (active) setState(hasOperationalAccess(billing.restaurant) ? 'allowed' : 'blocked');
      })
      .catch(() => {
        if (active) setState('error');
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === 'blocked') return <Navigate to="/assinatura" replace />;
  if (state === 'allowed') return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f8f8] p-6">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <img src="/safekitchen-logo.png" alt="SafeKitchen Smart" className="mx-auto h-20 w-20 rounded-2xl object-contain" />
        <p className="mt-5 font-black text-safe-dark">
          {state === 'error' ? 'Não foi possível validar sua assinatura.' : 'Validando seu acesso...'}
        </p>
        {state === 'error' && (
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-2xl bg-safe-dark px-5 py-3 text-sm font-black text-white">
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
