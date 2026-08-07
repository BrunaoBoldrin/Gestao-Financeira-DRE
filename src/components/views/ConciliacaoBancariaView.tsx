import React from 'react';
import { useApp } from '../../context/AppContext';

export const ConciliacaoBancariaView: React.FC = () => {
  const { extratoBanco, lancamentos, conciliarExtrato } = useApp();

  const naoConciliados = extratoBanco.filter((e) => !e.conciliado);
  const conciliados = extratoBanco.filter((e) => e.conciliado);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">sync_alt</span>
            Conciliação Bancária Automatizada (Match Split-View)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cruzamento direto do extrato bancário (OFX/Open Banking) com os lançamentos do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[#eff4ff] border border-[#d3e4fe] px-3 py-1.5 rounded-lg text-xs font-bold text-[#0b1c30]">
            Pendente: {naoConciliados.length} Itens
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800">
            Conciliado: {conciliados.length} Itens
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Bank Statement OFX */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#131b2e]">account_balance</span>
              <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                Extrato Bancário (Itaú Uniclass C/C 45892-1)
              </h3>
            </div>
            <span className="text-[10px] font-bold bg-[#eff4ff] text-[#0b1c30] px-2 py-0.5 rounded">
              OFX Importado
            </span>
          </div>

          <div className="space-y-3">
            {extratoBanco.map((item) => {
              const matchedLancamento = item.sugestaoMatchId
                ? lancamentos.find((l) => l.id === item.sugestaoMatchId)
                : null;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition ${
                    item.conciliado
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : 'bg-white border-[#d3e4fe] shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-gray-400">{item.data} • Doc: {item.documento}</span>
                      <p className="text-xs font-bold text-[#0b1c30]">{item.descricao}</p>
                    </div>

                    <p
                      className={`text-sm font-black ${
                        item.valor > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {item.valor > 0 ? '+' : ''} R${' '}
                      {Math.abs(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Suggestion & Match Box */}
                  {!item.conciliado && matchedLancamento && (
                    <div className="mt-3 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="text-[11px]">
                        <div className="flex items-center gap-1 text-blue-900 font-bold">
                          <span className="material-symbols-outlined text-sm text-blue-600">auto_awesome</span>
                          <span>Sugestão Match ({item.scoreMatch}% Relevância):</span>
                        </div>
                        <p className="text-gray-700 mt-0.5">
                          {matchedLancamento.descricao} ({matchedLancamento.fornecedorCliente})
                        </p>
                      </div>

                      <button
                        onClick={() => conciliarExtrato(item.id, matchedLancamento.id)}
                        className="px-3 py-1 bg-[#131b2e] text-white rounded text-[11px] font-bold hover:bg-[#0b1c30] shadow-xs transition shrink-0"
                      >
                        Conciliar
                      </button>
                    </div>
                  )}

                  {item.conciliado && (
                    <div className="mt-2 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      <span>Item Conciliado com Sucesso</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Registered System Entries */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#C5A059]">receipt_long</span>
              <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                Lançamentos Registrados no Sistema
              </h3>
            </div>
            <span className="text-[10px] font-bold bg-[#ffdea5] text-[#775a19] px-2 py-0.5 rounded">
              Contabilidade Interna
            </span>
          </div>

          <div className="space-y-3">
            {lancamentos.map((l) => (
              <div
                key={l.id}
                className="p-3.5 bg-white border border-[#e5eeff] rounded-xl shadow-xs flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-gray-400">{l.dataVencimento}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        l.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {l.tipo}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0b1c30]">{l.descricao}</p>
                  <p className="text-[10px] text-gray-500">{l.fornecedorCliente} • {l.contaBancaria}</p>
                </div>

                <div className="text-right">
                  <p
                    className={`text-xs font-black ${
                      l.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <span
                    className={`text-[10px] font-bold ${
                      l.status === 'PAGO' ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
