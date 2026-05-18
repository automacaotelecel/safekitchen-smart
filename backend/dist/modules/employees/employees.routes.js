"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../auth/auth.middleware");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const employees = await prisma_1.prisma.employee.findMany({
        where: { restaurantId: req.user.restaurantId },
        orderBy: { name: 'asc' }
    });
    return (0, http_1.ok)(res, employees);
});
router.post('/', async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const schema = zod_1.z.object({ name: zod_1.z.string().min(2) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Nome inválido.', 422, parsed.error.flatten());
    const employee = await prisma_1.prisma.employee.create({
        data: { restaurantId: req.user.restaurantId, name: parsed.data.name }
    });
    return (0, http_1.ok)(res, employee, 201);
});
exports.default = router;
