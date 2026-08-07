import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const ContasPagarView: React.FC = () => {
  const { lancamentos, marcarLancamentoComoPago } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const contasPagar = lancamentos.filter((l) => l.tipo === 'DESPESA' && l.status === 'PENDENTE');

  const filtered = contasPagar.filter(
    (c) =>
      c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.fornecedorCliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProximosVencimentos = contasPagar.reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600">payments</span>
            Painel de Contas a Pagar (Compromissos Pendentes)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Visão focada nos títulos pendentes de liquidação organizados por data de vencimento.
          </p>
        </div>

        <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg text-right">
          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Total Pendente a Vencer</p>
          <p className="text-lg font-black text-rose-950">
            R$ {totalProximosVencimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex items-center justify-between">
          <div className="relative w-72">
            <span className="material-symbols-outlined text-gray-400 absolute left-2.5 top-2.5 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar título pendente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
            />
          </div>

          <span className="text-xs font-semibold text-gray-500">
            {filtered.length} Títulos Pendentes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Data Venc.</th>
                <th className="p-3">Fornecedor / Credor</th>
                <th className="p-3">Descrição do Título</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Forma Pgto</th>
                <th className="p-3 text-right">Valor (R$)</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-bold text-rose-700">{item.dataVencimento}</td>
                  <td className="p-3 font-bold text-[#0b1c30]">{item.fornecedorCliente}</td>
                  <td className="p-3 font-medium text-gray-800">{item.descricao}</td>
                  <td className="p-3 text-gray-600">{item.categoria}</td>
                  <td className="p-3 text-gray-600">{item.formaPagamento}</td>
                  <td className="p-3 text-right font-black text-rose-700">
                    R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => marcarLancamentoComoPago(item.id)}
                      className="px-3 py-1 bg-[#131b2e] text-white rounded text-[11px] font-bold hover:bg-[#0b1c30] transition shadow-xs"
                    >
                      Liquidar
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 text-xs">
                    Nenhum título pendente encontrado no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
