import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { DREItem, Lancamento } from '../../types';

type ExpenseGroup = 'DEDUCOES' | 'CUSTOS' | 'OPEX' | 'DEPRECIACAO' | 'FINANCEIRO';
type CategoryValues = Map<string, number>;

interface MonthSummary {
  receitas: CategoryValues;
  despesas: Record<ExpenseGroup, CategoryValues>;
}

const emptySummary = (): MonthSummary => ({
  receitas: new Map(),
  despesas: {
    DEDUCOES: new Map(),
    CUSTOS: new Map(),
    OPEX: new Map(),
    DEPRECIACAO: new Map(),
    FINANCEIRO: new Map()
  }
});

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const classifyExpense = (category: string): ExpenseGroup => {
  const normalized = normalize(category);
  if (/imposto|tribut|das|pis|cofins|iss/.test(normalized)) return 'DEDUCOES';
  if (/depreci|amortiza/.test(normalized)) return 'DEPRECIACAO';
  if (/taxa|tarifa|juros|bancar|adquirente|financeir/.test(normalized)) return 'FINANCEIRO';
  if (/insumo|comiss|mercadoria|capex|investimento|produto/.test(normalized)) return 'CUSTOS';
  return 'OPEX';
};

const addCategoryValue = (map: CategoryValues, category: string, value: number) => {
  map.set(category, (map.get(category) || 0) + value);
};

const summarizeMonth = (lancamentos: Lancamento[], month: string, selectedUnit: string): MonthSummary => {
  const summary = emptySummary();

  lancamentos
    .filter((item) =>
      item.status !== 'CANCELADO' &&
      item.dataVencimento.startsWith(month) &&
      (selectedUnit === 'Todas as Unidades' || item.unidade === selectedUnit)
    )
    .forEach((item) => {
      if (item.tipo === 'RECEITA') {
        addCategoryValue(summary.receitas, item.categoria, item.valor);
        return;
      }

      addCategoryValue(summary.despesas[classifyExpense(item.categoria)], item.categoria, -item.valor);
    });

  return summary;
};

const sumValues = (values: CategoryValues) =>
  Array.from(values.values()).reduce((total, value) => total + value, 0);

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
  previous: CategoryValues
): DREItem[] => {
  const categories = Array.from(new Set([...current.keys(), ...previous.keys()])).sort();
  return categories.map((category, index) => ({
    codigo: `${prefix}.${index + 1}`,
    descricao: category,
    tipo: 'CONTA',
    nivel: 2,
    mesAtual: current.get(category) || 0,
    mesAnterior: previous.get(category) || 0,
    orcado: 0
  }));
};

