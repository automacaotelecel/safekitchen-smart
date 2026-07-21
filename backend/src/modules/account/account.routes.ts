import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware, requireRole } from '../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
});

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.user.restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      document: true,
      timezone: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      maxUsers: true,
      active: true,
      _count: {
        select: {
          users: {
            where: { active: true },
          },
        },
      },
    },
  });

  if (!restaurant) return fail(res, 'Conta não encontrada.', 404);
  return ok(res, restaurant);
});

router.get('/users', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const users = await prisma.user.findMany({
    where: {
      restaurantId: req.user.restaurantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return ok(res, users);
});

router.post('/users', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.user.restaurantId },
    select: {
      maxUsers: true,
      _count: {
        select: {
          users: {
            where: { active: true },
          },
        },
      },
    },
  });

  if (!restaurant) return fail(res, 'Conta não encontrada.', 404);
  if (restaurant._count.users >= restaurant.maxUsers) {
    return fail(res, 'Limite de usuários do plano atingido.', 409);
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 'Este e-mail já está cadastrado.', 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      restaurantId: req.user.restaurantId,
      name: parsed.data.name,
      email,
      passwordHash,
      role: parsed.data.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'User',
    entityId: user.id,
    metadata: { role: user.role },
  });

  return ok(res, user, 201);
});

router.patch('/users/:id', requireRole('ADMIN'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const target = await prisma.user.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!target) return fail(res, 'Usuário não encontrado.', 404);
  if (target.id === req.user.userId && parsed.data.active === false) {
    return fail(res, 'Você não pode desativar o próprio usuário.', 409);
  }

  const removesAdministrator =
    target.role === 'ADMIN' &&
    target.active &&
    (parsed.data.active === false ||
      (parsed.data.role !== undefined && parsed.data.role !== 'ADMIN'));

  if (removesAdministrator) {
    const otherAdministrators = await prisma.user.count({
      where: {
        restaurantId: req.user.restaurantId,
        role: 'ADMIN',
        active: true,
        id: { not: target.id },
      },
    });
    if (otherAdministrators === 0) {
      return fail(res, 'A conta precisa manter pelo menos um administrador ativo.', 409);
    }
  }

  if (!target.active && parsed.data.active === true) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user.restaurantId },
      select: {
        maxUsers: true,
        _count: { select: { users: { where: { active: true } } } },
      },
    });
    if (restaurant && restaurant._count.users >= restaurant.maxUsers) {
      return fail(res, 'Limite de usuários do plano atingido.', 409);
    }
  }

  const passwordHash = parsed.data.password
    ? await bcrypt.hash(parsed.data.password, 12)
    : undefined;

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      name: parsed.data.name,
      role: parsed.data.role,
      active: parsed.data.active,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'UPDATE',
    entity: 'User',
    entityId: user.id,
    metadata: { role: user.role, active: user.active },
  });

  return ok(res, user);
});

export default router;
