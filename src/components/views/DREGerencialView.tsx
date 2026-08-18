import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { CategoriaMaster, DREItem, GrupoDRE, Lancamento } from '../../types';
import { getLancamentoCompetencia, resolveGrupoDRE } from '../../utils/dre';

type CategoryValues = Map<string, number>;
type MonthSummary = Record<GrupoDRE, CategoryValues>;

const emptySummary = (): MonthSummary => ({
  RECEITA_BRUTA: new Map(),
  DEDUCAO_RECEITA: new Map(),
  CUSTO_SERVICO_PRODUTO: new Map(),
  DESPESA_VENDAS: new Map(),
  DESPESA_ADMINISTRATIVA: new Map(),
  OUTRA_RECEITA_OPERACIONAL: new Map(),
  OUTRA_DESPESA_OPERACIONAL: new Map(),
  DEPRECIACAO_AMORTIZACAO: new Map(),
  RECEITA_FINANCEIRA: new Map(),
  DESPESA_FINANCEIRA: new Map(),
  TRIBUTO_LUCRO: new Map(),
  NAO_AFETA_DRE: new Map()
});

const addCategoryValue = (map: CategoryValues, category: string, value: number) => {
  map.set(category, (map.get(category) || 0) + value);
};

const summarizeMonth = (
  lancamentos: Lancamento[],
  categorias: CategoriaMaster[],
  month: string,
  selectedUnit: string
): MonthSummary => {
  const summary = emptySummary();

  lancamentos
    .filter((item) =>
      item.status !== 'CANCELADO' &&
      getLancamentoCompetencia(item).startsWith(month) &&
      (selectedUnit === 'Todas as Unidades' || item.unidade === selectedUnit)
    )
    .forEach((item) => {
      const grupo = resolveGrupoDRE(item, categorias);
      if (grupo === 'NAO_AFETA_DRE') return;
      addCategoryValue(summary[grupo], item.categoria, item.tipo === 'RECEITA' ? item.valor : -item.valor);
    });

  return summary;
};

const sumValues = (values: CategoryValues) =>
  Array.from(values.values()).reduce((total, value) => total + value, 0);

const combineCategoryValues = (...maps: CategoryValues[]) => {
  const combined: CategoryValues = new Map();
  maps.forEach((map) => map.forEach((value, category) => addCategoryValue(combined, category, value)));
  return combined;
};

const previousMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatCompetencia = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const buildChildren = (
  prefix: string,
  current: CategoryValues,
  previous: CategoryValues,
  categorias: CategoriaMaster[],
  grupos: GrupoDRE[]
): DREItem[] => {
  const configuredCategories = categorias
    .filter((category) => category.ativa && grupos.includes(category.grupoDRE))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  const categoryNames = Array.from(new Set([
    ...configuredCategories.map((category) => category.nome),
    ...current.keys(),
    ...previous.keys()
  ]));

  return categoryNames.map((categoryName, index) => {
    const configured = configuredCategories.find((category) => category.nome === categoryName);
    return {
      codigo: configured?.codigo || `${prefix}.${index + 1}`,
      descricao: categoryName,
      tipo: 'CONTA',
      nivel: 2,
      mesAtual: current.get(categoryName) || 0,
      mesAnterior: previous.get(categoryName) || 0,
      orcado: 0
    };
  });
};

