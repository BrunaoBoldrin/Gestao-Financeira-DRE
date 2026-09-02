import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { normalizeDateValue } from '../../utils/dateRange';
import { LiquidacaoModal, type ItemLiquidacao } from '../modals/LiquidacaoModal';

interface ParcelamentosViewProps {
  onOpenNovoParcelamentoModal: () => void;
}

export const ParcelamentosView: React.FC<ParcelamentosViewProps> = ({ onOpenNovoParcelamentoModal }) => {
  const { filteredParcelamentos, pagarParcela, canExecuteFinancialActions } = useApp();
  const [selectedParcelamentoId, setSelectedParcelamentoId] = useState<string>('');
  const [parcelaLiquidacao, setParcelaLiquidacao] = useState<{
    parcelamentoId: string;
    numeroParcela: number;
    item: ItemLiquidacao;
  } | null>(null);

  const activeContract = filteredParcelamentos.find((p) => p.id === selectedParcelamentoId) || filteredParcelamentos[0];
  const { sortedItems: sortedCronograma, sortConfig, requestSort } = useSortableData(activeContract?.cronograma || []);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">view_kanban</span>
            Gestão de Parcelamentos & Contratos de Longo Prazo
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Acompanhamento de compras amortizadas, cronograma de parcelas e liquidação automatizada.
          </p>
        </div>

        {canExecuteFinancialActions && <button
          onClick={onOpenNovoParcelamentoModal}
          className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] flex items-center gap-1.5 transition shadow-xs"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Novo Parcelamento
        </button>}
      </div>

      {/* Contracts Selector & Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contracts List Side */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Contratos em Andamento ({filteredParcelamentos.length})
          </h3>

          {filteredParcelamentos.map((p) => {
            const progressoPct = Math.round((p.parcelasPagas / p.numeroParcelas) * 100);
            const isSelected = p.id === activeContract?.id;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedParcelamentoId(p.id)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? 'bg-white border-[#C5A059] shadow-md ring-2 ring-[#C5A059]/20'
                    : 'bg-white border-[#e5eeff] hover:bg-[#f8f9ff]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-xs font-bold text-[#0b1c30] truncate">{p.titulo}</h4>
                  <span className="text-[10px] font-bold text-[#775a19] bg-[#ffdea5] px-1.5 py-0.2 rounded shrink-0">
                    {p.parcelasPagas}/{p.numeroParcelas} Pagas
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-1">{p.fornecedor}</p>
                <p className="text-sm font-black text-[#0b1c30]">
                  R$ {p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-500 font-semibold mb-1">
                    <span>Progresso de Amortização</span>
                    <span>{progressoPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C5A059] rounded-full transition-all duration-300"
                      style={{ width: `${progressoPct}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Contract Details & Schedule Table */}
        {activeContract && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-[#775a19] bg-[#ffdea5] px-2 py-0.5 rounded uppercase tracking-wider">
                  Detalhamento do Contrato
                </span>
                <h3 className="text-base font-extrabold text-[#0b1c30] mt-1">
                  {activeContract.titulo}
                </h3>
                <p className="text-xs text-gray-500">
                  Fornecedor: {activeContract.fornecedor} • Categoria: {activeContract.categoria}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-semibold uppercase">Valor de Cada Parcela</p>
                <p className="text-lg font-black text-rose-700">
                  R$ {activeContract.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Installments Schedule Table */}
            <div>
              <h4 className="text-xs font-bold text-[#0b1c30] mb-2 uppercase tracking-wider">
                Cronograma Geral de Parcelas ({activeContract.numeroParcelas} Meses)
              </h4>

              <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9ff] text-gray-700 font-bold uppercase text-[10px]">
                      <SortableTableHeader label="Nº Parcela" sortKey="parcela" accessor={(item) => item.numero} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                      <SortableTableHeader label="Data Vencimento" sortKey="vencimento" accessor={(item) => normalizeDateValue(item.vencimento)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                      <SortableTableHeader label="Valor Parcela" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                      <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.status} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-center" />
                      <SortableTableHeader label="Conta / Forma" sortKey="conta" accessor={(item) => `${item.contaBancaria || ''} ${item.formaPagamento || ''}`} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                      {canExecuteFinancialActions && <th className="p-3 text-center">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedCronograma.map((item) => (
                      <tr
                        key={item.numero}
                        className={item.status === 'PAGO' ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}
                      >
                        <td className="p-3 font-bold text-[#0b1c30]">
                          Parcela {item.numero}/{activeContract.numeroParcelas}
                        </td>
                        <td className="p-3 font-medium text-gray-600">{item.vencimento}</td>
                        <td className="p-3 text-right font-black text-[#0b1c30]">
                          R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'PAGO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-gray-600">
                          {item.status === 'PAGO'
                            ? <><span className="block font-bold text-[#0b1c30]">{item.contaBancaria || activeContract.contaBancaria || 'Conta não informada'}</span><span>{item.unidadeConta ? `${item.unidadeConta} · ` : ''}{item.formaPagamento || 'Forma não informada'}</span></>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        {canExecuteFinancialActions && <td className="p-3 text-center">
                          {item.status === 'PENDENTE' ? (
                            <button
                              onClick={() => setParcelaLiquidacao({
                                parcelamentoId: activeContract.id,
                                numeroParcela: item.numero,
                                item: {
                                  titulo: `Parcela ${item.numero}/${activeContract.numeroParcelas} - ${activeContract.titulo}`,
                                  contraparte: activeContract.fornecedor,
                                  tipo: 'DESPESA',
                                  valor: item.valor,
                                  unidade: activeContract.unidade
                                }
                              })}
                              className="px-3 py-1 bg-[#131b2e] text-white rounded text-[11px] font-bold hover:bg-[#0b1c30] transition shadow-xs"
                            >
                              Pagar Parcela
                            </button>
                          ) : (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-0.5">
                              <span className="material-symbols-outlined text-sm">check</span>
                              {item.dataPagamento}
                            </span>
                          )}
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <LiquidacaoModal
        item={parcelaLiquidacao?.item || null}
        onClose={() => setParcelaLiquidacao(null)}
        onConfirm={(dados) => {
          if (!parcelaLiquidacao) return;
          pagarParcela(parcelaLiquidacao.parcelamentoId, parcelaLiquidacao.numeroParcela, dados);
          setParcelaLiquidacao(null);
        }}
      />
    </div>
  );
};
