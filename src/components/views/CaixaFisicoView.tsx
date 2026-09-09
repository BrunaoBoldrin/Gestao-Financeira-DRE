import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { normalizeDateValue } from '../../utils/dateRange';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const CaixaFisicoView: React.FC = () => {
  const {
    sessaoCaixa,
    bancos,
    units,
    selectedUnit,
    setSelectedUnit,
    currentUser,
    isFinance,
  } = useApp();

  const unidadeInicial = isFinance && currentUser
    ? currentUser.unit
    : selectedUnit !== 'Todas as Unidades'
      ? selectedUnit
      : units.find((unit) => unit.ativa)?.nome || '';
  const [unidadeCaixa, setUnidadeCaixa] = useState(unidadeInicial);
  useEffect(() => {
    if (isFinance && currentUser) {
      setUnidadeCaixa(currentUser.unit);
    } else if (selectedUnit !== 'Todas as Unidades') {
      setUnidadeCaixa(selectedUnit);
    }
  }, [currentUser, isFinance, selectedUnit]);

  const contasUnidade = bancos.filter((banco) => banco.ativo && banco.unidade === unidadeCaixa);
  const contaCaixa = contasUnidade.find((banco) => banco.banco.toLowerCase().includes('caixa'));
  const movimentacoesDaUnidade = useMemo(
    () => sessaoCaixa.movimentacoes.filter((movimento) => movimento.unidade === unidadeCaixa),
    [sessaoCaixa.movimentacoes, unidadeCaixa]
  );
  const totalEntradas = movimentacoesDaUnidade
    .filter((movimento) => movimento.sentido === 'ENTRADA')
    .reduce((total, movimento) => total + movimento.valor, 0);
  const totalSaidas = movimentacoesDaUnidade
    .filter((movimento) => movimento.sentido === 'SAIDA')
    .reduce((total, movimento) => total + movimento.valor, 0);
  const ultimaMovimentacao = [...movimentacoesDaUnidade].sort((a, b) => b.dataHora.localeCompare(a.dataHora))[0];
  const { sortedItems: sortedMovimentacoes, sortConfig, requestSort } = useSortableData(movimentacoesDaUnidade);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">Saldo contínuo</span>
            <span className="text-xs text-gray-500">Sem abertura ou fechamento diário</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">point_of_sale</span>
            Caixa Físico por Unidade
          </h2>
          <p className="text-xs text-gray-500 mt-1">Entradas somam e saídas subtraem do saldo atual. Sangrias não alteram o DRE por si só.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {!isFinance && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Unidade do caixa</label>
              <select value={unidadeCaixa} onChange={(event) => { setUnidadeCaixa(event.target.value); setSelectedUnit(event.target.value); }} className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white">
                {units.filter((unit) => unit.ativa).map((unit) => <option key={unit.id} value={unit.nome}>{unit.nome}</option>)}
              </select>
            </div>
          )}

        </div>
      </div>

      {!contaCaixa ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          <strong>Nenhum Caixa Físico ativo para {unidadeCaixa || 'a unidade selecionada'}.</strong>
          <p className="text-xs mt-1">Um administrador deve cadastrar uma conta cujo nome contenha “Caixa” e vinculá-la à unidade.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#eff4ff] p-4 rounded-xl border border-[#d3e4fe]">
            <p className="text-[10px] font-bold text-[#131b2e] uppercase">Saldo disponível agora</p>
            <p className="text-xl font-black text-[#0b1c30] mt-0.5">{formatCurrency(contaCaixa.saldo)}</p>
            <p className="text-[10px] text-gray-500 mt-1">{contaCaixa.banco} · {unidadeCaixa}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Entradas registradas</p>
            <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{formatCurrency(totalEntradas)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-rose-600 uppercase">Saídas registradas</p>
            <p className="text-xl font-extrabold text-rose-700 mt-0.5">{formatCurrency(totalSaidas)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Última movimentação</p>
            <p className="text-sm font-extrabold text-[#0b1c30] mt-1">{ultimaMovimentacao?.tipo || 'Sem movimentações'}</p>
            <p className="text-[10px] text-gray-500 mt-1">{ultimaMovimentacao?.dataHora || '—'}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex flex-wrap items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Histórico contínuo do Caixa Físico</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{unidadeCaixa}</p>
          </div>
          <span className="text-xs text-gray-500">{movimentacoesDaUnidade.length} movimentação(ões)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Data / Hora" sortKey="data" accessor={(item) => normalizeDateValue(item.dataHora) || item.dataHora} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Operação" sortKey="operacao" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição / Histórico" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Finalidade" sortKey="finalidade" accessor={(item) => item.finalidade || ''} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Operador" sortKey="operador" accessor={(item) => item.usuario} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Movimento" sortKey="valor" accessor={(item) => item.sentido === 'ENTRADA' ? item.valor : -item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Saldo após" sortKey="saldo" accessor={(item) => item.saldoApos ?? 0} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMovimentacoes.map((movimento) => {
                const isEntrada = movimento.sentido === 'ENTRADA';
                return (
                  <tr key={movimento.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-mono text-gray-500">{movimento.dataHora}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{movimento.tipo}</span></td>
                    <td className="p-3 font-medium text-[#0b1c30]">
                      {movimento.descricao}
                      {movimento.comprovanteRef && <a href={movimento.comprovanteRef} target="_blank" rel="noreferrer" className="block mt-1 text-[10px] text-blue-700 hover:underline">Abrir anexo</a>}
                    </td>
                    <td className="p-3 text-[10px] font-semibold text-gray-700">{(movimento.finalidade || 'OUTRO').replaceAll('_', ' ')}</td>
                    <td className="p-3 text-gray-600">{movimento.usuario}</td>
                    <td className={`p-3 text-right font-black ${isEntrada ? 'text-emerald-700' : 'text-rose-700'}`}>{isEntrada ? '+' : '−'} {formatCurrency(movimento.valor)}</td>
                    <td className="p-3 text-right font-black text-[#0b1c30]">{movimento.saldoApos === undefined ? '—' : formatCurrency(movimento.saldoApos)}</td>
                  </tr>
                );
              })}
              {sortedMovimentacoes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhuma movimentação registrada para esta unidade.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};
