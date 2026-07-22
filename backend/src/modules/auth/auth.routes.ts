import { randomBytes } from 'crypto';

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../../config/env';
import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware, type AuthUser } from './auth.middleware';
import { subscriptionIsActive } from '../subscription/subscription.middleware';

const router = Router();

const registerSchema = z.object({
  restaurantName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(100),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function slugify(value: string) {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return `${base || 'empresa'}-${randomBytes(3).toString('hex')}`;
}

function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: '12h' });
}

function accessState(input: {
  subscriptionStatus: string;
  trialEndsAt?: Date | string | null;
  subscriptionEndsAt?: Date | string | null;
}) {
  const operationalAccess = subscriptionIsActive(input);
  return {
    operationalAccess,
    requiresContracting: !operationalAccess,
  };
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const email = normalizeEmail(parsed.data.email);
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 'Este e-mail já está cadastrado.', 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: parsed.data.restaurantName,
      slug: slugify(parsed.data.restaurantName),
      plan: 'UNASSIGNED',
      subscriptionStatus: 'PENDING',
      trialEndsAt: null,
      maxUsers: 1,
      users: {
        create: {
          name: parsed.data.name,
          email,
          passwordHash,
          role: 'ADMIN',
        },
      },
      employees: {
        create: {
          name: parsed.data.name,
          role: 'Administrador',
          active: true,
        },
      },
    },
    include: {
      users: true,
    },
  });

  const user = restaurant.users[0];
  const authUser: AuthUser = {
    userId: user.id,
    restaurantId: restaurant.id,
    role: 'ADMIN',
    name: user.name,
    email: user.email,
    subscriptionStatus: restaurant.subscriptionStatus,
    trialEndsAt: restaurant.trialEndsAt,
    subscriptionEndsAt: restaurant.subscriptionEndsAt,
  };

  await recordAudit({
    restaurantId: restaurant.id,
    userId: user.id,
    action: 'REGISTER',
    entity: 'Restaurant',
    entityId: restaurant.id,
  });

  return ok(
    res,
    {
      token: signToken(authUser),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        plan: restaurant.plan,
        subscriptionStatus: restaurant.subscriptionStatus,
        trialEndsAt: restaurant.trialEndsAt,
      },
      ...accessState(restaurant),
    },
    201
  );
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const user = await prisma.user.findUnique({
    where: {
      email: normalizeEmail(parsed.data.email),
    },
    include: {
      restaurant: true,
    },
  });

  if (!user || !user.active || !user.restaurant.active) {
    return fail(res, 'E-mail ou senha inválidos.', 401);
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return fail(res, 'E-mail ou senha inválidos.', 401);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const authUser: AuthUser = {
    userId: user.id,
    restaurantId: user.restaurantId,
    role: user.role as AuthUser['role'],
    name: user.name,
    email: user.email,
    subscriptionStatus: user.restaurant.subscriptionStatus,
    trialEndsAt: user.restaurant.trialEndsAt,
    subscriptionEndsAt: user.restaurant.subscriptionEndsAt,
  };

  return ok(res, {
    token: signToken(authUser),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    restaurant: {
      id: user.restaurant.id,
      name: user.restaurant.name,
      plan: user.restaurant.plan,
      subscriptionStatus: user.restaurant.subscriptionStatus,
      trialEndsAt: user.restaurant.trialEndsAt,
    },
    ...accessState(user.restaurant),
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const user = await prisma.user.findFirst({
    where: {
      id: req.user.userId,
      restaurantId: req.user.restaurantId,
      active: true,
    },
    include: {
      restaurant: true,
    },
  });

  if (!user) return fail(res, 'Usuário não encontrado.', 404);

  return ok(res, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    restaurant: {
      id: user.restaurant.id,
      name: user.restaurant.name,
      document: user.restaurant.document,
      timezone: user.restaurant.timezone,
      plan: user.restaurant.plan,
      subscriptionStatus: user.restaurant.subscriptionStatus,
      trialEndsAt: user.restaurant.trialEndsAt,
      subscriptionEndsAt: user.restaurant.subscriptionEndsAt,
      maxUsers: user.restaurant.maxUsers,
    },
    ...accessState(user.restaurant),
  });
});

export default router;
