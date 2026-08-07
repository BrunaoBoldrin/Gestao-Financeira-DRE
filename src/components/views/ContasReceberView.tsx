import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const ContasReceberView: React.FC = () => {
  const { lancamentos, marcarLancamentoComoPago } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const contasReceber = lancamentos.filter((l) => l.tipo === 'RECEITA' && l.status === 'PENDENTE');

  const filtered = contasReceber.filter(
    (c) =>
      c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.fornecedorCliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProximasEntradas = contasReceber.reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">account_balance_wallet</span>
            Painel de Contas a Receber (Entradas Previstas)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Projeção e recebimento de parcelas de tratamentos estéticos e boletos emitidos para pacientes.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg text-right">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total A Receber Previsto</p>
          <p className="text-lg font-black text-emerald-950">
            R$ {totalProximasEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
              placeholder="Buscar paciente ou procedimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
            />
          </div>

          <span className="text-xs font-semibold text-gray-500">
            {filtered.length} Títulos a Receber
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Data Venc.</th>
                <th className="p-3">Paciente / Devedor</th>
                <th className="p-3">Procedimento / Venda</th>
                <th className="p-3">Forma Pgto</th>
                <th className="p-3 text-right">Valor Previsto (R$)</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-bold text-emerald-700">{item.dataVencimento}</td>
                  <td className="p-3 font-bold text-[#0b1c30]">{item.fornecedorCliente}</td>
                  <td className="p-3 font-medium text-gray-800">{item.descricao}</td>
                  <td className="p-3 text-gray-600">{item.formaPagamento}</td>
                  <td className="p-3 text-right font-black text-emerald-700">
                    R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => marcarLancamentoComoPago(item.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700 transition shadow-xs"
                    >
                      Confirmar Recebimento
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 text-xs">
                    Nenhum recebível pendente encontrado.
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
