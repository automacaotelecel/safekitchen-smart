import { Prisma } from '@prisma/client';

import { prisma } from './prisma';

type AuditInput = {
  restaurantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        userId: input.userId || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error('Falha ao registrar auditoria:', error);
  }
}

