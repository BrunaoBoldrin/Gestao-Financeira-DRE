import React from 'react';
import { useApp } from '../../context/AppContext';

export const MaquininhasView: React.FC = () => {
  const { recebiveisMaquininhas } = useApp();

  const totalBruto = recebiveisMaquininhas.reduce((a, b) => a + b.valorBruto, 0);
  const totalLiquido = recebiveisMaquininhas.reduce((a, b) => a + b.valorLiquido, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">credit_card</span>
            Auditoria de Recebíveis de Maquininhas (Cartões de Crédito / Débito)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Conferência automatizada de taxas contratadas vs aplicadas pelas adquirentes (Stone, Rede, Cielo).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#f8f9ff] border border-[#d3e4fe] p-2.5 rounded-lg text-right">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Volume Bruto Processado</p>
            <p className="text-sm font-black text-[#0b1c30]">
              R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-right">
            <p className="text-[10px] font-bold text-emerald-800 uppercase">Líquido a Receber</p>
            <p className="text-sm font-black text-emerald-950">
              R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Receivables */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Lote de Vendas e Auditoria de Taxas de Adquirente
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Adquirente</th>
                <th className="p-3">Bandeira / Modalidade</th>
                <th className="p-3">Data Venda</th>
                <th className="p-3">Previsão Repasse</th>
                <th className="p-3 text-right">Valor Bruto</th>
                <th className="p-3 text-center">Taxa Contratada</th>
                <th className="p-3 text-center">Taxa Aplicada</th>
                <th className="p-3 text-right">Valor Líquido</th>
                <th className="p-3 text-center">Status Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recebiveisMaquininhas.map((item) => {
                const isDivergente = item.taxaAplicada > item.taxaContratada;

                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-[#0b1c30]">{item.adquirente}</td>
                    <td className="p-3 text-gray-700">
                      {item.bandeira} - {item.modalidade.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3 font-mono text-gray-600">{item.dataVenda}</td>
                    <td className="p-3 font-mono text-gray-600">{item.dataPrevisao}</td>
                    <td className="p-3 text-right font-bold text-[#0b1c30]">
                      R$ {item.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-bold text-gray-700">{item.taxaContratada}%</td>
                    <td
                      className={`p-3 text-center font-bold ${
                        isDivergente ? 'text-rose-700 bg-rose-50' : 'text-emerald-700'
                      }`}
                    >
                      {item.taxaAplicada}%
                    </td>
                    <td className="p-3 text-right font-black text-emerald-700">
                      R$ {item.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDivergente
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'PAGO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isDivergente ? 'Divergência de Taxa' : item.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
