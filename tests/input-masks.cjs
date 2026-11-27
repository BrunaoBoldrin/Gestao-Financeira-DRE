const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText, filename);
};
const { readCalendarInput, formatCalendarInput, readMoneyInput, formatMoneyInput } =
  require('../src/utils/inputMasks.ts');
const { formatTaxId } = require('../src/utils/text.ts');

test('masks typed dates and normalizes pasted ISO dates without rolling invalid days over', () => {
  assert.equal(formatCalendarInput('27112', 'day'), '27/11/2');
  assert.equal(formatCalendarInput(' 2026-11-27 ', 'day'), '27/11/2026');
  assert.equal(formatCalendarInput('1/2/2028', 'day'), '01/02/2028');
  assert.equal(readCalendarInput('29/02/2028', 'day'), '2028-02-29');
  assert.equal(readCalendarInput('29/02/2027', 'day'), '');
  assert.equal(readCalendarInput('31/04/2026', 'day'), '');
  assert.equal(readCalendarInput('25/11/20', 'day'), '');
});

test('displays competence as month and year, with an unchanged stored year-month', () => {
  assert.equal(formatCalendarInput('2026-11', 'month'), '11/2026');
  assert.equal(formatCalendarInput('112026', 'month'), '11/2026');
  assert.equal(readCalendarInput('11/2026', 'month'), '2026-11');
  assert.equal(readCalendarInput('13/2026', 'month'), '');
});

test('handles monetary entry in reais and pasted values with currency syntax', () => {
  assert.deepEqual(readMoneyInput('100'), { draft: '100', value: '100' });
  assert.deepEqual(readMoneyInput('1.234'), { draft: '1234', value: '1234' });
  assert.deepEqual(readMoneyInput('R$ 1.234,56'), { draft: '1234,56', value: '1234.56' });
  assert.deepEqual(readMoneyInput('1,234.56'), { draft: '1234,56', value: '1234.56' });
  assert.deepEqual(readMoneyInput('12,'), { draft: '12,', value: '12' });
  assert.deepEqual(readMoneyInput('-R$ 1.234,50'), { draft: '-1234,50', value: '-1234.50' });
  assert.equal(readMoneyInput('1e3'), null);
  assert.equal(readMoneyInput('2,3,4'), null);
  assert.equal(formatMoneyInput('100'), '100,00');
  assert.equal(formatMoneyInput('1234.5'), '1.234,50');
  assert.equal(formatMoneyInput('-1234.50'), '-1.234,50');
  assert.equal(formatMoneyInput(''), '');
});

test('keeps the CNPJ pattern while typing into a company-specific field', () => {
  assert.equal(formatTaxId('123456', true), '12.345.6');
  assert.equal(formatTaxId('123456'), '123.456');
  assert.equal(formatTaxId('12abc34501de35', true), '12.ABC.345/01DE-35');
});
