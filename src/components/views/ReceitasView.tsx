import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface ReceitasViewProps {
  onOpenNovoLancamentoModal: () => void;
}

export const ReceitasView: React.FC<ReceitasViewProps> = ({ onOpenNovoLancamentoModal }) => {
  const { filteredLancamentos, marcarLancamentoComoPago, deleteLancamento, isAuditor, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  const receitas = filteredLancamentos.filter((l) => l.tipo === 'RECEITA');

  const filteredReceitas = receitas.filter((r) => {
    const matchesSearch =
      r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fornecedorCliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'TODOS' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPago = receitas.filter((r) => r.status === 'PAGO').reduce((a, b) => a + b.valor, 0);
  const totalPendente = receitas.filter((r) => r.status === 'PENDENTE').reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-6">
      {/* Header & KPI cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">trending_up</span>
            Controle de Receitas & Entradas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestão de faturamento de procedimentos, vendas de dermocosméticos e recebimentos.
          </p>
        </div>

        {!isAuditor && <button
          onClick={() => {
            if (isAuditor) {
              showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
              return;
            }
            onOpenNovoLancamentoModal();
          }}
          disabled={isAuditor}
          title={isAuditor ? 'Ação restrita ao Financeiro/Administrador' : undefined}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
            isAuditor
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#131b2e] text-white hover:bg-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Nova Receita
        </button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Receitas Realizadas (Pagas)
            </p>
            <p className="text-2xl font-black text-emerald-950 mt-1">
              R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              A Receber / Pendente
            </p>
            <p className="text-2xl font-black text-amber-950 mt-1">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="material-symbols-outlined text-amber-600 text-3xl">hourglass_empty</span>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined text-gray-400 absolute left-2.5 top-2.5 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por descrição ou paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-semibold text-[#0b1c30]"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PAGO">Pago</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Data Venc.</th>
                <th className="p-3">Paciente / Cliente</th>
                <th className="p-3">Descrição do Procedimento</th>
                <th className="p-3">Forma Pgto</th>
                <th className="p-3">Conta Destino</th>
                <th className="p-3">Anexo</th>
                <th className="p-3 text-right">Valor (R$)</th>
                <th className="p-3 text-center">Status</th>
                {!isAuditor && <th className="p-3 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReceitas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-semibold text-gray-600">{r.dataVencimento}</td>
                  <td className="p-3 font-bold text-[#0b1c30]">{r.fornecedorCliente}</td>
                  <td className="p-3 font-medium text-gray-800">{r.descricao}</td>
                  <td className="p-3 text-gray-600">{r.formaPagamento}</td>
                  <td className="p-3 text-gray-600">{r.contaBancaria}</td>
                  <td className="p-3 text-gray-600">
                    {r.comprovanteUrl ? (
                      <a
                        href={r.comprovanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={r.documentoRef || 'Abrir anexo'}
                        className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span className="material-symbols-outlined text-sm">attach_file</span>
                        Abrir
                      </a>
                    ) : (
                      <span className="text-gray-400 text-[10px] italic">Sem anexo</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-black text-emerald-700">
                    R$ {r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'PAGO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {!isAuditor && <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {r.status === 'PENDENTE' && (
                        <button
                          onClick={() => {
                            if (isAuditor) {
                              showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
                              return;
                            }
                            marcarLancamentoComoPago(r.id);
                          }}
                          disabled={isAuditor}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                            isAuditor
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                          title={isAuditor ? 'Perfil Auditoria não pode liquidar' : 'Marcar como Pago'}
                        >
                          Liquidar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isAuditor) {
                            showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
                            return;
                          }
                          deleteLancamento(r.id);
                        }}
                        disabled={isAuditor}
                        className={`p-1 transition ${
                          isAuditor ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'
                        }`}
                        title={isAuditor ? 'Perfil Auditoria não pode excluir' : 'Excluir'}
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
