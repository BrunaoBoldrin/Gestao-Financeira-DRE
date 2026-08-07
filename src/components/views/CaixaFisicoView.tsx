import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const CaixaFisicoView: React.FC = () => {
  const { sessaoCaixa, abrirCaixa, registrarMovimentacaoCaixa, fecharCaixa, canExecuteFinancialActions } = useApp();

  const [modalType, setModalType] = useState<'ABERTURA' | 'SANGRIA' | 'SUPRIMENTO' | 'VENDA' | 'FECHAMENTO' | null>(null);
  const [valorInput, setValorInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType) return;

    const val = parseFloat(valorInput);

    if (modalType === 'ABERTURA') {
      abrirCaixa(val);
    } else if (modalType === 'SANGRIA' || modalType === 'SUPRIMENTO' || modalType === 'VENDA') {
      registrarMovimentacaoCaixa(modalType, descricaoInput || modalType, val);
    } else if (modalType === 'FECHAMENTO') {
      fecharCaixa(val, observacaoFechamento);
    }

    setModalType(null);
    setValorInput('');
    setDescricaoInput('');
    setObservacaoFechamento('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                sessaoCaixa.status === 'ABERTO' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Status: {sessaoCaixa.status}
            </span>
            <span className="text-xs text-gray-500">• Operador: {sessaoCaixa.operadorAbertura}</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">point_of_sale</span>
            Controle Diário de Caixa Físico (Recepção)
          </h2>
        </div>

        {canExecuteFinancialActions && (sessaoCaixa.status === 'ABERTO' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalType('SANGRIA');
                setDescricaoInput('Sangria de Caixa / Depósito');
              }}
              className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs font-bold hover:bg-rose-100 transition"
            >
              Sangria (-)
            </button>
            <button
              onClick={() => {
                setModalType('SUPRIMENTO');
                setDescricaoInput('Reforço de Troco');
              }}
              className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold hover:bg-emerald-100 transition"
            >
              Reforço (+)
            </button>
            <button
              onClick={() => {
                setModalType('VENDA');
                setDescricaoInput('Venda Dinheiro Dermocosméticos');
              }}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs font-bold hover:bg-blue-100 transition"
            >
              Venda Dinheiro (+)
            </button>

            <button
              onClick={() => setModalType('FECHAMENTO')}
              className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] transition shadow-xs"
            >
              Fechar Caixa do Dia
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setModalType('ABERTURA');
              setValorInput('500');
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
          >
            Abrir Caixa Diário
          </button>
        ))}
      </div>

      {/* KPI Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Fundo Inicial Troco</p>
          <p className="text-xl font-extrabold text-[#0b1c30] mt-0.5">
            R$ {sessaoCaixa.saldoInicial.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Entradas Dinheiro (+)</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
            R$ {sessaoCaixa.entradasDinheiro.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
          <p className="text-[10px] font-bold text-rose-600 uppercase">Saídas / Sangrias (-)</p>
          <p className="text-xl font-extrabold text-rose-700 mt-0.5">
            R$ {sessaoCaixa.saidasDinheiro.toFixed(2)}
          </p>
        </div>

        <div className="bg-[#eff4ff] p-4 rounded-xl border border-[#d3e4fe]">
          <p className="text-[10px] font-bold text-[#131b2e] uppercase">Saldo Esperado em Gaveta</p>
          <p className="text-xl font-black text-[#0b1c30] mt-0.5">
            R$ {sessaoCaixa.saldoEsperado.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Closed Session Audit Result if Fechado */}
      {sessaoCaixa.status === 'FECHADO' && sessaoCaixa.saldoContado !== undefined && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2">
          <h3 className="text-sm font-bold text-[#0b1c30]">Resultado do Fechamento de Caixa</h3>
          <div className="grid grid-cols-3 gap-4 text-xs pt-2">
            <div>
              <span className="text-gray-500">Saldo Esperado:</span>
              <p className="font-bold text-[#0b1c30]">R$ {sessaoCaixa.saldoEsperado.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-500">Saldo Contado Fisicamente:</span>
              <p className="font-bold text-[#0b1c30]">R$ {sessaoCaixa.saldoContado.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-500">Divergência / Sobra (Falta):</span>
              <p
                className={`font-black ${
                  (sessaoCaixa.divergencia || 0) === 0
                    ? 'text-emerald-600'
                    : (sessaoCaixa.divergencia || 0) > 0
                    ? 'text-blue-600'
                    : 'text-rose-600'
                }`}
              >
                R$ {(sessaoCaixa.divergencia || 0).toFixed(2)}
              </p>
            </div>
          </div>
          {sessaoCaixa.observacaoFechamento && (
            <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded">
              Obs: {sessaoCaixa.observacaoFechamento}
            </p>
          )}
        </div>
      )}

      {/* Movements History Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Movimentações do Caixa do Dia
          </h3>
          <span className="text-xs text-gray-500">{sessaoCaixa.movimentacoes.length} Lançamentos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Operação</th>
                <th className="p-3">Descrição / Histórico</th>
                <th className="p-3">Operador</th>
                <th className="p-3 text-right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessaoCaixa.movimentacoes.map((mov) => {
                const isEntrada = mov.tipo === 'SUPRIMENTO' || mov.tipo === 'VENDA';
                return (
                  <tr key={mov.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-mono text-gray-500">{mov.dataHora}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-[#0b1c30]">{mov.descricao}</td>
                    <td className="p-3 text-gray-600">{mov.usuario}</td>
                    <td
                      className={`p-3 text-right font-black ${
                        isEntrada ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isEntrada ? '+' : '-'} R$ {mov.valor.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Actions */}
      {canExecuteFinancialActions && modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {modalType === 'ABERTURA'
                  ? 'Abertura de Caixa Diário'
                  : modalType === 'FECHAMENTO'
                  ? 'Fechamento & Contagem Física'
                  : `Movimentação de ${modalType}`}
              </h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              {modalType !== 'FECHAMENTO' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {modalType === 'ABERTURA' ? 'Valor Fundo de Troco (R$)' : 'Valor (R$)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                    />
                  </div>

                  {modalType !== 'ABERTURA' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição / Comprovante</label>
                      <input
                        type="text"
                        required
                        value={descricaoInput}
                        onChange={(e) => setDescricaoInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                    <p className="font-bold text-blue-900">Saldo Esperado pelo Sistema:</p>
                    <p className="text-lg font-black text-[#0b1c30]">R$ {sessaoCaixa.saldoEsperado.toFixed(2)}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Saldo Contado em Dinheiro / Gaveta (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Informe o valor contado"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-black text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Observações de Fechamento</label>
                    <textarea
                      rows={2}
                      placeholder="Justificativa de divergência caso haja"
                      value={observacaoFechamento}
                      onChange={(e) => setObservacaoFechamento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                    ></textarea>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30]"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
