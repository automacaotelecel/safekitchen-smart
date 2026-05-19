"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    port: Number(process.env.PORT || 3333),
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
};
