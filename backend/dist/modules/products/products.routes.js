"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const productSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Informe o nome do produto.'),
    category: zod_1.z.string().min(2, 'Informe a categoria.'),
    imageUrl: zod_1.z.string().optional().nullable(),
    defaultMode: zod_1.z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']).default('REFRIGERADO'),
    keywords: zod_1.z.string().optional().nullable(),
    isGlobal: zod_1.z.boolean().optional(),
    active: zod_1.z.boolean().optional(),
});
const updateProductSchema = productSchema.partial();
function clean(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
router.get('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const includeInactive = String(req.query.includeInactive || '') === '1';
    const search = String(req.query.search || '').trim();
    const products = await prisma_1.prisma.product.findMany({
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
                            { name: { contains: search } },
                            { category: { contains: search } },
                            { keywords: { contains: search } },
                        ],
                    }
                    : {},
            ],
        },
        include: {
            validityRules: true,
            _count: {
                select: {
                    labels: true,
                },
            },
        },
        orderBy: [
            { active: 'desc' },
            { name: 'asc' },
        ],
    });
    return (0, http_1.ok)(res, products);
});
router.get('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const product = await prisma_1.prisma.product.findFirst({
        where: {
            id: req.params.id,
            OR: [
                { restaurantId: req.user.restaurantId },
                { isGlobal: true },
            ],
        },
        include: {
            validityRules: true,
            labels: {
                orderBy: {
                    createdAt: 'desc',
                },
                take: 30,
            },
            _count: {
                select: {
                    labels: true,
                },
            },
        },
    });
    if (!product)
        return (0, http_1.fail)(res, 'Produto não encontrado.', 404);
    return (0, http_1.ok)(res, product);
});
router.post('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    }
    const product = await prisma_1.prisma.product.create({
        data: {
            restaurantId: req.user.restaurantId,
            name: parsed.data.name.trim(),
            category: parsed.data.category.trim(),
            imageUrl: clean(parsed.data.imageUrl),
            defaultMode: parsed.data.defaultMode,
            keywords: parsed.data.keywords?.trim() || '',
            isGlobal: false,
            active: parsed.data.active ?? true,
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
    return (0, http_1.ok)(res, product, 201);
});
router.patch('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    }
    const product = await prisma_1.prisma.product.findFirst({
        where: {
            id: req.params.id,
            restaurantId: req.user.restaurantId,
        },
    });
    if (!product) {
        return (0, http_1.fail)(res, 'Produto não encontrado ou não editável.', 404);
    }
    const updated = await prisma_1.prisma.product.update({
        where: {
            id: product.id,
        },
        data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
            ...(parsed.data.category !== undefined ? { category: parsed.data.category.trim() } : {}),
            ...(parsed.data.imageUrl !== undefined ? { imageUrl: clean(parsed.data.imageUrl) } : {}),
            ...(parsed.data.defaultMode !== undefined ? { defaultMode: parsed.data.defaultMode } : {}),
            ...(parsed.data.keywords !== undefined ? { keywords: parsed.data.keywords?.trim() || '' } : {}),
            ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
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
    return (0, http_1.ok)(res, updated);
});
router.delete('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const product = await prisma_1.prisma.product.findFirst({
        where: {
            id: req.params.id,
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
        return (0, http_1.fail)(res, 'Produto não encontrado ou não editável.', 404);
    }
    if (product._count.labels > 0) {
        const updated = await prisma_1.prisma.product.update({
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
        return (0, http_1.ok)(res, {
            removed: false,
            inactivated: true,
            message: 'Produto inativado para preservar o histórico de etiquetas.',
            product: updated,
        });
    }
    await prisma_1.prisma.product.delete({
        where: {
            id: product.id,
        },
    });
    return (0, http_1.ok)(res, {
        removed: true,
        inactivated: false,
        message: 'Produto removido definitivamente.',
    });
});
exports.default = router;
