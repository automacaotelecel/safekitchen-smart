import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { requireActiveSubscription } from '../subscription/subscription.middleware';
import { prisma } from '../../lib/prisma';
import { ok } from '../../lib/http';

const router = Router();
router.use(authMiddleware);
router.use(requireActiveSubscription);

router.get('/', async (_req, res) => {
  const rules = await prisma.validityRule.findMany({
    orderBy: [{ category: 'asc' }, { description: 'asc' }],
    take: 500
  });
  return ok(res, rules);
});

export default router;
