import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DREItem } from '../../types';

export const DREGerencialView: React.FC = () => {
  const { dreData, showToast } = useApp();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '4': true,
    '6': true,
    '9': true
  });

  const toggleExpand = (code: string) => {
    setExpandedNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // Receita Bruta base for Vertical Analysis (AV %)
  const receitaBrutaBase = dreData.find((d) => d.codigo === '1')?.mesAtual || 1;

  const renderDRERow = (item: DREItem) => {
    const isExpanded = expandedNodes[item.codigo];
    const hasChildren = item.filhos && item.filhos.length > 0;

    // Calculations
    const avPercent = (item.mesAtual / receitaBrutaBase) * 100;
    const momVarPercent = item.mesAnterior !== 0 ? ((item.mesAtual - item.mesAnterior) / Math.abs(item.mesAnterior)) * 100 : 0;

    const isTotal = item.tipo === 'TOTAL';
    const isSubtotal = item.tipo === 'SUBTOTAL';

    return (
      <React.Fragment key={item.codigo}>
        <tr
          className={`transition ${
            isTotal
              ? 'bg-[#0b1c30] text-white font-extrabold border-y border-[#1a2e46]'
              : isSubtotal
              ? 'bg-[#eff4ff] text-[#0b1c30] font-bold border-y border-[#d3e4fe]'
              : 'hover:bg-gray-50 border-b border-gray-100 text-gray-800'
          }`}
        >
          {/* Código e Descrição */}
          <td className="p-3" style={{ paddingLeft: `${item.nivel * 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(item.codigo)}
                  className={`p-0.5 rounded transition ${
                    isTotal ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {isExpanded ? 'expand_more' : 'chevron_right'}
                  </span>
                </button>
              ) : (
                <span className="w-5"></span>
              )}

              <span className="font-mono text-[11px] opacity-75">{item.codigo}</span>
              <span className="truncate">{item.descricao}</span>
            </div>
          </td>

          {/* Mês Atual (Mai/2024) */}
          <td
            className={`p-3 text-right font-mono font-bold ${
              item.mesAtual < 0 && !isTotal ? 'text-rose-600' : ''
            }`}
          >
            R$ {item.mesAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </td>

          {/* Análise Vertical % */}
          <td className="p-3 text-right font-mono text-[11px] font-semibold">
            {avPercent.toFixed(1)}%
          </td>

          {/* Mês Anterior (Abr/2024) */}
          <td className="p-3 text-right font-mono text-gray-600">
            R$ {item.mesAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </td>

          {/* Variação MoM % */}
          <td
            className={`p-3 text-right font-mono font-bold text-[11px] ${
              momVarPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {momVarPercent >= 0 ? '+' : ''}
            {momVarPercent.toFixed(1)}%
          </td>

          {/* Orçado */}
          <td className="p-3 text-right font-mono text-gray-500">
            R$ {item.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </td>
        </tr>

        {/* Render children if expanded */}
        {hasChildren &&
          isExpanded &&
          item.filhos!.map((child) => renderDRERow(child))}
      </React.Fragment>
    );
  };

  const handleExportPDF = () => {
    showToast('Relatório DRE Gerencial exportado em PDF de alta resolução!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#C5A059] text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">
              Regra NBC TG 26
            </span>
            <span className="text-xs text-gray-500">Regime de Competência</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">analytics</span>
            DRE Gerencial Hierárquico Expansível
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] flex items-center gap-1.5 transition shadow-xs"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            Exportar Relatório PDF
          </button>
        </div>
      </div>

      {/* DRE Table Container */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Demonstração do Resultado do Exercício (Maio / 2024)
          </h3>

          <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
            <span>Base Receita Bruta:</span>
            <span className="font-bold text-[#0b1c30]">
              R$ {receitaBrutaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3 w-1/3">Conta / Estrutura DRE</th>
                <th className="p-3 text-right">Maio / 2024 (Real)</th>
                <th className="p-3 text-right">A.V. %</th>
                <th className="p-3 text-right">Abril / 2024 (Ant)</th>
                <th className="p-3 text-right">Var MoM %</th>
                <th className="p-3 text-right">Orçado (Meta)</th>
              </tr>
            </thead>
            <tbody>{dreData.map((item) => renderDRERow(item))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
