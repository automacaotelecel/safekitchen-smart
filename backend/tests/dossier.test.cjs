const assert = require('node:assert/strict');
const test = require('node:test');

const { generateComplianceDossier } = require('../dist/modules/reports/dossier.service.js');

test('gera dossiê PDF válido com dados mínimos', async () => {
  const now = new Date();
  const pdf = await generateComplianceDossier({
    restaurant: { name: 'Cozinha Teste', document: null, timezone: 'America/Sao_Paulo' },
    generatedBy: 'Administrador',
    from: new Date(now.getTime() - 86_400_000),
    to: now,
    labels: [],
    documents: [],
    temperatures: [],
    controls: [],
    audits: [],
  });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1_000);
});
