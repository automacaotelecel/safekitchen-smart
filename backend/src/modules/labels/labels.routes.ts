import { Router } from 'express';
import { z } from 'zod';
import { addDays, addHours } from 'date-fns';

import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { authMiddleware } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';
import { assertLabelQuota } from '../billing/entitlements';
import {
  generateBatchLabelsPdf,
  generateLabelPdf,
} from './pdf.service';

const router = Router();

const labelSchema = z.object({
  type: z.enum([
    'PRODUTO_ABERTO',
    'PRODUCAO',
    'DESCONGELAMENTO_DESSALGUE',
    'ARMAZENAMENTO_CARNES',
    'REEMBALAGEM',
    'AMOSTRAS',
    'NAO_CONFORME',
    'PRODUTO_QUIMICO',
  ]),
  productId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  productName: z.string().min(2, 'Informe o produto.'),
  brand: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  batch: z.string().optional().nullable(),
  conservationMode: z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']).default('REFRIGERADO'),
  openedAt: z.string().min(1),
  responsibleName: z.string().min(2, 'Informe o responsável.'),
  quantity: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  manualValidityValue: z.number().optional().nullable(),
  manualValidityUnit: z.enum(['days', 'hours']).optional().nullable(),
  extraData: z.record(z.any()).optional().nullable(),
});

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

async function calculateExpiration(input: {
  restaurantId: string;
  productId?: string | null;
  type: string;
  conservationMode: string;
  openedAt: Date;
  manualValidityValue?: number | null;
  manualValidityUnit?: 'days' | 'hours' | null;
}) {
  if (input.type === 'NAO_CONFORME') return null;

  if (input.type === 'AMOSTRAS') {
    return addHours(input.openedAt, 72);
  }

  if (input.manualValidityValue && input.manualValidityValue > 0) {
    return input.manualValidityUnit === 'hours'
      ? addHours(input.openedAt, input.manualValidityValue)
      : addDays(input.openedAt, input.manualValidityValue);
  }

  if (input.productId) {
    const rule = await prisma.validityRule.findFirst({
      where: {
        productId: input.productId,
        conservationMode: input.conservationMode,
      },
    });

    if (rule) {
      return rule.validityUnit === 'hours'
        ? addHours(input.openedAt, rule.validityValue)
        : addDays(input.openedAt, rule.validityValue);
    }
  }

  return undefined;
}

router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get('/dashboard', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const base = {
    restaurantId: req.user.restaurantId,
    status: { not: 'CANCELADA' },
  };

  const [total, expired, active, expiringSoon, noExpiration, recent] =
    await Promise.all([
      prisma.label.count({ where: base }),
      prisma.label.count({
        where: { ...base, expiresAt: { lt: now } },
      }),
      prisma.label.count({
        where: {
          ...base,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      }),
      prisma.label.count({
        where: { ...base, expiresAt: { gte: now, lte: tomorrow } },
      }),
      prisma.label.count({ where: { ...base, expiresAt: null } }),
      prisma.label.findMany({
        where: base,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  return ok(res, {
    total,
    active,
    expired,
    expiringSoon,
    noExpiration,
    recent,
  });
});

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const includeCanceled = String(req.query.includeCanceled || '') === '1';
  const limit = Number(req.query.limit || 100);

  const labels = await prisma.label.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      ...(includeCanceled ? {} : { status: { not: 'CANCELADA' } }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 300) : 100,
  });

  return ok(res, labels);
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = labelSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  try {
    await assertLabelQuota(req.user.restaurantId);
  } catch (error) {
    return fail(res, error instanceof Error ? error.message : 'Limite do plano atingido.', 409);
  }

  const openedAt = parseDate(parsed.data.openedAt);
  if (!openedAt) return fail(res, 'Data base inválida.', 422);

  if (parsed.data.productId) {
    const product = await prisma.product.findFirst({
      where: {
        id: parsed.data.productId,
        active: true,
        OR: [
          { restaurantId: req.user.restaurantId },
          { isGlobal: true },
        ],
      },
    });

    if (!product) return fail(res, 'Produto inválido para esta conta.', 422);
  }

  if (parsed.data.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: {
        id: parsed.data.employeeId,
        restaurantId: req.user.restaurantId,
        active: true,
      },
    });

    if (!employee) return fail(res, 'Responsável inválido para esta conta.', 422);
  }

  const expiresAt = await calculateExpiration({
    restaurantId: req.user.restaurantId,
    productId: parsed.data.productId,
    type: parsed.data.type,
    conservationMode: parsed.data.conservationMode,
    openedAt,
    manualValidityValue: parsed.data.manualValidityValue,
    manualValidityUnit: parsed.data.manualValidityUnit,
  });

  if (expiresAt === undefined) {
    return fail(
      res,
      'Este produto não possui regra de validade. Informe a validade manualmente ou configure uma regra técnica.',
      422
    );
  }

  const normalizedExtraData = parsed.data.extraData || {};

  const label = await prisma.label.create({
    data: {
      restaurantId: req.user.restaurantId,
      productId: parsed.data.productId || null,
      employeeId: parsed.data.employeeId || null,
      type: parsed.data.type,
      productName: parsed.data.productName.trim(),
      brand: normalizeText(parsed.data.brand),
      supplier: normalizeText(parsed.data.supplier),
      batch: normalizeText(parsed.data.batch),
      conservationMode: parsed.data.conservationMode,
      openedAt,
      expiresAt,
      quantity: normalizeText(parsed.data.quantity),
      responsibleName: parsed.data.responsibleName.trim(),
      observations: normalizeText(parsed.data.observations),
      extraData: Object.keys(normalizedExtraData).length
        ? JSON.stringify(normalizedExtraData)
        : null,
      status: 'ATIVA',
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'Label',
    entityId: label.id,
    metadata: { type: label.type, productName: label.productName },
  });

  return ok(res, label, 201);
});

