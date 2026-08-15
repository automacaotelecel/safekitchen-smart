import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

const types = [
  'MAINTENANCE',
  'RESERVOIR_CLEANING',
  'NON_ROUTINE_CLEANING',
  'TRAINING',
  'RECEIVING',
] as const;

const recordSchema = z.object({
  type: z.enum(types),
  subject: z.string().trim().min(2).max(180),
  occurredAt: z.string().datetime(),
  nextDueAt: z.string().datetime().optional().nullable(),
  responsibleName: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
  data: z.record(z.unknown()).optional(),
});

async function evidenceBelongsToRestaurant(
  restaurantId: string,
  data?: Record<string, unknown>
) {
  const evidenceDocumentId = data?.evidenceDocumentId;
  if (evidenceDocumentId === null || evidenceDocumentId === undefined || evidenceDocumentId === '') {
    return true;
  }
  if (typeof evidenceDocumentId !== 'string') return false;

  const document = await prisma.document.findFirst({
    where: {
      id: evidenceDocumentId,
      restaurantId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  return Boolean(document);
}

router.get('/summary', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const now = new Date();
  const dueUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const base = {
    restaurantId: req.user.restaurantId,
    status: 'ACTIVE',
  };

  const [total, overdue, dueSoon] = await Promise.all([
    prisma.complianceRecord.count({ where: base }),
    prisma.complianceRecord.count({
      where: {
        ...base,
        nextDueAt: { lt: now },
      },
    }),
    prisma.complianceRecord.count({
      where: {
        ...base,
        nextDueAt: { gte: now, lte: dueUntil },
      },
    }),
  ]);

  return ok(res, { total, overdue, dueSoon });
});

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const type = String(req.query.type || '');
  const records = await prisma.complianceRecord.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      status: 'ACTIVE',
      ...(types.includes(type as (typeof types)[number])
        ? { type }
        : { type: { not: 'AUDIT' } }),
    },
    orderBy: [{ nextDueAt: 'asc' }, { occurredAt: 'desc' }],
    take: 500,
  });

  return ok(res, records);
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  if (!(await evidenceBelongsToRestaurant(req.user.restaurantId, parsed.data.data))) {
    return fail(res, 'A evidência informada não pertence a esta conta.', 422);
  }

  const record = await prisma.complianceRecord.create({
    data: {
      restaurantId: req.user.restaurantId,
      createdById: req.user.userId,
      type: parsed.data.type,
      subject: parsed.data.subject,
      occurredAt: new Date(parsed.data.occurredAt),
      nextDueAt: parsed.data.nextDueAt ? new Date(parsed.data.nextDueAt) : null,
      responsibleName: parsed.data.responsibleName,
      notes: parsed.data.notes || null,
      data: parsed.data.data as Prisma.InputJsonValue | undefined,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'ComplianceRecord',
    entityId: record.id,
    metadata: {
      type: record.type,
      evidenceAttached: Boolean(parsed.data.data?.evidenceDocumentId),
    },
  });

  return ok(res, record, 201);
});

router.patch('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = recordSchema.partial().safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  if (!(await evidenceBelongsToRestaurant(req.user.restaurantId, parsed.data.data))) {
    return fail(res, 'A evidência informada não pertence a esta conta.', 422);
  }

  const existing = await prisma.complianceRecord.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!existing) return fail(res, 'Registro não encontrado.', 404);

  const record = await prisma.complianceRecord.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      occurredAt: parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt)
        : undefined,
      nextDueAt: parsed.data.nextDueAt
        ? new Date(parsed.data.nextDueAt)
        : parsed.data.nextDueAt,
      data: parsed.data.data as Prisma.InputJsonValue | undefined,
    },
  });

  return ok(res, record);
});

router.delete('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const existing = await prisma.complianceRecord.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!existing) return fail(res, 'Registro não encontrado.', 404);

  const record = await prisma.complianceRecord.update({
    where: { id: existing.id },
    data: { status: 'ARCHIVED' },
  });

  return ok(res, record);
});

export default router;
