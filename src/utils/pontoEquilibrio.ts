import type { CustoPontoEquilibrio } from '../types';

export const MAX_VALOR = 99_999_999_999;
export const MAX_CUSTOS = 200;
const PERCENTUAL_INTEIRO = 10_000;

export function lerDecimalEmCentavos(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(value)) return null;
  const [inteiro, decimal = ''] = value.replace(',', '.').split('.');
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) && centavos <= MAX_VALOR ? centavos : null;
}

export function calcularPontoEquilibrio(custos: CustoPontoEquilibrio[], receitaReferencia: number | null) {
  const fixos = custos.filter((custo) => custo.tipo === 'FIXO');
  const despesasFixas = fixos.reduce((total, custo) => total + custo.valor, 0);
  const variaveisEmReais = custos
    .filter((custo) => custo.tipo === 'VARIAVEL_VALOR')
    .reduce((total, custo) => total + custo.valor, 0);
  const variaveisEmPercentual = custos
    .filter((custo) => custo.tipo === 'VARIAVEL_PERCENTUAL')
    .reduce((total, custo) => total + custo.valor, 0);
  const referenciaObrigatoria = variaveisEmReais > 0 && !receitaReferencia;
  // Treat the reais entered for variable costs as observed at the reference revenue.
  const receitaBase = BigInt(receitaReferencia || 1);
  const totalBase = receitaBase * BigInt(PERCENTUAL_INTEIRO);
  const contribuicao = totalBase
    - receitaBase * BigInt(variaveisEmPercentual)
    - BigInt(variaveisEmReais) * BigInt(PERCENTUAL_INTEIRO);
  const margem = referenciaObrigatoria ? null : 100 * Number(contribuicao) / Number(totalBase);

  let ponto: number | null = null;
  let motivo = '';
  if (!fixos.length) {
    motivo = 'Informe pelo menos um custo fixo mensal.';
  } else if (referenciaObrigatoria) {
    motivo = 'Informe um faturamento de referência maior que zero para converter os custos variáveis em reais.';
  } else if (contribuicao <= 0n) {
    motivo = 'A margem de contribuição precisa ser positiva para atingir o ponto de equilíbrio.';
  } else {
    const numerador = BigInt(despesasFixas) * totalBase;
    const centavosNecessarios = (numerador + contribuicao - 1n) / contribuicao;
    if (centavosNecessarios <= BigInt(Number.MAX_SAFE_INTEGER)) {
      ponto = Number(centavosNecessarios);
    } else {
      motivo = 'O faturamento calculado excede o valor exibido pelo sistema.';
    }
  }

  return {
    despesasFixas,
    variaveisEmPercentual: margem === null ? null : 100 - margem,
    margem,
    ponto,
    diferenca: ponto === null || receitaReferencia === null ? null : receitaReferencia - ponto,
    motivo,
  };
}
