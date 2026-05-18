"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const env_1 = require("../../config/env");
const auth_middleware_1 = require("./auth.middleware");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    restaurantName: zod_1.z.string().min(2),
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    const { restaurantName, name, email, password } = parsed.data;
    const exists = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (exists)
        return (0, http_1.fail)(res, 'Este e-mail já está cadastrado.', 409);
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const restaurant = await prisma_1.prisma.restaurant.create({
        data: {
            name: restaurantName,
            users: { create: { name, email, passwordHash, role: 'ADMIN' } },
            employees: { create: { name, active: true } }
        },
        include: { users: true }
    });
    const user = restaurant.users[0];
    const token = jsonwebtoken_1.default.sign({ userId: user.id, restaurantId: restaurant.id, role: user.role, name: user.name, email: user.email }, env_1.env.jwtSecret, { expiresIn: '7d' });
    return (0, http_1.ok)(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant }, 201);
});
router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, http_1.fail)(res, 'Dados inválidos.', 422, parsed.error.flatten());
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: parsed.data.email },
        include: { restaurant: true }
    });
    if (!user)
        return (0, http_1.fail)(res, 'E-mail ou senha inválidos.', 401);
    const valid = await bcryptjs_1.default.compare(parsed.data.password, user.passwordHash);
    if (!valid)
        return (0, http_1.fail)(res, 'E-mail ou senha inválidos.', 401);
    const token = jsonwebtoken_1.default.sign({ userId: user.id, restaurantId: user.restaurantId, role: user.role, name: user.name, email: user.email }, env_1.env.jwtSecret, { expiresIn: '7d' });
    return (0, http_1.ok)(res, {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        restaurant: user.restaurant
    });
});
router.get('/me', auth_middleware_1.authMiddleware, async (req, res) => {
    if (!req.user)
        return (0, http_1.fail)(res, 'Não autenticado.', 401);
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { restaurant: true }
    });
    if (!user)
        return (0, http_1.fail)(res, 'Usuário não encontrado.', 404);
    return (0, http_1.ok)(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant: user.restaurant });
});
exports.default = router;