export const DREGerencialView: React.FC = () => {
  const {
    dreData,
    lancamentos,
    categorias,
    selectedUnit,
    units,
    currentUser,
    isFinance,
    fechamentoMensal,
    showToast
  } = useApp();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '4': true,
    '6': true,
    '7': true,
    '8': true,
    '10': true,
    '12': true,
    '14': true
  });

  const currentReferenceMonth = fechamentoMensal.mesAno;
  const [selectedMonth, setSelectedMonth] = useState(currentReferenceMonth);
  const [unidadeDre, setUnidadeDre] = useState(
    isFinance && currentUser ? currentUser.unit : selectedUnit
  );
  const comparisonMonth = previousMonth(selectedMonth);

  const availableMonths = useMemo(() => {
    const months = new Set<string>(lancamentos.map((item) => getLancamentoCompetencia(item).substring(0, 7)));
    const [referenceYear, referenceMonth] = currentReferenceMonth.split('-').map(Number);
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(referenceYear, referenceMonth - 1 - index, 1);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    months.add(selectedMonth);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [currentReferenceMonth, lancamentos, selectedMonth]);

  const calculatedDre = useMemo<DREItem[]>(() => {
    const current = summarizeMonth(lancamentos, categorias, selectedMonth, unidadeDre);
    const previous = summarizeMonth(lancamentos, categorias, comparisonMonth, unidadeDre);
    const budget = (code: string) => dreData.find((item) => item.codigo === code)?.orcado || 0;

    const receitaBruta = sumValues(current.RECEITA_BRUTA);
    const receitaBrutaAnterior = sumValues(previous.RECEITA_BRUTA);
    const deducoes = sumValues(current.DEDUCAO_RECEITA);
    const deducoesAnterior = sumValues(previous.DEDUCAO_RECEITA);
    const receitaLiquida = receitaBruta + deducoes;
    const receitaLiquidaAnterior = receitaBrutaAnterior + deducoesAnterior;
    const custos = sumValues(current.CUSTO_SERVICO_PRODUTO);
    const custosAnterior = sumValues(previous.CUSTO_SERVICO_PRODUTO);
    const lucroBruto = receitaLiquida + custos;
    const lucroBrutoAnterior = receitaLiquidaAnterior + custosAnterior;
    const despesasVendas = sumValues(current.DESPESA_VENDAS);
    const despesasVendasAnterior = sumValues(previous.DESPESA_VENDAS);
    const despesasAdministrativas = sumValues(current.DESPESA_ADMINISTRATIVA);
    const despesasAdministrativasAnterior = sumValues(previous.DESPESA_ADMINISTRATIVA);
    const outrasOperacionais = sumValues(current.OUTRA_RECEITA_OPERACIONAL) + sumValues(current.OUTRA_DESPESA_OPERACIONAL);
    const outrasOperacionaisAnterior = sumValues(previous.OUTRA_RECEITA_OPERACIONAL) + sumValues(previous.OUTRA_DESPESA_OPERACIONAL);
    const ebitda = lucroBruto + despesasVendas + despesasAdministrativas + outrasOperacionais;
    const ebitdaAnterior = lucroBrutoAnterior + despesasVendasAnterior + despesasAdministrativasAnterior + outrasOperacionaisAnterior;
    const depreciacao = sumValues(current.DEPRECIACAO_AMORTIZACAO);
    const depreciacaoAnterior = sumValues(previous.DEPRECIACAO_AMORTIZACAO);
    const ebit = ebitda + depreciacao;
    const ebitAnterior = ebitdaAnterior + depreciacaoAnterior;
    const financeiro = sumValues(current.RECEITA_FINANCEIRA) + sumValues(current.DESPESA_FINANCEIRA);
    const financeiroAnterior = sumValues(previous.RECEITA_FINANCEIRA) + sumValues(previous.DESPESA_FINANCEIRA);
    const resultadoAntesTributos = ebit + financeiro;
    const resultadoAntesTributosAnterior = ebitAnterior + financeiroAnterior;
    const tributosLucro = sumValues(current.TRIBUTO_LUCRO);
    const tributosLucroAnterior = sumValues(previous.TRIBUTO_LUCRO);
    const resultadoFinal = resultadoAntesTributos + tributosLucro;
    const resultadoFinalAnterior = resultadoAntesTributosAnterior + tributosLucroAnterior;

    return [
      {
        codigo: '1', descricao: 'RECEITA BRUTA DE VENDAS E SERVIÇOS', tipo: 'TOTAL', nivel: 1,
        mesAtual: receitaBruta, mesAnterior: receitaBrutaAnterior, orcado: budget('1'),
        filhos: buildChildren('1', current.RECEITA_BRUTA, previous.RECEITA_BRUTA, categorias, ['RECEITA_BRUTA'])
      },
      {
        codigo: '2', descricao: '(-) DEDUÇÕES DA RECEITA BRUTA', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: deducoes, mesAnterior: deducoesAnterior, orcado: budget('2'),
        filhos: buildChildren('2', current.DEDUCAO_RECEITA, previous.DEDUCAO_RECEITA, categorias, ['DEDUCAO_RECEITA'])
      },
      { codigo: '3', descricao: '(=) RECEITA LÍQUIDA OPERACIONAL', tipo: 'TOTAL', nivel: 1, mesAtual: receitaLiquida, mesAnterior: receitaLiquidaAnterior, orcado: budget('3') },
      {
        codigo: '4', descricao: '(-) CUSTOS DOS PRODUTOS E SERVIÇOS (CPV/CSP)', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: custos, mesAnterior: custosAnterior, orcado: budget('4'),
        filhos: buildChildren('4', current.CUSTO_SERVICO_PRODUTO, previous.CUSTO_SERVICO_PRODUTO, categorias, ['CUSTO_SERVICO_PRODUTO'])
      },
      { codigo: '5', descricao: '(=) LUCRO BRUTO OPERACIONAL', tipo: 'TOTAL', nivel: 1, mesAtual: lucroBruto, mesAnterior: lucroBrutoAnterior, orcado: budget('5') },
      {
        codigo: '6', descricao: '(-) DESPESAS COM VENDAS', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: despesasVendas, mesAnterior: despesasVendasAnterior, orcado: budget('6'),
        filhos: buildChildren('6', current.DESPESA_VENDAS, previous.DESPESA_VENDAS, categorias, ['DESPESA_VENDAS'])
      },
      {
        codigo: '7', descricao: '(-) DESPESAS ADMINISTRATIVAS', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: despesasAdministrativas, mesAnterior: despesasAdministrativasAnterior, orcado: budget('7'),
        filhos: buildChildren('7', current.DESPESA_ADMINISTRATIVA, previous.DESPESA_ADMINISTRATIVA, categorias, ['DESPESA_ADMINISTRATIVA'])
      },
      {
        codigo: '8', descricao: '(+/-) OUTRAS RECEITAS E DESPESAS OPERACIONAIS', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: outrasOperacionais, mesAnterior: outrasOperacionaisAnterior, orcado: budget('8'),
        filhos: buildChildren(
          '8',
          combineCategoryValues(current.OUTRA_RECEITA_OPERACIONAL, current.OUTRA_DESPESA_OPERACIONAL),
          combineCategoryValues(previous.OUTRA_RECEITA_OPERACIONAL, previous.OUTRA_DESPESA_OPERACIONAL),
          categorias,
          ['OUTRA_RECEITA_OPERACIONAL', 'OUTRA_DESPESA_OPERACIONAL']
        )
      },
      { codigo: '9', descricao: '(=) EBITDA (RESULTADO ANTES DE JUROS, TRIBUTOS, DEPRECIAÇÃO E AMORTIZAÇÃO)', tipo: 'TOTAL', nivel: 1, mesAtual: ebitda, mesAnterior: ebitdaAnterior, orcado: budget('9') },
      {
        codigo: '10', descricao: '(-) DEPRECIAÇÃO E AMORTIZAÇÃO', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: depreciacao, mesAnterior: depreciacaoAnterior, orcado: budget('10'),
        filhos: buildChildren('10', current.DEPRECIACAO_AMORTIZACAO, previous.DEPRECIACAO_AMORTIZACAO, categorias, ['DEPRECIACAO_AMORTIZACAO'])
      },
      { codigo: '11', descricao: '(=) RESULTADO OPERACIONAL (EBIT)', tipo: 'TOTAL', nivel: 1, mesAtual: ebit, mesAnterior: ebitAnterior, orcado: budget('11') },
      {
        codigo: '12', descricao: '(+/-) RESULTADO FINANCEIRO', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: financeiro, mesAnterior: financeiroAnterior, orcado: budget('12'),
        filhos: buildChildren(
          '12',
          combineCategoryValues(current.RECEITA_FINANCEIRA, current.DESPESA_FINANCEIRA),
          combineCategoryValues(previous.RECEITA_FINANCEIRA, previous.DESPESA_FINANCEIRA),
          categorias,
          ['RECEITA_FINANCEIRA', 'DESPESA_FINANCEIRA']
        )
      },
      { codigo: '13', descricao: '(=) RESULTADO ANTES DOS TRIBUTOS SOBRE O LUCRO', tipo: 'TOTAL', nivel: 1, mesAtual: resultadoAntesTributos, mesAnterior: resultadoAntesTributosAnterior, orcado: budget('13') },
      {
        codigo: '14', descricao: '(-) IRPJ E CSLL', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: tributosLucro, mesAnterior: tributosLucroAnterior, orcado: budget('14'),
        filhos: buildChildren('14', current.TRIBUTO_LUCRO, previous.TRIBUTO_LUCRO, categorias, ['TRIBUTO_LUCRO'])
      },
      { codigo: '15', descricao: '(=) LUCRO OU PREJUÍZO LÍQUIDO DO PERÍODO', tipo: 'TOTAL', nivel: 1, mesAtual: resultadoFinal, mesAnterior: resultadoFinalAnterior, orcado: budget('15') }
    ];
  }, [categorias, comparisonMonth, dreData, lancamentos, selectedMonth, unidadeDre]);

  const toggleExpand = (code: string) => {
    setExpandedNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const receitaBrutaAtual = calculatedDre.find((item) => item.codigo === '1')?.mesAtual || 0;
  const receitaLiquidaAtual = calculatedDre.find((item) => item.codigo === '3')?.mesAtual || 0;
  const analiseVerticalBase = receitaLiquidaAtual === 0 ? 1 : Math.abs(receitaLiquidaAtual);
  const lancamentosDaCompetencia = useMemo(
    () => lancamentos.filter((item) =>
      item.status !== 'CANCELADO' &&
      getLancamentoCompetencia(item).startsWith(selectedMonth) &&
      (unidadeDre === 'Todas as Unidades' || item.unidade === unidadeDre)
    ),
    [lancamentos, selectedMonth, unidadeDre]
  );
  const lancamentosSemCategoria = lancamentosDaCompetencia.filter((item) =>
    item.impactoDRE !== 'NAO_AFETA' &&
    !categorias.some((categoria) =>
      categoria.nome.localeCompare(item.categoria, 'pt-BR', { sensitivity: 'base' }) === 0
    )
  );
  const lancamentosSemImpactoDRE = lancamentosDaCompetencia.filter(
    (item) => resolveGrupoDRE(item, categorias) === 'NAO_AFETA_DRE'
  );
  const monthStatus = selectedMonth === currentReferenceMonth
    ? fechamentoMensal.status === 'FECHADO' ? 'FECHADO' : 'EM ANDAMENTO'
    : selectedMonth < currentReferenceMonth ? 'HISTÓRICO' : 'PLANEJADO';

  const renderDRERow = (item: DREItem) => {
    const isExpanded = expandedNodes[item.codigo];
    const hasChildren = Boolean(item.filhos?.length);
    const avPercent = (item.mesAtual / analiseVerticalBase) * 100;
    const hasComparisonBase = item.mesAnterior !== 0;
    const momVarPercent = hasComparisonBase
      ? ((item.mesAtual - item.mesAnterior) / Math.abs(item.mesAnterior)) * 100
      : 0;
    const isTotal = item.tipo === 'TOTAL';
    const isSubtotal = item.tipo === 'SUBTOTAL';
    const currentValueColor = item.mesAtual < 0
      ? isTotal ? 'text-rose-300' : 'text-rose-600'
      : isTotal ? 'text-white' : 'text-[#0b1c30]';
    const comparisonColor = isTotal ? 'text-slate-100' : 'text-gray-600';
    const variationColor = !hasComparisonBase
      ? isTotal ? 'text-sky-200' : 'text-gray-500'
      : momVarPercent > 0
      ? isTotal ? 'text-emerald-300' : 'text-emerald-700'
      : momVarPercent < 0
        ? isTotal ? 'text-rose-300' : 'text-rose-700'
        : isTotal ? 'text-sky-200' : 'text-gray-600';
    const budgetColor = isTotal ? 'text-slate-200' : 'text-gray-500';

    return (
      <React.Fragment key={item.codigo}>
        <tr className={`transition ${
          isTotal
            ? 'bg-[#0b1c30] text-white font-extrabold border-y border-[#1a2e46]'
            : isSubtotal
            ? 'bg-[#eff4ff] text-[#0b1c30] font-bold border-y border-[#d3e4fe]'
            : 'hover:bg-gray-50 border-b border-gray-100 text-gray-800'
        }`}>
          <td className="p-3" style={{ paddingLeft: `${item.nivel * 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(item.codigo)}
                  className={`p-0.5 rounded transition ${isTotal ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-700'}`}
                >
                  <span className="material-symbols-outlined text-base">{isExpanded ? 'expand_more' : 'chevron_right'}</span>
                </button>
              ) : <span className="w-5" />}
              <span className="font-mono text-[11px] opacity-75">{item.codigo}</span>
              <span className="truncate">{item.descricao}</span>
            </div>
          </td>
          <td className={`p-3 text-right font-mono font-bold ${currentValueColor}`}>
            R$ {item.mesAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </td>
          <td className="p-3 text-right font-mono text-[11px] font-semibold">{avPercent.toFixed(1)}%</td>
          <td className={`p-3 text-right font-mono ${comparisonColor}`}>
            R$ {item.mesAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </td>
          <td className={`p-3 text-right font-mono font-bold text-[11px] ${variationColor}`}>
            {hasComparisonBase ? `${momVarPercent >= 0 ? '+' : ''}${momVarPercent.toFixed(1)}%` : 'Sem base'}
          </td>
          <td className={`p-3 text-right font-mono ${budgetColor}`}>
            R$ {item.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </td>
        </tr>
        {hasChildren && isExpanded && item.filhos!.map((child) => renderDRERow(child))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">Regime de Competência — considera a data de competência, não o vencimento</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              monthStatus === 'EM ANDAMENTO' ? 'bg-amber-100 text-amber-800' :
              monthStatus === 'FECHADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
            }`}>{monthStatus}</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">analytics</span>
            DRE Gerencial Hierárquico Expansível
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={unidadeDre}
            onChange={(event) => setUnidadeDre(event.target.value)}
            disabled={isFinance}
            aria-label="Unidade analisada no DRE"
            className="px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e] disabled:bg-gray-100"
          >
            {!isFinance && <option value="Todas as Unidades">Todas as Unidades (Consolidado)</option>}
            {units
              .filter((unit) => unit.ativa && (!isFinance || unit.nome === currentUser?.unit))
              .map((unit) => <option key={unit.id} value={unit.nome}>{unit.nome}</option>)}
          </select>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e]"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>{formatCompetencia(month)}</option>
            ))}
          </select>
          <button
            onClick={() => showToast(`Relatório DRE de ${formatCompetencia(selectedMonth)} — ${unidadeDre} exportado em PDF!`, 'success')}
            className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] flex items-center gap-1.5 transition shadow-xs"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            Exportar Relatório PDF
          </button>
        </div>
      </div>

      {(lancamentosSemCategoria.length > 0 || lancamentosSemImpactoDRE.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lancamentosSemCategoria.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <strong>{lancamentosSemCategoria.length} lançamento(s) sem categoria cadastrada.</strong>{' '}
              Foram classificados provisoriamente pelo tipo e devem ser revisados no Plano de Contas DRE.
            </div>
          )}
          {lancamentosSemImpactoDRE.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
              <strong>{lancamentosSemImpactoDRE.length} movimentação(ões) sem impacto no DRE.</strong>{' '}
              Transferências, aportes, sangrias e principal de empréstimos permanecem fora do resultado.
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Demonstração do Resultado do Exercício — {formatCompetencia(selectedMonth)}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
            <span>Receita Bruta:</span>
            <span className="font-bold text-[#0b1c30]">R$ {receitaBrutaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className="hidden lg:inline text-gray-400">•</span>
            <span className="hidden lg:inline">Base A.V.: Receita Líquida</span>
            <span className="text-[10px] bg-[#eff4ff] text-[#0b1c30] px-2 py-1 rounded">{unidadeDre}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3 w-1/3">Conta / Estrutura DRE</th>
                <th className="p-3 text-right">{formatCompetencia(selectedMonth)} (Real)</th>
                <th className="p-3 text-right">A.V. %</th>
                <th className="p-3 text-right">{formatCompetencia(comparisonMonth)} (Ant.)</th>
                <th className="p-3 text-right">Var. mensal %</th>
                <th className="p-3 text-right">Orçado (Meta)</th>
              </tr>
            </thead>
            <tbody>{calculatedDre.map((item) => renderDRERow(item))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
