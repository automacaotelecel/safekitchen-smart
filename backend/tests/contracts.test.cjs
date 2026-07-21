const assert = require('node:assert/strict');
const test = require('node:test');

const { contractHash, renderContractPdf } = require('../dist/modules/billing/contracts.service.js');

test('hash contratual é estável e PDF contém um documento válido', async () => {
  const snapshot = {
    provider: { name: 'Fornecedor Teste', document: '00.000.000/0001-00', address: 'Rua A, 1', email: 'teste@example.com', city: 'São Paulo/SP' },
    customer: { name: 'Cliente Teste', email: 'cliente@example.com', document: '000.000.000-00', address: { postalCode: '00000000', street: 'Rua B', number: '2', district: 'Centro', city: 'São Paulo', state: 'SP' } },
    plan: { code: 'START', name: 'SKS Start', setupAmountCents: 99000, monthlyAmountCents: 19700, kitItems: ['Impressora'], features: ['Etiquetas'] },
    acceptedAt: '2026-07-22T12:00:00.000Z', deliveryDays: 15, version: '2026-07-22',
  };
  assert.equal(contractHash(snapshot), contractHash({ ...snapshot }));
  const pdf = await renderContractPdf({
    id: 'contract-1', restaurantId: 'restaurant-1', kitOrderId: 'order-1', acceptedById: 'user-1',
    contractNumber: 'SKS-TESTE', version: snapshot.version, status: 'ACTIVE', customerName: 'Cliente Teste',
    customerEmail: 'cliente@example.com', customerDocument: '000.000.000-00', customerPhone: null,
    planCode: 'START', setupAmountCents: 99000, monthlyAmountCents: 19700, currency: 'BRL',
    termsSnapshot: snapshot, contentHash: contractHash(snapshot), acceptedAt: new Date(snapshot.acceptedAt), acceptedIp: '127.0.0.1',
    acceptedUserAgent: 'test', activatedAt: new Date(), emailedAt: null, emailProviderId: null, emailError: null,
    createdAt: new Date(), updatedAt: new Date(),
  });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1_000);
});
