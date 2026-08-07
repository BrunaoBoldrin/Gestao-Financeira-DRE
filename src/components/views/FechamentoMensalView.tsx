import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const FechamentoMensalView: React.FC = () => {
  const {
    fechamentoMensal,
    toggleChecklistItemFechamento,
    travarFechamentoMensal,
    reabrirFechamentoMensal
  } = useApp();

  const [mostrarConfirmacaoTrava, setMostrarConfirmacaoTrava] = useState(false);

  const totalConcluido = fechamentoMensal.checklist.filter((c) => c.concluido).length;
  const totalItens = fechamentoMensal.checklist.length;
  const progressoChecklistPct = Math.round((totalConcluido / totalItens) * 100);

  const totalProvisoes = fechamentoMensal.provisoesDepreciacao.reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                fechamentoMensal.status === 'FECHADO'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              Status Competência {fechamentoMensal.mesAno}: {fechamentoMensal.status}
            </span>
            {fechamentoMensal.fechadoPor && (
              <span className="text-xs text-gray-500">• Travado por {fechamentoMensal.fechadoPor}</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">lock_clock</span>
            Fechamento Mensal e Consolidação Contábil
          </h2>
        </div>

        {fechamentoMensal.status !== 'FECHADO' ? (
          <button
            onClick={() => setMostrarConfirmacaoTrava(true)}
            disabled={progressoChecklistPct < 100}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              progressoChecklistPct === 100
                ? 'bg-[#131b2e] text-white hover:bg-[#0b1c30] shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-base">lock</span>
            Aprovar & Travar Período
          </button>
        ) : (
          <button
            onClick={reabrirFechamentoMensal}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">lock_open</span>
            Reabrir Competência para Edição
          </button>
        )}
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Checklist */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                Checklist Obrigatório de Validação ({totalConcluido}/{totalItens})
              </h3>
              <p className="text-[11px] text-gray-500">
                Todos os itens devem ser conferidos antes de travar o mês.
              </p>
            </div>
            <span className="text-xs font-black text-[#131b2e] bg-[#eff4ff] px-2.5 py-1 rounded">
              {progressoChecklistPct}% Concluído
            </span>
          </div>

          <div className="space-y-2.5">
            {fechamentoMensal.checklist.map((chk) => (
              <div
                key={chk.id}
                onClick={() =>
                  fechamentoMensal.status !== 'FECHADO' && toggleChecklistItemFechamento(chk.id)
                }
                className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                  chk.concluido
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                      chk.concluido ? 'bg-emerald-600 text-white' : 'border border-gray-300 bg-white'
                    }`}
                  >
                    {chk.concluido && <span className="material-symbols-outlined text-sm">check</span>}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      chk.concluido ? 'text-emerald-950 line-through' : 'text-[#0b1c30]'
                    }`}
                  >
                    {chk.item}
                  </span>
                </div>

                {chk.responsavel && (
                  <span className="text-[10px] text-gray-500 font-medium">{chk.responsavel}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Provisões & Depreciação */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                Ajustes de Provisões & Depreciação
              </h3>
              <p className="text-[11px] text-gray-500">Lançamentos contábeis para apuração do DRE.</p>
            </div>

            <p className="text-sm font-black text-rose-700">
              R$ {totalProvisoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-2.5">
            {fechamentoMensal.provisoesDepreciacao.map((p, idx) => (
              <div key={idx} className="p-3 bg-[#f8f9ff] border border-[#d3e4fe] rounded-lg text-xs space-y-1">
                <div className="flex justify-between items-center font-bold text-[#0b1c30]">
                  <span>{p.descricao}</span>
                  <span className="text-rose-700">
                    R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">Categoria DRE: {p.categoria}</p>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
            <strong>Atenção:</strong> Ao travar a competência, nenhum usuário poderá criar, editar ou excluir lançamentos financeiros com data do mês de {fechamentoMensal.mesAno}.
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {mostrarConfirmacaoTrava && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <span className="material-symbols-outlined text-3xl">lock</span>
              <h3 className="font-bold text-base text-[#0b1c30]">Confirmar Trava do Mês?</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Você está prestes a congelar e travar o mês de <strong>{fechamentoMensal.mesAno}</strong>. Todas as receitas, despesas e relatórios contábeis serão consolidados.
            </p>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setMostrarConfirmacaoTrava(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  travarFechamentoMensal();
                  setMostrarConfirmacaoTrava(false);
                }}
                className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30]"
              >
                Sim, Travar Período
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
