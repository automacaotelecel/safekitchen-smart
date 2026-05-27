"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const date_fns_1 = require("date-fns");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
const labelSchema = zod_1.z.object({
    type: zod_1.z.string().min(2),
    productId: zod_1.z.string().optional().nullable(),
    employeeId: zod_1.z.string().optional().nullable(),
    productName: zod_1.z.string().min(2, 'Informe o produto.'),
    brand: zod_1.z.string().optional().nullable(),
    supplier: zod_1.z.string().optional().nullable(),
    batch: zod_1.z.string().optional().nullable(),
    conservationMode: zod_1.z.enum(['AMBIENTE', 'REFRIGERADO', 'CONGELADO']).default('REFRIGERADO'),
    openedAt: zod_1.z.string().min(1),
    responsibleName: zod_1.z.string().min(2, 'Informe o responsável.'),
    quantity: zod_1.z.string().optional().nullable(),
    observations: zod_1.z.string().optional().nullable(),
    manualValidityValue: zod_1.z.number().optional().nullable(),
    manualValidityUnit: zod_1.z.enum(['days', 'hours']).optional().nullable(),
    extraData: zod_1.z.record(zod_1.z.any()).optional().nullable(),
});
function parseDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return new Date();
    }
    return date;
}
function normalizeText(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
async function calculateExpiration(input) {
    if (input.type === 'NAO_CONFORME')
        return null;
    if (input.type === 'AMOSTRAS') {
        return (0, date_fns_1.addHours)(input.openedAt, 72);
    }
    if (input.manualValidityValue && input.manualValidityValue > 0) {
        return input.manualValidityUnit === 'hours'
            ? (0, date_fns_1.addHours)(input.openedAt, input.manualValidityValue)
            : (0, date_fns_1.addDays)(input.openedAt, input.manualValidityValue);
    }
    if (input.productId) {
        const rule = await prisma_1.prisma.validityRule.findFirst({
            where: {
                productId: input.productId,
                conservationMode: input.conservationMode,
            },
        });
        if (rule) {
            return rule.validityUnit === 'hours'
                ? (0, date_fns_1.addHours)(input.openedAt, rule.validityValue)
                : (0, date_fns_1.addDays)(input.openedAt, rule.validityValue);
        }
    }
    return (0, date_fns_1.addDays)(input.openedAt, 3);
}
router.use((req, res, next) => {
    const token = req.query.token;
    if (token && typeof token === 'string') {
        req.headers.authorization = `Bearer ${token}`;
    }
    next();
});
router.use(auth_middleware_1.authMiddleware);
router.get('/dashboard', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const labels = await prisma_1.prisma.label.findMany({
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
    const expired = labels.filter((label) => label.expiresAt && label.expiresAt.getTime() < now.getTime()).length;
    const active = labels.filter((label) => !label.expiresAt || label.expiresAt.getTime() >= now.getTime()).length;
    const expiringSoon = labels.filter((label) => {
        if (!label.expiresAt)
            return false;
        const diffHours = (label.expiresAt.getTime() - now.getTime()) / 1000 / 60 / 60;
        return diffHours >= 0 && diffHours <= 24;
    }).length;
    const noExpiration = labels.filter((label) => !label.expiresAt).length;
    return (0, http_1.ok)(res, {
        total,
        active,
        expired,
        expiringSoon,
        noExpiration,
        recent: labels.slice(0, 5),
    });
});
router.get('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const includeCanceled = String(req.query.includeCanceled || '') === '1';
    const limit = Number(req.query.limit || 100);
    const labels = await prisma_1.prisma.label.findMany({
        where: {
            restaurantId: req.user.restaurantId,
            ...(includeCanceled ? {} : { status: { not: 'CANCELADA' } }),
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 300) : 100,
    });
    return (0, http_1.ok)(res, labels);
});
router.post('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = labelSchema.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
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
    const label = await prisma_1.prisma.label.create({
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
    return (0, http_1.ok)(res, label, 201);
});
router.get('/:id/pdf', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const { generateLabelPdf } = await Promise.resolve().then(() => __importStar(require('./pdf.service')));
    const label = await prisma_1.prisma.label.findFirst({
        where: {
            id: req.params.id,
            restaurantId: req.user.restaurantId,
        },
    });
    if (!label)
        return (0, http_1.fail)(res, 'Etiqueta não encontrada.', 404);
    const buffer = await generateLabelPdf(label);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-${label.id}.pdf"`);
    return res.send(buffer);
});
router.post('/batch-pdf', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const schema = zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            copies: zod_1.z.number().min(1).max(30).default(1),
        })).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    }
    const { generateBatchLabelsPdf } = await Promise.resolve().then(() => __importStar(require('./pdf.service')));
    const ids = parsed.data.items.map((item) => item.id);
    const labels = await prisma_1.prisma.label.findMany({
        where: {
            id: {
                in: ids,
            },
            restaurantId: req.user.restaurantId,
        },
    });
    const expandedLabels = parsed.data.items.flatMap((item) => {
        const label = labels.find((current) => current.id === item.id);
        if (!label)
            return [];
        return Array.from({ length: item.copies }, () => label);
    });
    if (!expandedLabels.length) {
        return (0, http_1.fail)(res, 'Nenhuma etiqueta encontrada.', 404);
    }
    const buffer = await generateBatchLabelsPdf(expandedLabels);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="etiquetas-lote.pdf"`);
    return res.send(buffer);
});
router.patch('/:id/cancel', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const label = await prisma_1.prisma.label.findFirst({
        where: {
            id: req.params.id,
            restaurantId: req.user.restaurantId,
        },
    });
    if (!label)
        return (0, http_1.fail)(res, 'Etiqueta não encontrada.', 404);
    const updated = await prisma_1.prisma.label.update({
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
    return (0, http_1.ok)(res, updated);
});
router.delete('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const permanent = String(req.query.permanent || '') === '1';
    const label = await prisma_1.prisma.label.findFirst({
        where: {
            id: req.params.id,
            restaurantId: req.user.restaurantId,
        },
    });
    if (!label)
        return (0, http_1.fail)(res, 'Etiqueta não encontrada.', 404);
    if (permanent) {
        await prisma_1.prisma.label.delete({
            where: {
                id: label.id,
            },
        });
        return (0, http_1.ok)(res, {
            deleted: true,
            canceled: false,
            message: 'Etiqueta excluída definitivamente.',
        });
    }
    const updated = await prisma_1.prisma.label.update({
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
    return (0, http_1.ok)(res, {
        deleted: false,
        canceled: true,
        message: 'Etiqueta cancelada e removida da lista principal.',
        label: updated,
    });
});
exports.default = router;
