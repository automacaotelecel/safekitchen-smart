"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const prisma_1 = require("../../lib/prisma");
const http_1 = require("../../lib/http");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', async (_req, res) => {
    const rules = await prisma_1.prisma.validityRule.findMany({
        orderBy: [{ category: 'asc' }, { description: 'asc' }],
        take: 500
    });
    return (0, http_1.ok)(res, rules);
});
exports.default = router;
