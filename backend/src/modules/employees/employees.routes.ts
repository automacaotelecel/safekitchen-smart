import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const employees = await prisma.employee.findMany({
    where: { restaurantId: req.user.restaurantId },
    orderBy: { name: 'asc' }
  });
  return ok(res, employees);
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const schema = z.object({ name: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Nome inválido.', 422, parsed.error.flatten());

  const employee = await prisma.employee.create({
    data: { restaurantId: req.user.restaurantId, name: parsed.data.name }
  });
  return ok(res, employee, 201);
});

export default router;
