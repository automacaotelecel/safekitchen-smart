import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordAudit } from '../../lib/audit';
import { fail, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../auth/auth.middleware';
import {
  checklistForJurisdiction,
  sourcesForJurisdiction,
} from '../regulatory/regulatory.knowledge';
import { requireActiveSubscription } from '../subscription/subscription.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireActiveSubscription);

const answerSchema = z.object({
  itemId: z.string(),
  result: z.enum(['CONFORM', 'NON_CONFORM', 'NOT_APPLICABLE']),
  notes: z.string().trim().max(1000).optional().nullable(),
  evidenceDocumentId: z.string().optional().nullable(),
  evidenceFileName: z.string().trim().max(220).optional().nullable(),
});

const auditSchema = z.object({
  title: z.string().trim().min(3).max(180),
  occurredAt: z.string().datetime(),
  responsibleName: z.string().trim().min(2).max(120),
  jurisdiction: z.enum(['BR', 'SP']).default('BR'),
  notes: z.string().trim().max(2000).optional().nullable(),
  answers: z.array(answerSchema).min(1),
});

router.get('/template', async (req, res) => {
  const jurisdiction = String(req.query.jurisdiction || 'BR') === 'SP' ? 'SP' : 'BR';
  const isSaoPaulo = jurisdiction === 'SP';

  return ok(res, {
    id: isSaoPaulo ? 'RDC216_SP_V2' : 'RDC216_V2',
    name: isSaoPaulo
      ? 'Checklist de auditoria - RDC 216 + legislação de São Paulo'
      : 'Checklist de auditoria - RDC Anvisa nº 216/2004',
    version: '2026-08-14',
    jurisdiction,
    disclaimer:
      'Ferramenta de apoio à auditoria interna. A avaliação deve ser validada pelo responsável técnico e considerar regras estaduais e municipais aplicáveis.',
    sources: sourcesForJurisdiction(jurisdiction),
    items: checklistForJurisdiction(jurisdiction),
  });
});

router.get('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const records = await prisma.complianceRecord.findMany({
    where: {
      restaurantId: req.user.restaurantId,
      type: 'AUDIT',
      status: 'ACTIVE',
    },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });

  return ok(res, records);
});

router.post('/', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const parsed = auditSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'Dados inválidos.', 422, parsed.error.flatten());
  }

  const checklist = checklistForJurisdiction(parsed.data.jurisdiction);
  const validIds = new Set(checklist.map((item) => item.id));
  const uniqueIds = new Set(parsed.data.answers.map((answer) => answer.itemId));

  if (
    uniqueIds.size !== parsed.data.answers.length ||
    parsed.data.answers.some((answer) => !validIds.has(answer.itemId))
  ) {
    return fail(res, 'O checklist contém itens inválidos ou duplicados.', 422);
  }

  const evidenceIds = parsed.data.answers
    .map((answer) => answer.evidenceDocumentId)
    .filter((id): id is string => Boolean(id));

  if (evidenceIds.length) {
    const documents = await prisma.document.findMany({
      where: {
        id: { in: evidenceIds },
        restaurantId: req.user.restaurantId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const allowedIds = new Set(documents.map((document) => document.id));

    if (evidenceIds.some((id) => !allowedIds.has(id))) {
      return fail(res, 'Uma ou mais evidências não pertencem a esta conta.', 422);
    }
  }

  const evaluated = parsed.data.answers.filter(
    (answer) => answer.result !== 'NOT_APPLICABLE'
  );
  const conform = evaluated.filter((answer) => answer.result === 'CONFORM').length;
  const nonConform = evaluated.filter(
    (answer) => answer.result === 'NON_CONFORM'
  ).length;
  const score = evaluated.length ? Math.round((conform / evaluated.length) * 100) : 0;

  const record = await prisma.complianceRecord.create({
    data: {
      restaurantId: req.user.restaurantId,
      createdById: req.user.userId,
      type: 'AUDIT',
      subject: parsed.data.title,
      occurredAt: new Date(parsed.data.occurredAt),
      responsibleName: parsed.data.responsibleName,
      notes: parsed.data.notes || null,
      data: {
        templateId:
          parsed.data.jurisdiction === 'SP' ? 'RDC216_SP_V2' : 'RDC216_V2',
        templateVersion: '2026-08-14',
        jurisdiction: parsed.data.jurisdiction,
        score,
        conform,
        nonConform,
        notApplicable: parsed.data.answers.length - evaluated.length,
        total: parsed.data.answers.length,
        sourceIds: sourcesForJurisdiction(parsed.data.jurisdiction).map(
          (source) => source.id
        ),
        answers: parsed.data.answers,
      } as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
    action: 'CREATE',
    entity: 'SanitaryAudit',
    entityId: record.id,
    metadata: {
      templateId:
        parsed.data.jurisdiction === 'SP' ? 'RDC216_SP_V2' : 'RDC216_V2',
      jurisdiction: parsed.data.jurisdiction,
      score,
      nonConform,
      evidenceCount: evidenceIds.length,
    },
  });

  return ok(res, record, 201);
});

router.delete('/:id', async (req, res) => {
  if (!req.user) return fail(res, 'Não autenticado.', 401);

  const existing = await prisma.complianceRecord.findFirst({
    where: {
      id: String(req.params.id),
      restaurantId: req.user.restaurantId,
      type: 'AUDIT',
    },
  });

  if (!existing) return fail(res, 'Auditoria não encontrada.', 404);

  await prisma.complianceRecord.update({
    where: { id: existing.id },
    data: { status: 'ARCHIVED' },
  });

  return ok(res, { archived: true });
});

export default router;
