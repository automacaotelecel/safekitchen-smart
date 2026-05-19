import { Router } from 'express';
import { addDays, addHours } from 'date-fns';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';
import { buildLabelPdf, buildLabelsSheetPdf } from './pdf.service';

const router = Router();
router.use(authMiddleware);

const createLabelSchema = z.object({
  type: z.enum(['PRODUTO_ABERTO', 'PRODUCAO', 'DESCONGELAMENTO_DESSALGUE', 'ARMAZENAMENTO_CARNES', 'REEMBALAGEM', 'AMOSTRAS', 'NAO_CONFORME', 'PRODUTO_QUIMICO']),
  productId: z.string().optional().nullable(),
  productName: z.string().min(2),
  brand: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  batch: z.string().optional().nullable(),
  conservationMode: z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']),
  openedAt: z.string().min(10),
  employeeId: z.string().optional().nullable(),
  responsibleName: z.string().min(2),
  quantity: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  manualValidityValue: z.number().int().positive().optional().nullable(),
  manualValidityUnit: z.enum(['hours', 'days']).optional().nullable(),
  extraData: z.record(z.any()).optional().nullable()
});

const batchPdfSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    copies: z.number().int().min(1).max(30).default(1)
  })).min(1).max(120)
});

async function calculateExpiration(input: z.infer<typeof createLabelSchema>) {
  const openedAt = new Date(input.openedAt);

  if (input.type === 'NAO_CONFORME') return null;
  if (input.type === 'AMOSTRAS') return addHours(openedAt, 72);

  if (input.manualValidityValue && input.manualValidityUnit) {
    return input.manualValidityUnit === 'hours'
      ? addHours(openedAt, input.manualValidityValue)
      : addDays(openedAt, input.manualValidityValue);
  }

  const productRule = input.productId
    ? await prisma.validityRule.findFirst({
        where: { productId: input.productId, conservationMode: input.conservationMode },
        orderBy: { createdAt: 'asc' }
      })
    : null;

  const fallbackRule = productRule || await prisma.validityRule.findFirst({
    where: {
      conservationMode: input.conservationMode,
      OR: [
        { description: { contains: input.productName } },
        { category: { contains: input.productName } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });

  if (!fallbackRule) return null;

  return fallbackRule.validityUnit === 'hours'
    ? addHours(openedAt, fallbackRule.validityValue)
    : addDays(openedAt, fallbackRule.validityValue);
}

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const labels = await prisma.label.findMany({
    where: { restaurantId: req.user.restaurantId },
    include: { product: true, employee: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  return ok(res, labels);
});

router.get('/dashboard', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const today = new Date();
  const labels = await prisma.label.findMany({
    where: { restaurantId: req.user.restaurantId },
    orderBy: { createdAt: 'desc' }
  });
  const total = labels.length;
  const expired = labels.filter((l: any) => l.expiresAt && l.expiresAt < today).length;
  const noExpiration = labels.filter((l: any) => !l.expiresAt).length;
  const recent = labels.slice(0, 5);
  return ok(res, { total, expired, active: total - expired, noExpiration, recent });
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const parsed = createLabelSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const expiresAt = await calculateExpiration(parsed.data);
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.user.restaurantId },
    select: { name: true }
  });

  const normalizedExtraData = {
    ...(parsed.data.extraData || {}),
    ...(parsed.data.type === 'AMOSTRAS'
      ? {
          restaurantName:
            (parsed.data.extraData as any)?.restaurantName ||
            restaurant?.name ||
            'Restaurante',
          discardAt: expiresAt ? expiresAt.toISOString() : null
        }
      : {})
  };

  const label = await prisma.label.create({
    data: {
      restaurantId: req.user.restaurantId,
      productId: parsed.data.productId || null,
      employeeId: parsed.data.employeeId || null,
      type: parsed.data.type,
      productName: parsed.data.productName.toUpperCase(),
      brand: parsed.data.brand || null,
      supplier: parsed.data.supplier || null,
      batch: parsed.data.batch || null,
      conservationMode: parsed.data.conservationMode,
      openedAt: new Date(parsed.data.openedAt),
      expiresAt,
      quantity: parsed.data.quantity || null,
      responsibleName: parsed.data.responsibleName,
      observations: parsed.data.observations || null,
      extraData: Object.keys(normalizedExtraData).length ? JSON.stringify(normalizedExtraData) : null
    }
  });

  return ok(res, label, 201);
});


router.post('/batch-pdf', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = batchPdfSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const ids = parsed.data.items.map((item) => item.id);
  const labels = await prisma.label.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      id: { in: ids }
    }
  });

  const labelById = new Map(labels.map((label: any) => [label.id, label]));
  const expanded = parsed.data.items.flatMap((item) => {
    const label = labelById.get(item.id);
    if (!label) return [];
    return Array.from({ length: item.copies }, () => label);
  });

  if (expanded.length === 0) return fail(res, 'Nenhuma etiqueta encontrada para impressão.', 404);

  const pdf = await buildLabelsSheetPdf(expanded as any[]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="etiquetas-em-lote.pdf"');
  return res.send(pdf);
});

router.get('/:id/pdf', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const label = await prisma.label.findFirst({ where: { id: req.params.id, restaurantId: req.user.restaurantId } });
  if (!label) return fail(res, 'Etiqueta não encontrada.', 404);

  const copies = Number(req.query.copies || 1);
  const pdf = await buildLabelPdf(label, Number.isFinite(copies) ? copies : 1);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="etiqueta-${label.id}.pdf"`);
  return res.send(pdf);
});

export default router;
