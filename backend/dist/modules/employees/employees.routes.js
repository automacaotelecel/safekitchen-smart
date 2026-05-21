"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
const createEmployeeSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Informe o nome do funcionário.'),
    role: zod_1.z.string().optional().nullable(),
    shift: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email('E-mail inválido.').optional().or(zod_1.z.literal('')).nullable(),
    active: zod_1.z.boolean().optional(),
});
const updateEmployeeSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Informe o nome do funcionário.').optional(),
    role: zod_1.z.string().optional().nullable(),
    shift: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email('E-mail inválido.').optional().or(zod_1.z.literal('')).nullable(),
    active: zod_1.z.boolean().optional(),
});
router.get('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const employees = await prisma_1.prisma.employee.findMany({
        where: {
            restaurantId: req.user.restaurantId,
        },
        orderBy: [
            {
                active: 'desc',
            },
            {
                name: 'asc',
            },
        ],
    });
    return (0, http_1.ok)(res, employees);
});
router.post('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = createEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    }
    const employee = await prisma_1.prisma.employee.create({
        data: {
            restaurantId: req.user.restaurantId,
            name: parsed.data.name.trim(),
            role: parsed.data.role?.trim() || null,
            shift: parsed.data.shift?.trim() || null,
            phone: parsed.data.phone?.trim() || null,
            email: parsed.data.email?.trim() || null,
            active: parsed.data.active ?? true,
        },
    });
    return (0, http_1.ok)(res, employee, 201);
});
router.patch('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    }
    const employee = await prisma_1.prisma.employee.findFirst({
        where: {
            id: req.params.id,
            restaurantId: req.user.restaurantId,
        },
    });
    if (!employee) {
        return (0, http_1.fail)(res, 'Funcionário não encontrado.', 404);
    }
    const updated = await prisma_1.prisma.employee.update({
        where: {
            id: employee.id,
        },
        data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
            ...(parsed.data.role !== undefined ? { role: parsed.data.role?.trim() || null } : {}),
            ...(parsed.data.shift !== undefined ? { shift: parsed.data.shift?.trim() || null } : {}),
            ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone?.trim() || null } : {}),
            ...(parsed.data.email !== undefined ? { email: parsed.data.email?.trim() || null } : {}),
            ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        },
    });
    return (0, http_1.ok)(res, updated);
});
router.delete('/:id', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const employee = await prisma_1.prisma.employee.findFirst({
        where: {
            id: req.params.id,
            restaurantId: req.user.restaurantId,
        },
    });
    if (!employee) {
        return (0, http_1.fail)(res, 'Funcionário não encontrado.', 404);
    }
    const updated = await prisma_1.prisma.employee.update({
        where: {
            id: employee.id,
        },
        data: {
            active: false,
        },
    });
    return (0, http_1.ok)(res, {
        deleted: true,
        employee: updated,
    });
});
exports.default = router;
