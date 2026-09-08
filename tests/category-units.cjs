const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/utils/categoryUnits.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
const helper = { exports: {} };
new Function('exports', 'module', compiled)(helper.exports, helper);
const { supplierBelongsToUnit: categoryBelongsToUnit } = helper.exports;
const units = [
  { id: 'rc', nome: 'Rio Claro', ativa: true },
  { id: 'pira', nome: 'Piracicaba', ativa: true },
  { id: 'old', nome: 'Inativa', ativa: false }
];
test('legacy suppliers remain available in registered active units', () => {
  assert.equal(categoryBelongsToUnit({}, 'Rio Claro', units), true);
  assert.equal(categoryBelongsToUnit({}, 'Piracicaba', units), true);
});
test('a single-unit supplier is excluded from other branches', () => {
  const plan = { unidadeIds: ['rc'] };
  assert.equal(categoryBelongsToUnit(plan, 'Rio Claro', units), true);
  assert.equal(categoryBelongsToUnit(plan, 'Piracicaba', units), false);
});
test('multiple selections survive JSON persistence', () => {
  const plan = JSON.parse(JSON.stringify({ unidadeIds: ['rc', 'pira'] }));
  assert.equal(categoryBelongsToUnit(plan, 'Rio Claro', units), true);
  assert.equal(categoryBelongsToUnit(plan, 'Piracicaba', units), true);
});
test('empty selections and missing or inactive branches do not allow use', () => {
  assert.equal(categoryBelongsToUnit({ unidadeIds: [] }, 'Rio Claro', units), false);
  for (const name of [undefined, '', 'Todas as Unidades', 'Inativa', 'Desconhecida']) {
    assert.equal(categoryBelongsToUnit({}, name, units), false);
  }
});
test('branch links use stable IDs when a branch is renamed', () => {
  assert.equal(categoryBelongsToUnit({ unidadeIds: ['rc'] }, 'Novo nome', [{ ...units[0], nome: 'Novo nome' }]), true);
});
test('selecting existing branches does not automatically include a future branch', () => {
  assert.equal(categoryBelongsToUnit({ unidadeIds: ['rc', 'pira'] }, 'Nova', [...units, { id: 'new', nome: 'Nova', ativa: true }]), false);
});

test('account plans are global even when legacy branch restrictions exist', () => {
  assert.equal(helper.exports.categoryBelongsToUnit({ unidadeIds: ['rc'] }, 'Piracicaba', units), true);
});
