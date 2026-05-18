"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const date_fns_1 = require("date-fns");
const zod_1 = require("zod");
const auth_middleware_1 = require("../auth/auth.middleware");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const pdf_service_1 = require("./pdf.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const createLabelSchema = zod_1.z.object({
    type: zod_1.z.enum(['PRODUTO_ABERTO', 'PRODUCAO', 'DESCONGELAMENTO_DESSALGUE', 'ARMAZENAMENTO_CARNES', 'REEMBALAGEM', 'AMOSTRAS', 'NAO_CONFORME', 'PRODUTO_QUIMICO']),
    productId: zod_1.z.string().optional().nullable(),
    productName: zod_1.z.string().min(2),
    brand: zod_1.z.string().optional().nullable(),
    supplier: zod_1.z.string().optional().nullable(),
    batch: zod_1.z.string().optional().nullable(),
    conservationMode: zod_1.z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']),
    openedAt: zod_1.z.string().min(10),
    employeeId: zod_1.z.string().optional().nullable(),
    responsibleName: zod_1.z.string().min(2),
    quantity: zod_1.z.string().optional().nullable(),
    observations: zod_1.z.string().optional().nullable(),
    manualValidityValue: zod_1.z.number().int().positive().optional().nullable(),
    manualValidityUnit: zod_1.z.enum(['hours', 'days']).optional().nullable()
});
const batchPdfSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        copies: zod_1.z.number().int().min(1).max(30).default(1)
    })).min(1).max(120)
});
async function calculateExpiration(input) {
    const openedAt = new Date(input.openedAt);
    if (input.type === 'NAO_CONFORME')
        return null;
    if (input.manualValidityValue && input.manualValidityUnit) {
        return input.manualValidityUnit === 'hours'
            ? (0, date_fns_1.addHours)(openedAt, input.manualValidityValue)
            : (0, date_fns_1.addDays)(openedAt, input.manualValidityValue);
    }
    const productRule = input.productId
        ? await prisma_1.prisma.validityRule.findFirst({
            where: { productId: input.productId, conservationMode: input.conservationMode },
            orderBy: { createdAt: 'asc' }
        })
        : null;
    const fallbackRule = productRule || await prisma_1.prisma.validityRule.findFirst({
        where: {
            conservationMode: input.conservationMode,
            OR: [
                { description: { contains: input.productName } },
                { category: { contains: input.productName } }
            ]
        },
        orderBy: { createdAt: 'asc' }
    });
    if (!fallbackRule)
        return null;
    return fallbackRule.validityUnit === 'hours'
        ? (0, date_fns_1.addHours)(openedAt, fallbackRule.validityValue)
        : (0, date_fns_1.addDays)(openedAt, fallbackRule.validityValue);
}
router.get('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const labels = await prisma_1.prisma.label.findMany({
        where: { restaurantId: req.user.restaurantId },
        include: { product: true, employee: true },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
    return (0, http_1.ok)(res, labels);
});
router.get('/dashboard', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const today = new Date();
    const labels = await prisma_1.prisma.label.findMany({
        where: { restaurantId: req.user.restaurantId },
        orderBy: { createdAt: 'desc' }
    });
    const total = labels.length;
    const expired = labels.filter((l) => l.expiresAt && l.expiresAt < today).length;
    const noExpiration = labels.filter((l) => !l.expiresAt).length;
    const recent = labels.slice(0, 5);
    return (0, http_1.ok)(res, { total, expired, active: total - expired, noExpiration, recent });
});
router.post('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    const expiresAt = await calculateExpiration(parsed.data);
    const label = await prisma_1.prisma.label.create({
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
            observations: parsed.data.observations || null
        }
    });
    return (0, http_1.ok)(res, label, 201);
});
router.post('/batch-pdf', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = batchPdfSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    const ids = parsed.data.items.map((item) => item.id);
    const labels = await prisma_1.prisma.label.findMany({
        where: {
            restaurantId: req.user.restaurantId,
            id: { in: ids }
        }
    });
    const labelById = new Map(labels.map((label) => [label.id, label]));
    const expanded = parsed.data.items.flatMap((item) => {
        const label = labelById.get(item.id);
        if (!label)
            return [];
        return Array.from({ length: item.copies }, () => label);
    });
    if (expanded.length === 0)
        return (0, http_1.fail)(res, 'Nenhuma etiqueta encontrada para impressão.', 404);
    const pdf = await (0, pdf_service_1.buildLabelsSheetPdf)(expanded);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="etiquetas-em-lote.pdf"');
    return res.send(pdf);
});
router.get('/:id/pdf', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const label = await prisma_1.prisma.label.findFirst({ where: { id: req.params.id, restaurantId: req.user.restaurantId } });
    if (!label)
        return (0, http_1.fail)(res, 'Etiqueta não encontrada.', 404);
    const copies = Number(req.query.copies || 1);
    const pdf = await (0, pdf_service_1.buildLabelPdf)(label, Number.isFinite(copies) ? copies : 1);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-${label.id}.pdf"`);
    return res.send(pdf);
});
exports.default = router;
