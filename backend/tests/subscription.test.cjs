const assert = require('node:assert/strict');
const test = require('node:test');

const { subscriptionIsActive } = require('../dist/modules/subscription/subscription.middleware.js');

test('aceita teste, assinatura e carência dentro do prazo', () => {
  const future = new Date(Date.now() + 60_000);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'TRIALING', trialEndsAt: future }), true);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'ACTIVE', subscriptionEndsAt: future }), true);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'PAST_DUE', subscriptionEndsAt: future }), true);
});

test('bloqueia assinatura encerrada ou período vencido', () => {
  const past = new Date(Date.now() - 60_000);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'TRIALING', trialEndsAt: past }), false);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'PAST_DUE', subscriptionEndsAt: past }), false);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'CANCELED' }), false);
  assert.equal(subscriptionIsActive({ subscriptionStatus: 'PENDING' }), false);
});
