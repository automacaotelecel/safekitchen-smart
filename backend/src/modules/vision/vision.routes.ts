import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

const identifySchema = z.object({
  imageBase64: z.string().min(100, 'Imagem inválida ou muito pequena.'),
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

function cleanBase64(imageBase64: string) {
  return imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
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
    throw new Error('A IA não retornou um JSON válido.');
  }

  const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonText) as Partial<GeminiSuggestion>;

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
    notes: text(parsed.notes),
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
    if (productText.includes(term)) {
      score += 1;
    }
  }

  const productName = normalizeText(suggestion.productName);

  if (productName && productText.includes(productName)) {
    score += 6;
  }

  if (suggestion.brand && productText.includes(normalizeText(suggestion.brand))) {
    score += 2;
  }

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
          labels: true,
        },
      },
    },
    take: 400,
  });

  const ranked = products
    .map((product) => ({
      product,
      score: scoreProduct(product, suggestion),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score < 2) {
    return null;
  }

  return best.product;
}

async function askGemini(imageBase64: string, mimeType: string) {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY não configurada no .env do backend.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;

  const prompt = `
Você é uma IA de apoio para um sistema de etiquetas sanitárias de cozinha profissional chamado SafeKitchen Smart.

Analise a imagem do produto alimentício, embalagem, rótulo ou item de cozinha.

Retorne APENAS um JSON válido, sem markdown, sem comentários e sem explicação fora do JSON.

Campos obrigatórios:
{
  "productName": "nome provável do produto em português, em CAIXA ALTA",
  "brand": "marca provável se estiver visível, ou string vazia",
  "detectedBatch": "lote provável se estiver claramente visível, ou string vazia. Nunca invente lote.",
  "category": "categoria provável: Laticínios, Carnes e frios, Hortifruti, Panificação, Molhos e temperos, Enlatados e conservas, Bebidas, Produto químico, Grãos e secos, Outros",
  "conservationMode": "AMBIENTE ou REFRIGERADO ou CONGELADO",
  "labelType": "PRODUTO_ABERTO ou PRODUCAO ou DESCONGELAMENTO_DESSALGUE ou ARMAZENAMENTO_CARNES ou REEMBALAGEM ou AMOSTRAS ou NAO_CONFORME ou PRODUTO_QUIMICO",
  "keywords": "palavras úteis para busca no banco, separadas por espaço",
  "confidence": número entre 0 e 1,
  "notes": "observação curta orientando o usuário a conferir nome, marca, lote e validade"
}

Regras:
- Se for alimento industrializado aberto, use labelType PRODUTO_ABERTO.
- Se parecer produto químico de limpeza, detergente, sanitizante, desinfetante ou similar, use labelType PRODUTO_QUIMICO.
- Se parecer carne, peixe, frango ou suíno embalado/armazenado, use ARMAZENAMENTO_CARNES.
- Se não tiver certeza, use confidence baixo.
- Nunca invente lote, data de fabricação, validade ou informação que não esteja visível.
- Não gere etiqueta. Apenas sugira preenchimento.
`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType,
                data: cleanBase64(imageBase64),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 900,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao consultar IA de visão.');
  }

  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new Error('A IA não retornou conteúdo para a imagem.');
  }

  return safeJsonParse(responseText);
}

router.post('/identify-product', async (req, res) => {
  try {
    if (!req.user) return fail(res, 'Não autenticado.', 401);

    const parsed = identifySchema.safeParse(req.body);

    if (!parsed.success) {
      return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
    }

    const suggestion = await askGemini(parsed.data.imageBase64, parsed.data.mimeType);

    if (!suggestion.productName) {
      return fail(res, 'Não foi possível identificar o produto na imagem.', 422);
    }

    const matchedProduct = await findBestProductMatch(req.user.restaurantId, suggestion);

    return ok(res, {
      suggestion,
      matchedProduct,
      warning:
        'A identificação por câmera é uma sugestão automática. Confira os dados antes de salvar ou gerar etiqueta.',
    });
  } catch (error) {
    return fail(
      res,
      error instanceof Error ? error.message : 'Erro ao identificar produto pela câmera.',
      500
    );
  }
});

export default router;