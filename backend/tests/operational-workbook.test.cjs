const assert = require('node:assert/strict');
const test = require('node:test');

const { strFromU8, unzipSync } = require('fflate');

const {
  generateOperationalWorkbook,
} = require('../dist/modules/reports/operational-workbook.service.js');

test('gera planilha de recebimento com as colunas do modelo aprovado', async () => {
  const buffer = await generateOperationalWorkbook({
    kind: 'RECEIVING',
    restaurantName: 'Restaurante Teste',
    from: new Date('2026-07-01T00:00:00.000Z'),
    to: new Date('2026-07-31T23:59:59.000Z'),
    temperatures: [],
    controls: [
      {
        type: 'RECEIVING',
        subject: 'Leite integral',
        occurredAt: new Date('2026-07-28T12:00:00.000Z'),
        nextDueAt: null,
        responsibleName: 'Janaína',
        notes: null,
        data: {
          supplier: 'Fornecedor Teste',
          packaging: 'Íntegra',
          conservation: 'REFRIGERADO',
          temperatureC: 4.2,
          deliverer: 'Entregador',
          expirationDate: '2026-08-05T12:00:00.000Z',
        },
      },
    ],
  });

  assert.equal(buffer.subarray(0, 2).toString(), 'PK');

  const files = unzipSync(buffer);
  const worksheet = strFromU8(files['xl/worksheets/sheet1.xml']);

  for (const header of [
    'Produto/Fornecedor',
    'Data',
    'Embalagem',
    'Conservação',
    'TºC',
    'Entregador',
    'Data de Validade',
    'Responsável',
  ]) {
    assert.match(worksheet, new RegExp(header));
  }
  assert.match(worksheet, /Leite integral/);
  assert.match(worksheet, /4\.2 °C/);
});
