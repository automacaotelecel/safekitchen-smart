import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

const identifySchema = z.object({
  imageBase64: z
    .string()
    .min(100, 'Imagem inválida ou muito pequena.')
    .max(Math.ceil(env.maxImageBytes * 1.5), 'Imagem maior que o limite permitido.'),
  mimeType: z.string().optional().default('image/jpeg'),
});

type GeminiSuggestion = {
  productName: string;
  brand: string;
  detectedBatch: string;
  category: string;
  conservationMode: 'AMBIENTE' | 'REFRIGERADO' | 'CONGELADO';
  labelType:
    | 'PRODUTO_ABERTO'
    | 'PRODUCAO'
    | 'DESCONGELAMENTO_DESSALGUE'
    | 'ARMAZENAMENTO_CARNES'
    | 'REEMBALAGEM'
    | 'AMOSTRAS'
    | 'NAO_CONFORME'
    | 'PRODUTO_QUIMICO';
  keywords: string;
  confidence: number;
  notes: string;
};

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

function normalizeMimeType(mimeType: string) {
  const value = String(mimeType || 'image/jpeg').toLowerCase().trim();

  if (!allowedMimeTypes.has(value)) {
    throw new ProviderError(
      'Formato de imagem não suportado. Use JPEG, PNG ou WebP.',
      422,
      'UNSUPPORTED_IMAGE'
    );
  }

  return value === 'image/jpg' ? 'image/jpeg' : value;
}

function cleanBase64(imageBase64: string) {
  const cleaned = imageBase64
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .replace(/\s/g, '')
    .trim();

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new ProviderError('Conteúdo da imagem inválido.', 422, 'INVALID_IMAGE');
  }

  const bytes = Buffer.byteLength(cleaned, 'base64');

  if (bytes > env.maxImageBytes) {
    throw new ProviderError(
      `Imagem maior que o limite de ${Math.round(env.maxImageBytes / 1024 / 1024)} MB.`,
      413,
      'IMAGE_TOO_LARGE'
    );
  }

  return cleaned;
}

function text(value: unknown) {
  return String(value || '').trim();
}

function safeJsonParse(rawText: string): GeminiSuggestion {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new ProviderError(
      'A IA não retornou dados estruturados. Tente outra foto.',
      502,
      'INVALID_PROVIDER_RESPONSE'
    );
  }

  let parsed: Partial<GeminiSuggestion>;

  try {
    parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Partial<GeminiSuggestion>;
  } catch {
    throw new ProviderError(
      'A IA respondeu em formato inválido. Tente outra foto.',
      502,
      'INVALID_PROVIDER_JSON'
    );
  }

  const conservationMode =
    parsed.conservationMode === 'AMBIENTE' ||
    parsed.conservationMode === 'REFRIGERADO' ||
    parsed.conservationMode === 'CONGELADO'
      ? parsed.conservationMode
      : 'REFRIGERADO';

  const labelType =
    parsed.labelType === 'PRODUCAO' ||
    parsed.labelType === 'DESCONGELAMENTO_DESSALGUE' ||
    parsed.labelType === 'ARMAZENAMENTO_CARNES' ||
    parsed.labelType === 'REEMBALAGEM' ||
    parsed.labelType === 'AMOSTRAS' ||
    parsed.labelType === 'NAO_CONFORME' ||
    parsed.labelType === 'PRODUTO_QUIMICO'
      ? parsed.labelType
      : 'PRODUTO_ABERTO';

  const confidence =
    typeof parsed.confidence === 'number'
      ? Math.min(Math.max(parsed.confidence, 0), 1)
      : 0.45;

  return {
    productName: text(parsed.productName).toUpperCase(),
    brand: text(parsed.brand),
    detectedBatch: text(parsed.detectedBatch),
    category: text(parsed.category) || 'Outros',
    conservationMode,
    labelType,
    keywords: text(parsed.keywords),
    confidence,
    notes:
      text(parsed.notes) ||
      'Confira nome, marca, lote e validade antes de salvar. A IA é apenas apoio operacional.',
  };
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function scoreProduct(
  product: { name: string; category: string; keywords: string },
  suggestion: GeminiSuggestion
) {
  const productText = normalizeText(`${product.name} ${product.category} ${product.keywords}`);
  const aiText = normalizeText(
    `${suggestion.productName} ${suggestion.brand} ${suggestion.category} ${suggestion.keywords}`
  );

  let score = 0;
  const terms = Array.from(new Set(aiText.split(/\s+/).filter((term) => term.length >= 3)));

  for (const term of terms) {
    if (productText.includes(term)) score += 1;
  }

  const productName = normalizeText(suggestion.productName);
  if (productName && productText.includes(productName)) score += 6;
  if (suggestion.brand && productText.includes(normalizeText(suggestion.brand))) score += 2;

  return score;
}

