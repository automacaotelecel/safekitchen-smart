import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { fail } from '../../lib/http';

export type AuthUser = {
  userId: string;
  restaurantId: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  name: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  if (!header?.startsWith('Bearer ') && !queryToken) return fail(res, 'Token não enviado.', 401);

  const token = header?.startsWith('Bearer ') ? header.replace('Bearer ', '').trim() : queryToken;
  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    return next();
  } catch {
    return fail(res, 'Token inválido ou expirado.', 401);
  }
}
