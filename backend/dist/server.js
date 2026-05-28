"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const products_routes_1 = __importDefault(require("./modules/products/products.routes"));
const labels_routes_1 = __importDefault(require("./modules/labels/labels.routes"));
const employees_routes_1 = __importDefault(require("./modules/employees/employees.routes"));
const validity_routes_1 = __importDefault(require("./modules/validity/validity.routes"));
const vision_routes_1 = __importDefault(require("./modules/vision/vision.routes"));
const app = (0, express_1.default)();
function normalizeOrigin(origin) {
    return origin.trim().replace(/\/$/, '');
}
const frontendUrlsFromEnv = (env_1.env.frontendUrl || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://safekitchen.vercel.app',
    'https://safekitchensmart.com.br',
    'https://www.safekitchensmart.com.br',
    ...frontendUrlsFromEnv,
]
    .map(normalizeOrigin)
    .filter((origin, index, array) => origin && array.indexOf(origin) === index);
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }
        const normalizedOrigin = normalizeOrigin(origin);
        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
            return;
        }
        console.warn(`Origem não permitida pelo CORS: ${origin}`);
        callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
    ],
    optionsSuccessStatus: 204,
}));
app.options('*', (0, cors_1.default)());
app.use(express_1.default.json({ limit: '12mb' }));
app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        app: 'SafeKitchen Smart API',
        port: env_1.env.port,
        cors: allowedOrigins,
        visionEnabled: Boolean(env_1.env.geminiApiKey),
        geminiModel: env_1.env.geminiModel,
    });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/labels', labels_routes_1.default);
app.use('/api/employees', employees_routes_1.default);
app.use('/api/validity-rules', validity_routes_1.default);
app.use('/api/vision', vision_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({
        ok: false,
        message: 'Rota não encontrada.',
    });
});
app.listen(env_1.env.port, () => {
    console.log(`SafeKitchen Smart API rodando em http://localhost:${env_1.env.port}`);
    console.log('CORS liberado para:');
    allowedOrigins.forEach((origin) => console.log(`- ${origin}`));
    console.log(`IA Gemini: ${env_1.env.geminiApiKey ? 'configurada' : 'não configurada'}`);
    console.log(`Modelo Gemini: ${env_1.env.geminiModel}`);
});
