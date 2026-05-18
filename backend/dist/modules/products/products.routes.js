"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    category: zod_1.z.string().min(2),
    imageUrl: zod_1.z.string().optional().default(''),
    defaultMode: zod_1.z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']),
    keywords: zod_1.z.string().optional().default(''),
    validityValue: zod_1.z.number().int().positive(),
    validityUnit: zod_1.z.enum(['hours', 'days']).default('days'),
    ruleDescription: zod_1.z.string().optional().default('Regra personalizada do restaurante')
});
const updateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    category: zod_1.z.string().min(2).optional(),
    imageUrl: zod_1.z.string().nullable().optional(),
    defaultMode: zod_1.z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']).optional(),
    keywords: zod_1.z.string().optional()
});
function canUseProductWhere(productId, restaurantId) {
    return {
        id: productId,
        OR: [{ isGlobal: true }, { restaurantId }]
    };
}
router.get('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
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
    const products = await prisma_1.prisma.product.findMany({
        where,
        include: { validityRules: true },
        orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
        take: 200
    });
    return (0, http_1.ok)(res, products);
});
router.get('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const product = await prisma_1.prisma.product.findFirst({
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
    if (!product)
        return (0, http_1.fail)(res, 'Produto não encontrado.', 404);
    return (0, http_1.ok)(res, product);
});
router.post('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    const product = await prisma_1.prisma.product.create({
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
    return (0, http_1.ok)(res, product, 201);
});
router.patch('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    const existing = await prisma_1.prisma.product.findFirst({
        where: canUseProductWhere(req.params.id, req.user.restaurantId)
    });
    if (!existing)
        return (0, http_1.fail)(res, 'Produto não encontrado.', 404);
    // Para o MVP, permitimos ajustar foto e dados dos produtos acessíveis.
    // Em ambiente SaaS multiempresa, recomenda-se duplicar produto global por restaurante antes de editar.
    const product = await prisma_1.prisma.product.update({
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
    return (0, http_1.ok)(res, product);
});
exports.default = router;
