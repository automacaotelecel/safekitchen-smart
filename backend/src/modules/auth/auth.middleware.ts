import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { fail } from '../../lib/http';
import { prisma } from '../../lib/prisma';

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type AuthUser = {
  userId: string;
  restaurantId: string;
  role: UserRole;
  name: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt: Date | string | null;
  subscriptionEndsAt: Date | string | null;
};

type TokenPayload = {
  userId?: string;
  restaurantId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return fail(res, 'Token não enviado.', 401);
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;

    if (!payload.userId || !payload.restaurantId) {
      return fail(res, 'Token inválido ou expirado.', 401);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        restaurantId: payload.restaurantId,
        active: true,
        restaurant: {
          active: true,
        },
      },
      select: {
        id: true,
        restaurantId: true,
        role: true,
        name: true,
        email: true,
        restaurant: {
          select: {
            subscriptionStatus: true,
            trialEndsAt: true,
            subscriptionEndsAt: true,
          },
        },
      },
    });

    if (!user) {
      return fail(res, 'Usuário inativo ou não encontrado.', 401);
    }

    if (!['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(user.role)) {
      return fail(res, 'Perfil de acesso inválido.', 403);
    }

    req.user = {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role as UserRole,
      name: user.name,
      email: user.email,
      subscriptionStatus: user.restaurant.subscriptionStatus,
      trialEndsAt: user.restaurant.trialEndsAt,
      subscriptionEndsAt: user.restaurant.subscriptionEndsAt,
    };

    return next();
  } catch {
    return fail(res, 'Token inválido ou expirado.', 401);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 'Não autenticado.', 401);
    if (!roles.includes(req.user.role)) return fail(res, 'Acesso não autorizado.', 403);
    return next();
  };
}
