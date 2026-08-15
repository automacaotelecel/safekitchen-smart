const assert = require('node:assert/strict');
const test = require('node:test');

const { parseClientDateTime } = require('../dist/lib/date.js');

test('horário local de São Paulo é convertido para o instante UTC correto', () => {
  const date = parseClientDateTime('2026-08-14T20:15', 'America/Sao_Paulo');
  assert.equal(date.toISOString(), '2026-08-14T23:15:00.000Z');
});

test('horário que já possui fuso não é reinterpretado', () => {
  const date = parseClientDateTime('2026-08-14T20:15:00-03:00');
  assert.equal(date.toISOString(), '2026-08-14T23:15:00.000Z');
});
