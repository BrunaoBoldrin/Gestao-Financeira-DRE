import React from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { normalizeDateValue } from '../../utils/dateRange';

export const HistoricoAuditoriaView: React.FC = () => {
  const { auditLogs } = useApp();
  const { sortedItems: sortedAuditLogs, sortConfig, requestSort } = useSortableData(auditLogs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">history</span>
            Trilha de Auditoria e Histórico de Operações (Audit Trail)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Registro cronológico imutável de todas as criações, edições, liquidações e aprovações.
          </p>
        </div>

        <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-3 py-1.5 rounded-lg">
          {auditLogs.length} Eventos Registrados
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Log Completo de Eventos
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Data / Hora" sortKey="data" accessor={(item) => normalizeDateValue(item.dataHora) || item.dataHora} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Usuário" sortKey="usuario" accessor={(item) => item.usuario} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Módulo" sortKey="modulo" accessor={(item) => item.modulo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Ação" sortKey="acao" accessor={(item) => item.acao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição da Operação" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Endereço IP" sortKey="ip" accessor={(item) => item.ip} sortConfig={sortConfig} onSort={requestSort} className="p-3 font-mono" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-mono text-gray-500">{log.dataHora}</td>
                  <td className="p-3 font-bold text-[#0b1c30]">{log.usuario}</td>
                  <td className="p-3">
                    <span className="bg-[#f8f9ff] text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                      {log.modulo}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.acao === 'APROVACAO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.acao === 'CRIACAO'
                          ? 'bg-blue-100 text-blue-800'
                          : log.acao === 'EXCLUSAO'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.acao}
                    </span>
                  </td>
                  <td className="p-3 text-gray-800">
                    <div>{log.descricao}</div>
                    {log.valorAnterior && (
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        De: {log.valorAnterior} ➔ Para: {log.valorNovo}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-gray-400">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
