const assert = require('node:assert/strict');
const test = require('node:test');

const {
  checklistForJurisdiction,
  rdc216AuditChecklist,
  regulatorySources,
  sourcesForJurisdiction,
} = require('../dist/modules/regulatory/regulatory.knowledge.js');

test('checklist RDC 216 possui itens únicos e referências rastreáveis', () => {
  assert.ok(rdc216AuditChecklist.length >= 20);
  const ids = rdc216AuditChecklist.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(
    rdc216AuditChecklist.every(
      (item) =>
        item.requirement.length > 20 &&
        item.reference.includes('RDC 216/2004') &&
        item.evidenceHint.length > 10
    )
  );
});

test('jurisdição de São Paulo inclui fontes nacional e estaduais versionadas', () => {
  const sources = sourcesForJurisdiction('SP');
  assert.ok(sources.some((source) => source.id === 'RDC_216_2004'));
  assert.ok(sources.some((source) => source.id === 'CVS_5_2013'));
  assert.ok(sources.some((source) => source.id === 'CVS_3_2026'));
  assert.equal(
    regulatorySources.find((source) => source.id === 'CVS_3_2026').status,
    'FUTURE'
  );

  const national = checklistForJurisdiction('BR');
  const saoPaulo = checklistForJurisdiction('SP');
  assert.ok(saoPaulo.length > national.length);
  assert.ok(saoPaulo.some((item) => item.id === 'SP_TRN_01'));
  assert.equal(new Set(saoPaulo.map((item) => item.id)).size, saoPaulo.length);
});
