const assert = require('node:assert/strict');
const test = require('node:test');

const {
  generateBatchLabelsPdf,
  generateLabelPdf,
} = require('../dist/modules/labels/pdf.service.js');

const sample = {
  id: 'label-test',
  type: 'PRODUTO_ABERTO',
  productName: 'ARROZ COZIDO',
  conservationMode: 'REFRIGERADO',
  openedAt: new Date('2026-07-28T12:00:00.000Z'),
  expiresAt: new Date('2026-07-29T12:00:00.000Z'),
  responsibleName: 'Janaína',
  status: 'ATIVA',
};

test('PDF individual usa página térmica de 50 x 30 mm para Nimbot B21', async () => {
  const buffer = await generateLabelPdf(sample);
  const pdf = buffer.toString('latin1');

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.match(pdf, /\/MediaBox \[0 0 141\.732283 85\.03937\]/);
});

test('lote térmico cria uma página por etiqueta', async () => {
  const buffer = await generateBatchLabelsPdf([sample, { ...sample, id: 'label-2' }]);
  const pdf = buffer.toString('latin1');
  const pageMatches = pdf.match(/\/Type \/Page\b/g) || [];

  assert.equal(pageMatches.length, 2);
});
