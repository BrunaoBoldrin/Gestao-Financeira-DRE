import type { CategoriaMaster, GrupoDRE, Lancamento, TipoLancamento } from '../types';

export interface GrupoDREOption {
  value: GrupoDRE;
  label: string;
  tipos: TipoLancamento[];
}

export const GRUPOS_DRE: GrupoDREOption[] = [
  { value: 'RECEITA_BRUTA', label: 'Receita Bruta de Vendas e Serviços', tipos: ['RECEITA'] },
  { value: 'DEDUCAO_RECEITA', label: 'Deduções da Receita Bruta', tipos: ['DESPESA'] },
  { value: 'CUSTO_SERVICO_PRODUTO', label: 'Custos dos Produtos e Serviços (CPV/CSP)', tipos: ['DESPESA'] },
  { value: 'DESPESA_VENDAS', label: 'Despesas com Vendas', tipos: ['DESPESA'] },
  { value: 'DESPESA_ADMINISTRATIVA', label: 'Despesas Administrativas', tipos: ['DESPESA'] },
  { value: 'OUTRA_RECEITA_OPERACIONAL', label: 'Outras Receitas Operacionais', tipos: ['RECEITA'] },
  { value: 'OUTRA_DESPESA_OPERACIONAL', label: 'Outras Despesas Operacionais', tipos: ['DESPESA'] },
  { value: 'DEPRECIACAO_AMORTIZACAO', label: 'Depreciação e Amortização', tipos: ['DESPESA'] },
  { value: 'RECEITA_FINANCEIRA', label: 'Receitas Financeiras', tipos: ['RECEITA'] },
  { value: 'DESPESA_FINANCEIRA', label: 'Despesas Financeiras', tipos: ['DESPESA'] },
  { value: 'TRIBUTO_LUCRO', label: 'Tributos sobre o Lucro (IRPJ/CSLL)', tipos: ['DESPESA'] },
  { value: 'NAO_AFETA_DRE', label: 'Não afeta o DRE', tipos: ['RECEITA', 'DESPESA'] }
];

export const getGrupoDRELabel = (grupo: GrupoDRE) =>
  GRUPOS_DRE.find((item) => item.value === grupo)?.label || grupo;

export const getDefaultGrupoDRE = (tipo: TipoLancamento): GrupoDRE =>
  tipo === 'RECEITA' ? 'RECEITA_BRUTA' : 'DESPESA_ADMINISTRATIVA';

export const getLancamentoCompetencia = (lancamento: Lancamento) =>
  lancamento.dataCompetencia || lancamento.dataVencimento;

export const resolveGrupoDRE = (
  lancamento: Lancamento,
  categorias: CategoriaMaster[]
): GrupoDRE => {
  if (lancamento.impactoDRE === 'NAO_AFETA') return 'NAO_AFETA_DRE';

  const categoria = categorias.find(
    (item) => item.nome.localeCompare(lancamento.categoria, 'pt-BR', { sensitivity: 'base' }) === 0
  );

  const grupoConfigurado = categoria && GRUPOS_DRE.find((item) => item.value === categoria.grupoDRE);
  if (categoria && grupoConfigurado?.tipos.includes(lancamento.tipo)) return categoria.grupoDRE;

  return getDefaultGrupoDRE(lancamento.tipo);
};