async function findBestProductMatch(restaurantId: string, suggestion: GeminiSuggestion) {
  const products = await prisma.product.findMany({
    where: {
      OR: [{ isGlobal: true }, { restaurantId }],
      active: true,
    },
    include: {
      validityRules: true,
      _count: {
        select: {
          labels: {
            where: { restaurantId },
          },
        },
      },
    },
    take: 400,
  });

  const ranked = products
    .map((product) => ({ product, score: scoreProduct(product, suggestion) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return !best || best.score < 2 ? null : best.product;
}

function buildGeminiRequestBody(imageBase64: string, mimeType: string) {
  const prompt = `
Você é uma IA de apoio para o SafeKitchen Smart, um sistema de segurança dos alimentos.
Leia a embalagem ou o rótulo visível na foto e sugira os dados para uma etiqueta sanitária.

Regras:
- Nunca invente lote, data, marca ou validade.
- Se não conseguir ler um campo, devolva string vazia.
- Se for alimento industrializado aberto, use PRODUTO_ABERTO.
- Se for produto de limpeza, use PRODUTO_QUIMICO.
- Se for carne, peixe, frango ou suíno armazenado, use ARMAZENAMENTO_CARNES.
- Confiança baixa quando a foto estiver ruim ou ambígua.
- Responda somente com o objeto solicitado.
`;

  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: [
          'productName',
          'brand',
          'detectedBatch',
          'category',
          'conservationMode',
          'labelType',
          'keywords',
          'confidence',
          'notes',
        ],
        properties: {
          productName: { type: 'STRING' },
          brand: { type: 'STRING' },
          detectedBatch: { type: 'STRING' },
          category: { type: 'STRING' },
          conservationMode: {
            type: 'STRING',
            enum: ['AMBIENTE', 'REFRIGERADO', 'CONGELADO'],
          },
          labelType: {
            type: 'STRING',
            enum: [
              'PRODUTO_ABERTO',
              'PRODUCAO',
              'DESCONGELAMENTO_DESSALGUE',
              'ARMAZENAMENTO_CARNES',
              'REEMBALAGEM',
              'AMOSTRAS',
              'NAO_CONFORME',
              'PRODUTO_QUIMICO',
            ],
          },
          keywords: { type: 'STRING' },
          confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
          notes: { type: 'STRING' },
        },
      },
    },
  };
}

async function askModel(
  model: string,
  imageBase64: string,
  mimeType: string
): Promise<{ suggestion: GeminiSuggestion; usage: GeminiUsage }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiTimeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let response: Response | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.geminiApiKey,
        },
        body: JSON.stringify(buildGeminiRequestBody(imageBase64, mimeType)),
        signal: controller.signal,
      });

      if (response.status !== 429 && response.status < 500) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
    }

    if (!response) {
      throw new ProviderError('A IA não respondeu.', 503, 'NO_RESPONSE');
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage =
        data?.error?.message || data?.error?.status || `HTTP ${response.status}`;

      throw new ProviderError(
        `Falha no serviço de IA: ${providerMessage}`,
        response.status === 429 ? 429 : 503,
        String(data?.error?.status || response.status)
      );
    }

    const responseText = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('\n')
      .trim();

    if (!responseText) {
      throw new ProviderError(
        'A IA não conseguiu ler essa imagem. Tente uma foto mais nítida.',
        422,
        'EMPTY_RESPONSE'
      );
    }

    return {
      suggestion: safeJsonParse(responseText),
      usage: data?.usageMetadata || {},
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError(
        'A análise demorou demais. Tente novamente.',
        504,
        'TIMEOUT'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function askGemini(imageBase64: string, mimeType: string) {
  if (!env.geminiApiKey) {
    throw new ProviderError(
      'IA não configurada no servidor. Configure GEMINI_API_KEY e faça um novo deploy.',
      503,
      'NOT_CONFIGURED'
    );
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  const cleanImage = cleanBase64(imageBase64);
  const models = Array.from(
    new Set([env.geminiModel, ...env.geminiFallbackModels])
  );

  let lastError: unknown;

  for (const model of models) {
    try {
      const result = await askModel(model, cleanImage, normalizedMimeType);
      return { ...result, model };
    } catch (error) {
      lastError = error;

      if (
        error instanceof ProviderError &&
        !['404', 'NOT_FOUND', 'INVALID_ARGUMENT'].includes(error.code)
      ) {
        throw error;
      }
    }
  }

  throw lastError || new ProviderError('Nenhum modelo de IA disponível.', 503, 'NO_MODEL');
}

router.get('/health', (_req, res) => {
  return ok(res, {
    enabled: Boolean(env.geminiApiKey),
    model: env.geminiModel,
    message: env.geminiApiKey
      ? 'IA configurada e pronta para teste.'
      : 'GEMINI_API_KEY não configurada no servidor.',
  });
});

router.post('/identify-product', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = identifySchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  try {
    const ai = await askGemini(parsed.data.imageBase64, parsed.data.mimeType);

    if (!ai.suggestion.productName) {
      throw new ProviderError(
        'Não foi possível identificar o produto. Fotografe o rótulo mais de perto.',
        422,
        'PRODUCT_NOT_FOUND'
      );
    }

    const matchedProduct = await findBestProductMatch(
      req.user.restaurantId,
      ai.suggestion
    );

    await prisma.aiUsage.create({
      data: {
        restaurantId: req.user.restaurantId,
        userId: req.user.userId,
        feature: 'PRODUCT_VISION',
        model: ai.model,
        success: true,
        inputTokens: ai.usage.promptTokenCount,
        outputTokens: ai.usage.candidatesTokenCount,
      },
    });

    return ok(res, {
      suggestion: ai.suggestion,
      matchedProduct,
      warning:
        'A identificação por câmera é uma sugestão automática. Confira os dados antes de salvar ou gerar etiqueta.',
    });
  } catch (error) {
    const providerError =
      error instanceof ProviderError
        ? error
        : new ProviderError('Erro ao identificar produto pela câmera.', 500, 'INTERNAL');

    await prisma.aiUsage
      .create({
        data: {
          restaurantId: req.user.restaurantId,
          userId: req.user.userId,
          feature: 'PRODUCT_VISION',
          model: env.geminiModel,
          success: false,
          errorCode: providerError.code.slice(0, 100),
        },
      })
      .catch(() => undefined);

    return fail(res, providerError.message, providerError.status);
  }
});

export default router;
