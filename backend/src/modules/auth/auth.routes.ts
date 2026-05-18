import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';
import { env } from '../../config/env';
import { authMiddleware } from './auth.middleware';

const router = Router();

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const { restaurantName, name, email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(res, 'Este e-mail já está cadastrado.', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: restaurantName,
      users: { create: { name, email, passwordHash, role: 'ADMIN' } },
      employees: { create: { name, active: true } }
    },
    include: { users: true }
  });

  const user = restaurant.users[0];
  const token = jwt.sign(
    { userId: user.id, restaurantId: restaurant.id, role: user.role, name: user.name, email: user.email },
    env.jwtSecret,
    { expiresIn: '7d' }
  );

  return ok(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant }, 201);
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { restaurant: true }
  });
  if (!user) return fail(res, 'E-mail ou senha inválidos.', 401);

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return fail(res, 'E-mail ou senha inválidos.', 401);

  const token = jwt.sign(
    { userId: user.id, restaurantId: user.restaurantId, role: user.role, name: user.name, email: user.email },
    env.jwtSecret,
    { expiresIn: '7d' }
  );

  return ok(res, {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurant: user.restaurant
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { restaurant: true }
  });
  if (!user) return fail(res, 'Usuário não encontrado.', 404);
  return ok(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant: user.restaurant });
});

export default router;
