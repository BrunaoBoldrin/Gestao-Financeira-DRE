const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};

const { calcularPontoEquilibrio, lerDecimalEmCentavos } = require('../src/utils/pontoEquilibrio.ts');

const fixo = (valor) => ({ descricao: 'Aluguel e pessoal', tipo: 'FIXO', valor });
const variavelEmReais = (valor) => ({ descricao: 'Insumos', tipo: 'VARIAVEL_VALOR', valor });
const variavelPercentual = (valor) => ({ descricao: 'Impostos e taxas', tipo: 'VARIAVEL_PERCENTUAL', valor });

test('fixed costs of R$ 60,000 and 40% variable costs require R$ 100,000 in revenue', () => {
  const result = calcularPontoEquilibrio([fixo(6_000_000), variavelPercentual(4000)], null);
  assert.equal(result.margem, 60);
  assert.equal(result.ponto, 10_000_000);
  assert.equal(result.diferenca, null);
});

test('combines monetary and percentage-based variable costs using the same revenue base', () => {
  const result = calcularPontoEquilibrio([fixo(500_000), variavelEmReais(1_000_000), variavelPercentual(1500)], 2_000_000);
  assert.equal(result.margem, 35);
  assert.equal(result.variaveisEmPercentual, 65);
  assert.equal(result.ponto, 1_428_572);
  assert.equal(result.diferenca, 571_428);
});

test('handles missing inputs and nonpositive margins without reporting a target', () => {
  assert.equal(calcularPontoEquilibrio([], null).ponto, null);
  assert.equal(calcularPontoEquilibrio([fixo(100), variavelEmReais(10)], 0).ponto, null);
  assert.equal(calcularPontoEquilibrio([fixo(100), variavelPercentual(10_000)], null).ponto, null);
  assert.equal(calcularPontoEquilibrio([fixo(100), variavelPercentual(10_000), variavelPercentual(100)], null).margem, -1);
  assert.equal(calcularPontoEquilibrio([fixo(0)], null).ponto, 0);
});

test('uses exact cents, accepts decimal commas, and rejects excess precision or invalid values', () => {
  assert.equal(lerDecimalEmCentavos(' 100,05 '), 10005);
  assert.equal(lerDecimalEmCentavos('0.7'), 70);
  for (const input of ['-1', '100,005', '1e4', '1.000,00', '', '9999999999']) {
    assert.equal(lerDecimalEmCentavos(input), null);
  }
  assert.equal(calcularPontoEquilibrio([fixo(1), variavelPercentual(3333)], null).ponto, 2);
});