router.post('/by-ids', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = z.object({
    ids: z.array(z.string()).min(1).max(300),
  }).safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const labels = await prisma.label.findMany({
    where: {
      id: { in: parsed.data.ids },
      restaurantId: req.user.restaurantId,
      status: { not: 'CANCELADA' },
    },
  });

  return ok(res, labels);
});

router.get('/:id/pdf', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const label = await prisma.label.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!label) return fail(res, 'Etiqueta não encontrada.', 404);

  const buffer = await generateLabelPdf(label as any);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="etiqueta-${label.id}.pdf"`);

  return res.send(buffer);
});

router.post('/batch-pdf', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const schema = z.object({
    items: z.array(
      z.object({
        id: z.string(),
        copies: z.number().min(1).max(30).default(1),
      })
    ).min(1),
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const ids = parsed.data.items.map((item) => item.id);

  const labels = await prisma.label.findMany({
    where: {
      id: {
        in: ids,
      },
      restaurantId: req.user.restaurantId,
    },
  });

  const expandedLabels = parsed.data.items.flatMap((item) => {
    const label = labels.find((current) => current.id === item.id);

    if (!label) return [];

    return Array.from({ length: item.copies }, () => label);
  });

  if (!expandedLabels.length) {
    return fail(res, 'Nenhuma etiqueta encontrada.', 404);
  }

  const buffer = await generateBatchLabelsPdf(expandedLabels as any);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="etiquetas-lote.pdf"`);

  return res.send(buffer);
});

router.patch('/:id/cancel', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const label = await prisma.label.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!label) return fail(res, 'Etiqueta não encontrada.', 404);

  const updated = await prisma.label.update({
    where: {
      id: label.id,
    },
    data: {
      status: 'CANCELADA',
      observations: label.observations
        ? `${label.observations}\n\nEtiqueta cancelada em ${new Date().toLocaleString('pt-BR')}.`
        : `Etiqueta cancelada em ${new Date().toLocaleString('pt-BR')}.`,
    },
  });

  return ok(res, updated);
});

router.delete('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const permanent = String(req.query.permanent || '') === '1';

  if (permanent && req.user.role !== 'ADMIN') {
    return fail(res, 'Somente administradores podem excluir definitivamente.', 403);
  }

  const label = await prisma.label.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!label) return fail(res, 'Etiqueta não encontrada.', 404);

  if (permanent) {
    await prisma.label.delete({
      where: {
        id: label.id,
      },
    });

    return ok(res, {
      deleted: true,
      canceled: false,
      message: 'Etiqueta excluída definitivamente.',
    });
  }

  const updated = await prisma.label.update({
    where: {
      id: label.id,
    },
    data: {
      status: 'CANCELADA',
      observations: label.observations
        ? `${label.observations}\n\nEtiqueta cancelada/removida em ${new Date().toLocaleString('pt-BR')}.`
        : `Etiqueta cancelada/removida em ${new Date().toLocaleString('pt-BR')}.`,
    },
  });

  return ok(res, {
    deleted: false,
    canceled: true,
    message: 'Etiqueta cancelada e removida da lista principal.',
    label: updated,
  });
});

export default router;
