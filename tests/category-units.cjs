const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText, filename);
};
const { categoryBelongsToUnit, supplierBelongsToUnit, bankBelongsToUnit, findUnit, isPhysicalCashAccount } =
  require('../src/utils/categoryUnits.ts');
const units = [
  { id: 'rc', nome: 'Rio Claro', ativa: true },
  { id: 'pira', nome: 'Piracicaba', ativa: true },
  { id: 'old', nome: 'Inativa', ativa: false }
];
test('legacy suppliers remain available in registered active units', () => {
  assert.equal(supplierBelongsToUnit({}, 'Rio Claro', units), true);
  assert.equal(supplierBelongsToUnit({}, 'Piracicaba', units), true);
});
test('a single-unit supplier is excluded from other branches', () => {
  const plan = { unidadeIds: ['rc'] };
  assert.equal(supplierBelongsToUnit(plan, 'Rio Claro', units), true);
  assert.equal(supplierBelongsToUnit(plan, 'Piracicaba', units), false);
});
test('multiple selections survive JSON persistence', () => {
  const plan = JSON.parse(JSON.stringify({ unidadeIds: ['rc', 'pira'] }));
  assert.equal(supplierBelongsToUnit(plan, 'Rio Claro', units), true);
  assert.equal(supplierBelongsToUnit(plan, 'Piracicaba', units), true);
});
test('empty selections and missing or inactive branches do not allow use', () => {
  assert.equal(supplierBelongsToUnit({ unidadeIds: [] }, 'Rio Claro', units), false);
  for (const name of [undefined, '', 'Todas as Unidades', 'Inativa', 'Desconhecida']) {
    assert.equal(supplierBelongsToUnit({}, name, units), false);
  }
});
test('branch links use stable IDs when a branch is renamed', () => {
  assert.equal(supplierBelongsToUnit({ unidadeIds: ['rc'] }, 'Novo nome', [{ ...units[0], nome: 'Novo nome' }]), true);
});
test('selecting existing branches does not automatically include a future branch', () => {
  assert.equal(supplierBelongsToUnit({ unidadeIds: ['rc', 'pira'] }, 'Nova', [...units, { id: 'new', nome: 'Nova', ativa: true }]), false);
});

test('account plans are global even when legacy branch restrictions exist', () => {
  assert.equal(categoryBelongsToUnit({ unidadeIds: ['rc'] }, 'Piracicaba', units), true);
});

test('branch references can be stored as ids or spelling variants without leaking another branch', () => {
  const branches = [...units, { id: 'sp', nome: 'São Paulo', ativa: true }];
  const bank = { unidade: '  SAO PAULO  ', banco: 'Itaú' };
  assert.equal(findUnit('sp', branches).nome, 'São Paulo');
  assert.equal(bankBelongsToUnit(bank, 'São Paulo', branches), true);
  assert.equal(bankBelongsToUnit({ ...bank, unidade: 'sp' }, 'São Paulo', branches), true);
  assert.equal(bankBelongsToUnit(bank, 'Rio Claro', branches), false);
  assert.equal(bankBelongsToUnit(bank, 'Todas as Unidades', branches), false);
  assert.equal(supplierBelongsToUnit({ unidadeIds: ['sp'] }, 'SAO PAULO', branches), true);
});

test('normalized lookup rejects ambiguous units and keeps the exact registered names', () => {
  const branches = [{ id: 'a', nome: 'São Paulo' }, { id: 'b', nome: 'Sao Paulo' }];
  assert.equal(findUnit(' SAO PAULO ', branches), undefined);
  assert.equal(findUnit('São Paulo', branches).id, 'a');
});

test('physical cash recognises restored and accented labels without treating a Caixa bank as physical cash', () => {
  for (const banco of ['Caixa Fisico', 'Caixa Físico Recepção', '  CAIXA FISICO  ']) {
    assert.equal(isPhysicalCashAccount({ banco }), true);
  }
  for (const banco of ['Caixa Econômica Federal', 'Sicoob']) {
    assert.equal(isPhysicalCashAccount({ banco }), false);
  }
});