export const DREGerencialView: React.FC = () => {
  const {
    dreData,
    lancamentos,
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
    '8': true,
    '9': true
  });

  const currentReferenceMonth = fechamentoMensal.mesAno;
  const [selectedMonth, setSelectedMonth] = useState(currentReferenceMonth);
  const [unidadeDre, setUnidadeDre] = useState(
    isFinance && currentUser ? currentUser.unit : selectedUnit
  );
  const comparisonMonth = previousMonth(selectedMonth);

  const availableMonths = useMemo(() => {
    const months = new Set<string>(lancamentos.map((item) => item.dataVencimento.substring(0, 7)));
    const [referenceYear, referenceMonth] = currentReferenceMonth.split('-').map(Number);
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(referenceYear, referenceMonth - 1 - index, 1);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    months.add(selectedMonth);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [currentReferenceMonth, lancamentos, selectedMonth]);

  const calculatedDre = useMemo<DREItem[]>(() => {
    const current = summarizeMonth(lancamentos, selectedMonth, unidadeDre);
    const previous = summarizeMonth(lancamentos, comparisonMonth, unidadeDre);
    const budget = (code: string) => dreData.find((item) => item.codigo === code)?.orcado || 0;

    const receitaBruta = sumValues(current.receitas);
    const receitaBrutaAnterior = sumValues(previous.receitas);
    const deducoes = sumValues(current.despesas.DEDUCOES);
    const deducoesAnterior = sumValues(previous.despesas.DEDUCOES);
    const receitaLiquida = receitaBruta + deducoes;
    const receitaLiquidaAnterior = receitaBrutaAnterior + deducoesAnterior;
    const custos = sumValues(current.despesas.CUSTOS);
    const custosAnterior = sumValues(previous.despesas.CUSTOS);
    const lucroBruto = receitaLiquida + custos;
    const lucroBrutoAnterior = receitaLiquidaAnterior + custosAnterior;
    const opex = sumValues(current.despesas.OPEX);
    const opexAnterior = sumValues(previous.despesas.OPEX);
    const ebitda = lucroBruto + opex;
    const ebitdaAnterior = lucroBrutoAnterior + opexAnterior;
    const depreciacao = sumValues(current.despesas.DEPRECIACAO);
    const depreciacaoAnterior = sumValues(previous.despesas.DEPRECIACAO);
    const financeiro = sumValues(current.despesas.FINANCEIRO);
    const financeiroAnterior = sumValues(previous.despesas.FINANCEIRO);
    const resultadoFinal = ebitda + depreciacao + financeiro;
    const resultadoFinalAnterior = ebitdaAnterior + depreciacaoAnterior + financeiroAnterior;

    return [
      {
        codigo: '1', descricao: 'RECEITA BRUTA DE VENDAS E SERVIÇOS', tipo: 'TOTAL', nivel: 1,
        mesAtual: receitaBruta, mesAnterior: receitaBrutaAnterior, orcado: budget('1'),
        filhos: buildChildren('1', current.receitas, previous.receitas)
      },
      {
        codigo: '2', descricao: '(-) DEDUÇÕES DA RECEITA BRUTA & IMPOSTOS', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: deducoes, mesAnterior: deducoesAnterior, orcado: budget('2'),
        filhos: buildChildren('2', current.despesas.DEDUCOES, previous.despesas.DEDUCOES)
      },
      { codigo: '3', descricao: '(=) RECEITA LÍQUIDA OPERACIONAL', tipo: 'TOTAL', nivel: 1, mesAtual: receitaLiquida, mesAnterior: receitaLiquidaAnterior, orcado: budget('3') },
      {
        codigo: '4', descricao: '(-) CUSTO DOS SERVIÇOS PRESTADOS E PRODUTOS (CPV/CMV)', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: custos, mesAnterior: custosAnterior, orcado: budget('4'),
        filhos: buildChildren('4', current.despesas.CUSTOS, previous.despesas.CUSTOS)
      },
      { codigo: '5', descricao: '(=) LUCRO BRUTO OPERACIONAL', tipo: 'TOTAL', nivel: 1, mesAtual: lucroBruto, mesAnterior: lucroBrutoAnterior, orcado: budget('5') },
      {
        codigo: '6', descricao: '(-) DESPESAS OPERACIONAIS (OPEX)', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: opex, mesAnterior: opexAnterior, orcado: budget('6'),
        filhos: buildChildren('6', current.despesas.OPEX, previous.despesas.OPEX)
      },
      { codigo: '7', descricao: '(=) EBITDA (LUCRO ANTES DE JUROS, IMPOSTOS E DEPRECIAÇÃO)', tipo: 'TOTAL', nivel: 1, mesAtual: ebitda, mesAnterior: ebitdaAnterior, orcado: budget('7') },
      {
        codigo: '8', descricao: '(-) DEPRECIAÇÃO E AMORTIZAÇÃO', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: depreciacao, mesAnterior: depreciacaoAnterior, orcado: budget('8'),
        filhos: buildChildren('8', current.despesas.DEPRECIACAO, previous.despesas.DEPRECIACAO)
      },
      {
        codigo: '9', descricao: '(=) RESULTADO FINANCEIRO (RECEITAS - DESPESAS FINANCEIRAS)', tipo: 'SUBTOTAL', nivel: 1,
        mesAtual: financeiro, mesAnterior: financeiroAnterior, orcado: budget('9'),
        filhos: buildChildren('9', current.despesas.FINANCEIRO, previous.despesas.FINANCEIRO)
      },
      { codigo: '10', descricao: '(=) LUCRO LÍQUIDO DO EXERCÍCIO (RESULTADO FINAL)', tipo: 'TOTAL', nivel: 1, mesAtual: resultadoFinal, mesAnterior: resultadoFinalAnterior, orcado: budget('10') }
    ];
  }, [comparisonMonth, dreData, lancamentos, selectedMonth, unidadeDre]);

  const toggleExpand = (code: string) => {
    setExpandedNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const receitaBrutaAtual = calculatedDre.find((item) => item.codigo === '1')?.mesAtual || 0;
  const receitaBrutaBase = receitaBrutaAtual === 0 ? 1 : receitaBrutaAtual;
  const monthStatus = selectedMonth === currentReferenceMonth
    ? fechamentoMensal.status === 'FECHADO' ? 'FECHADO' : 'EM ANDAMENTO'
    : selectedMonth < currentReferenceMonth ? 'HISTÓRICO' : 'PLANEJADO';

  const renderDRERow = (item: DREItem) => {
    const isExpanded = expandedNodes[item.codigo];
    const hasChildren = Boolean(item.filhos?.length);
    const avPercent = (item.mesAtual / receitaBrutaBase) * 100;
    const momVarPercent = item.mesAnterior !== 0
      ? ((item.mesAtual - item.mesAnterior) / Math.abs(item.mesAnterior)) * 100
      : 0;
    const isTotal = item.tipo === 'TOTAL';
    const isSubtotal = item.tipo === 'SUBTOTAL';
    const currentValueColor = item.mesAtual < 0
      ? isTotal ? 'text-rose-300' : 'text-rose-600'
      : isTotal ? 'text-white' : 'text-[#0b1c30]';
    const comparisonColor = isTotal ? 'text-slate-100' : 'text-gray-600';
    const variationColor = momVarPercent > 0
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
            {momVarPercent >= 0 ? '+' : ''}{momVarPercent.toFixed(1)}%
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
            <span className="text-xs text-gray-500">Regime de Competência</span>
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

      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Demonstração do Resultado do Exercício — {formatCompetencia(selectedMonth)}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
            <span>Base Receita Bruta:</span>
            <span className="font-bold text-[#0b1c30]">R$ {receitaBrutaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
