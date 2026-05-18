import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { fail, ok } from '../../lib/http';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();
router.use(authMiddleware);

const createProductSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  imageUrl: z.string().optional().default(''),
  defaultMode: z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']),
  keywords: z.string().optional().default(''),
  validityValue: z.number().int().positive(),
  validityUnit: z.enum(['hours', 'days']).default('days'),
  ruleDescription: z.string().optional().default('Regra personalizada do restaurante')
});

const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  imageUrl: z.string().nullable().optional(),
  defaultMode: z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']).optional(),
  keywords: z.string().optional()
});

function canUseProductWhere(productId: string, restaurantId: string) {
  return {
    id: productId,
    OR: [{ isGlobal: true }, { restaurantId }]
  };
}

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const search = String(req.query.search || '').trim();
  const where = {
    OR: [{ isGlobal: true }, { restaurantId: req.user.restaurantId }],
    ...(search
      ? {
          AND: [
            {
              OR: [
                { name: { contains: search } },
                { category: { contains: search } },
                { keywords: { contains: search } }
              ]
            }
          ]
        }
      : {})
  };

  const products = await prisma.product.findMany({
    where,
    include: { validityRules: true },
    orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
    take: 200
  });
  return ok(res, products);
});

router.get('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const product = await prisma.product.findFirst({
    where: canUseProductWhere(req.params.id, req.user.restaurantId),
    include: {
      validityRules: true,
      labels: {
        where: { restaurantId: req.user.restaurantId },
        orderBy: { createdAt: 'desc' },
        take: 100
      }
    }
  });

  if (!product) return fail(res, 'Produto não encontrado.', 404);

  return ok(res, product);
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const product = await prisma.product.create({
    data: {
      restaurantId: req.user.restaurantId,
      name: parsed.data.name.toUpperCase(),
      category: parsed.data.category,
      imageUrl: parsed.data.imageUrl || null,
      defaultMode: parsed.data.defaultMode,
      keywords: parsed.data.keywords,
      isGlobal: false,
      validityRules: {
        create: {
          category: parsed.data.category,
          description: parsed.data.ruleDescription,
          conservationMode: parsed.data.defaultMode,
          validityValue: parsed.data.validityValue,
          validityUnit: parsed.data.validityUnit,
          source: 'Cadastro personalizado do restaurante'
        }
      }
    },
    include: { validityRules: true }
  });

  return ok(res, product, 201);
});

router.patch('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());

  const existing = await prisma.product.findFirst({
    where: canUseProductWhere(req.params.id, req.user.restaurantId)
  });

  if (!existing) return fail(res, 'Produto não encontrado.', 404);

  // Para o MVP, permitimos ajustar foto e dados dos produtos acessíveis.
  // Em ambiente SaaS multiempresa, recomenda-se duplicar produto global por restaurante antes de editar.
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.toUpperCase() } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl || null } : {}),
      ...(parsed.data.defaultMode !== undefined ? { defaultMode: parsed.data.defaultMode } : {}),
      ...(parsed.data.keywords !== undefined ? { keywords: parsed.data.keywords } : {})
    },
    include: { validityRules: true }
  });

  return ok(res, product);
});

export default router;
