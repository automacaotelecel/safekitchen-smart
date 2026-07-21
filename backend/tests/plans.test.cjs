const assert = require('node:assert/strict');
const test = require('node:test');

const { getCommercialPlan, getCommercialPlans, planForAccess } = require('../dist/modules/billing/plans.js');

test('planos comerciais possuem preços e limites válidos', () => {
  const plans = getCommercialPlans();
  assert.equal(plans.length, 2);
  for (const plan of plans) {
    assert.ok(plan.setupAmountCents > 0);
    assert.ok(plan.amountCents > 0);
    assert.ok(plan.maxUsers > 0);
    assert.ok(plan.maxAiAnalysesPerMonth > 0);
  }
  assert.equal(getCommercialPlan('professional').code, 'PRO');
  assert.equal(getCommercialPlan('essential').code, 'START');
  assert.equal(planForAccess('TRIAL').code, 'PRO');
});
