import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';
import { authMiddleware, requireRole } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

const validityRuleSchema = z.object({
  description: z.string().trim().min(2).max(240),
  validityValue: z.number().int().min(1).max(3650),
  validityUnit: z.enum(['days', 'hours']),
  source: z.string().trim().min(2).max(240),
});

const productSchema = z.object({
  name: z.string().min(2, 'Informe o nome do produto.'),
  category: z.string().min(2, 'Informe a categoria.'),
  imageUrl: z.string().optional().nullable(),
  defaultMode: z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']).default('REFRIGERADO'),
  keywords: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  active: z.boolean().optional(),
  validityRule: validityRuleSchema.optional().nullable(),
});

const updateProductSchema = productSchema.partial();

function clean(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const includeInactive = String(req.query.includeInactive || '') === '1';
  const search = String(req.query.search || '').trim();

  const products = await prisma.product.findMany({
    where: {
      AND: [
        {
          OR: [
            { restaurantId: req.user.restaurantId },
            { isGlobal: true },
          ],
        },
        includeInactive ? {} : { active: true },
        search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
                { keywords: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    include: {
      validityRules: true,
      _count: {
        select: {
          labels: {
            where: { restaurantId: req.user.restaurantId },
          },
        },
      },
    },
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  });

  return ok(res, products);
});

router.get('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const product = await prisma.product.findFirst({
    where: {
      id: String(req.params.id),
      OR: [
        { restaurantId: req.user.restaurantId },
        { isGlobal: true },
      ],
    },
    include: {
      validityRules: true,
      labels: {
        where: {
          restaurantId: req.user.restaurantId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 30,
      },
      _count: {
        select: {
          labels: {
            where: { restaurantId: req.user.restaurantId },
          },
        },
      },
    },
  });

  if (!product) return fail(res, 'Produto não encontrado.', 404);

  return ok(res, product);
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = productSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        restaurantId: req.user!.restaurantId,
        name: parsed.data.name.trim(),
        category: parsed.data.category.trim(),
        imageUrl: clean(parsed.data.imageUrl),
        defaultMode: parsed.data.defaultMode,
        keywords: parsed.data.keywords?.trim() || '',
        isGlobal: false,
        active: parsed.data.active ?? true,
      },
    });

    if (parsed.data.validityRule) {
      await tx.validityRule.create({
        data: {
          productId: created.id,
          category: created.category,
          description: parsed.data.validityRule.description,
          conservationMode: created.defaultMode,
          validityValue: parsed.data.validityRule.validityValue,
          validityUnit: parsed.data.validityRule.validityUnit,
          source: parsed.data.validityRule.source,
        },
      });
    }

    return tx.product.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        validityRules: true,
        _count: { select: { labels: true } },
      },
    });
  });

  return ok(res, product, 201);
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = updateProductSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const product = await prisma.product.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
  });

  if (!product) {
    return fail(res, 'Produto não encontrado ou não editável.', 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const savedProduct = await tx.product.update({
      where: { id: product.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category.trim() } : {}),
        ...(parsed.data.imageUrl !== undefined ? { imageUrl: clean(parsed.data.imageUrl) } : {}),
        ...(parsed.data.defaultMode !== undefined ? { defaultMode: parsed.data.defaultMode } : {}),
        ...(parsed.data.keywords !== undefined
          ? { keywords: parsed.data.keywords?.trim() || '' }
          : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      },
    });

    if (parsed.data.validityRule) {
      const existingRule = await tx.validityRule.findFirst({
        where: {
          productId: savedProduct.id,
          conservationMode: savedProduct.defaultMode,
        },
      });
      const ruleData = {
        category: savedProduct.category,
        description: parsed.data.validityRule.description,
        conservationMode: savedProduct.defaultMode,
        validityValue: parsed.data.validityRule.validityValue,
        validityUnit: parsed.data.validityRule.validityUnit,
        source: parsed.data.validityRule.source,
      };

      if (existingRule) {
        await tx.validityRule.update({
          where: { id: existingRule.id },
          data: ruleData,
        });
      } else {
        await tx.validityRule.create({
          data: { ...ruleData, productId: savedProduct.id },
        });
      }
    }

    return tx.product.findUniqueOrThrow({
      where: { id: savedProduct.id },
      include: {
        validityRules: true,
        _count: { select: { labels: true } },
      },
    });
  });

  return ok(res, updated);
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const product = await prisma.product.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
    },
    include: {
      _count: {
        select: {
          labels: true,
        },
      },
    },
  });

  if (!product) {
    return fail(res, 'Produto não encontrado ou não editável.', 404);
  }

  if (product._count.labels > 0) {
    const updated = await prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        active: false,
      },
      include: {
        validityRules: true,
        _count: {
          select: {
            labels: true,
          },
        },
      },
    });

    return ok(res, {
      removed: false,
      inactivated: true,
      message: 'Produto inativado para preservar o histórico de etiquetas.',
      product: updated,
    });
  }

  await prisma.product.delete({
    where: {
      id: product.id,
    },
  });

  return ok(res, {
    removed: true,
    inactivated: false,
    message: 'Produto removido definitivamente.',
  });
});

export default router;
