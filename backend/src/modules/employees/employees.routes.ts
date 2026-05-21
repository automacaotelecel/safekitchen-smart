import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Informe o nome do funcionário.'),
  role: z.string().optional().nullable(),
  shift: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')).nullable(),
  active: z.boolean().optional(),
});

const updateEmployeeSchema = z.object({
  name: z.string().min(2, 'Informe o nome do funcionário.').optional(),
  role: z.string().optional().nullable(),
  shift: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')).nullable(),
  active: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const employees = await prisma.employee.findMany({
    where: {
      restaurantId: req.user.restaurantId,
    },
    orderBy: [
      {
        active: 'desc',
      },
      {
        name: 'asc',
      },
    ],
  });

  return ok(res, employees);
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = createEmployeeSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const employee = await prisma.employee.create({
    data: {
      restaurantId: req.user.restaurantId,
      name: parsed.data.name.trim(),
      role: parsed.data.role?.trim() || null,
      shift: parsed.data.shift?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email?.trim() || null,
      active: parsed.data.active ?? true,
    },
  });

  return ok(res, employee, 201);
});

router.patch('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = updateEmployeeSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: req.params.id,
      restaurantId: req.user.restaurantId,
    },
  });

  if (!employee) {
    return fail(res, 'Funcionário não encontrado.', 404);
  }

  const updated = await prisma.employee.update({
    where: {
      id: employee.id,
    },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role !== undefined ? { role: parsed.data.role?.trim() || null } : {}),
      ...(parsed.data.shift !== undefined ? { shift: parsed.data.shift?.trim() || null } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone?.trim() || null } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email?.trim() || null } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    },
  });

  return ok(res, updated);
});

router.delete('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const employee = await prisma.employee.findFirst({
    where: {
      id: req.params.id,
      restaurantId: req.user.restaurantId,
    },
  });

  if (!employee) {
    return fail(res, 'Funcionário não encontrado.', 404);
  }

  const updated = await prisma.employee.update({
    where: {
      id: employee.id,
    },
    data: {
      active: false,
    },
  });

  return ok(res, {
    deleted: true,
    employee: updated,
  });
});

export default router;