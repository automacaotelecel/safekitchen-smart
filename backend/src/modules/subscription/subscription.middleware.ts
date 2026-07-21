import { NextFunction, Request, Response } from 'express';

import { fail } from '../../lib/http';

export function subscriptionIsActive(input: {
  subscriptionStatus: string;
  trialEndsAt?: Date | string | null;
  subscriptionEndsAt?: Date | string | null;
}) {
  const now = Date.now();

  if (input.subscriptionStatus === 'ACTIVE') {
    return !input.subscriptionEndsAt || new Date(input.subscriptionEndsAt).getTime() >= now;
  }

  if (input.subscriptionStatus === 'TRIALING') {
    return Boolean(input.trialEndsAt && new Date(input.trialEndsAt).getTime() >= now);
  }

  if (input.subscriptionStatus === 'PAST_DUE') {
    return Boolean(
      input.subscriptionEndsAt && new Date(input.subscriptionEndsAt).getTime() >= now
    );
  }

  return false;
}

export function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  if (subscriptionIsActive(req.user)) return next();

  return fail(
    res,
    'Seu período de teste ou assinatura terminou. Regularize o plano para continuar.',
    402
  );
}
