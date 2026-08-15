const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SAMPLE_RETENTION_HOURS,
  calculateSampleExpiration,
} = require('../dist/modules/labels/label-policy.js');

test('amostras permanecem por 96 horas a partir da coleta', () => {
  const collectedAt = new Date('2026-08-14T15:30:00.000Z');
  const expiresAt = calculateSampleExpiration(collectedAt);

  assert.equal(SAMPLE_RETENTION_HOURS, 96);
  assert.equal(
    expiresAt.getTime() - collectedAt.getTime(),
    96 * 60 * 60 * 1000
  );
});
