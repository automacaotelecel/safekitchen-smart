import { Router } from 'express';
import { z } from 'zod';
import { addDays, addHours } from 'date-fns';

import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

const labelSchema = z.object({
  type: z.string().min(2),
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

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
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

  return addDays(input.openedAt, 3);
}

router.use((req, res, next) => {
  const token = req.query.token;

  if (token && typeof token === 'string') {
    req.headers.authorization = `Bearer ${token}`;
  }

  next();
});

router.use(authMiddleware);

router.get('/dashboard', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const labels = await prisma.label.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      status: {
        not: 'CANCELADA',
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const now = new Date();

  const total = labels.length;
  const expired = labels.filter(
    (label) => label.expiresAt && label.expiresAt.getTime() < now.getTime()
  ).length;

  const active = labels.filter(
    (label) => !label.expiresAt || label.expiresAt.getTime() >= now.getTime()
  ).length;

  const noExpiration = labels.filter((label) => !label.expiresAt).length;

  return ok(res, {
    total,
    active,
    expired,
    noExpiration,
    recent: labels.slice(0, 5),
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

  const openedAt = parseDate(parsed.data.openedAt);

  const expiresAt = await calculateExpiration({
    restaurantId: req.user.restaurantId,
    productId: parsed.data.productId,
    type: parsed.data.type,
    conservationMode: parsed.data.conservationMode,
    openedAt,
    manualValidityValue: parsed.data.manualValidityValue,
    manualValidityUnit: parsed.data.manualValidityUnit,
  });

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

  return ok(res, label, 201);
});

router.get('/:id/pdf', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const { generateLabelPdf } = await import('./pdf.service');

  const label = await prisma.label.findFirst({
    where: {
      id: req.params.id,
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

  const { generateBatchLabelsPdf } = await import('./pdf.service');

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
      id: req.params.id,
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

  const label = await prisma.label.findFirst({
    where: {
      id: req.params.id,
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
        ? `${label.observations}\n\nEtiqueta cancelada/removida em ${new Date().toLocaleString('pt-BR')}.`
        : `Etiqueta cancelada/removida em ${new Date().toLocaleString('pt-BR')}.`,
    },
  });

  return ok(res, {
    deleted: false,
    canceled: true,
    message: 'Etiqueta cancelada para preservar rastreabilidade.',
    label: updated,
  });
});

export default router;