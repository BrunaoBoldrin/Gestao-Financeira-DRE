const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText, filename);
};
const {
  buildPaymentSchedule, readPaymentSchedule, paymentTermsFromDates, paymentTotal
} = require('../src/utils/paymentSchedule.ts');
const { formatTaxId } = require('../src/utils/text.ts');
const { findFinancialMatches } = require('../src/utils/financialMatching.ts');

test('builds dates from emission and reconciles every cent of the invoice', () => {
  const result = buildPaymentSchedule('2026-08-05', [30, 60, 90], '100,00');
  assert.deepEqual(result, [
    { dataVencimento: '2026-09-04', valor: '33.34' },
    { dataVencimento: '2026-10-04', valor: '33.33' },
    { dataVencimento: '2026-11-03', valor: '33.33' },
  ]);
  assert.equal(paymentTotal(result), 10000);
  assert.deepEqual(paymentTermsFromDates('2026-08-05', result), [30, 60, 90]);
});

test('validates manual dates and amounts without rebalancing unequal installments', () => {
  const drafts = [
    { dataVencimento: '2026-09-03', valor: '108,39' },
    { dataVencimento: '2026-10-02', valor: '94.11', linhaDigitavel: '11199' },
  ];
  assert.deepEqual(readPaymentSchedule(drafts), [
    { ...drafts[0], valor: 108.39 },
    { ...drafts[1], valor: 94.11 },
  ]);
  assert.equal(paymentTotal(drafts), 20250);
  assert.equal(readPaymentSchedule([{ dataVencimento: '2026-02-31', valor: '9' }]), null);
  assert.equal(readPaymentSchedule([{ dataVencimento: '2026-02-28', valor: '3.333' }]), null);
  assert.equal(readPaymentSchedule([{ dataVencimento: '2026-02-28', valor: '0' }]), null);
});

test('formats typed or pasted CPF and numeric or alphanumeric CNPJ', () => {
  assert.equal(formatTaxId('66655544488'), '666.555.444-88');
  assert.equal(formatTaxId('02.345.678/0001-12'), '02.345.678/0001-12');
  assert.equal(formatTaxId('02345678000112'), '02.345.678/0001-12');
  assert.equal(formatTaxId('12abc34501de35'), '12.ABC.345/01DE-35');
  assert.equal(formatTaxId('666555'), '666.555');
  assert.equal(formatTaxId(''), '');
});

test('checks a stored boleto identifier against all invoices installments', () => {
  const invoice = { dadosExtraidos: {
    valorTotal: 210, parcelas: [
      { dataVencimento: '2026-09-04', valor: 110, linhaDigitavel: '98765' },
      { dataVencimento: '2026-10-04', valor: 100, linhaDigitavel: '12345' },
    ],
  } };
  const matches = findFinancialMatches(invoice, [{ valor: 100, linhaDigitavel: '12345', dataVencimento: '2026-10-04' }]);
  assert.equal(matches[0].nivel, 'DUPLICIDADE_FORTE');
});
