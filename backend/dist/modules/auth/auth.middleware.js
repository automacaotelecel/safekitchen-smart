"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const http_1 = require("../../lib/http");
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    if (!header?.startsWith('Bearer ') && !queryToken)
        return (0, http_1.fail)(res, 'Token não enviado.', 401);
    const token = header?.startsWith('Bearer ') ? header.replace('Bearer ', '').trim() : queryToken;
    try {
        req.user = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        return next();
    }
    catch {
        return (0, http_1.fail)(res, 'Token inválido ou expirado.', 401);
    }
}
