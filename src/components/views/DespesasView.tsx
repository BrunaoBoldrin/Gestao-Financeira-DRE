import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface DespesasViewProps {
  onOpenNovoLancamentoModal: () => void;
  onOpenUploadModal: () => void;
}

export const DespesasView: React.FC<DespesasViewProps> = ({ onOpenNovoLancamentoModal, onOpenUploadModal }) => {
  const { filteredLancamentos, marcarLancamentoComoPago, deleteLancamento, setCurrentView, isAuditor, currentUser, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');

  const despesas = filteredLancamentos.filter((l) => l.tipo === 'DESPESA');

  const filteredDespesas = despesas.filter((d) => {
    const matchesSearch =
      d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.fornecedorCliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'TODAS' || d.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalPago = despesas.filter((d) => d.status === 'PAGO').reduce((a, b) => a + b.valor, 0);
  const totalPendente = despesas.filter((d) => d.status === 'PENDENTE').reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-6">
      {/* Auditor Banner */}
      {isAuditor && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-900 text-xs font-medium">
          <span className="material-symbols-outlined text-blue-600 text-lg">visibility</span>
          <div>
            <p className="font-bold text-blue-900">Perfil de Auditoria Ativo (Apenas Leitura)</p>
            <p className="mt-0.5 text-blue-800">
              Ações de inclusão, alteração, pagamento ou exclusão de lançamentos financeiros são restritas aos perfis <strong>Financeiro</strong> e <strong>Administrador</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600">trending_down</span>
            Controle de Despesas & Saídas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Apuração de insumos médicos, custos operacionais, aluguéis e compras de fornecedores.
          </p>
        </div>

        {!isAuditor && <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isAuditor) {
                showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
                return;
              }
              setCurrentView('import_excel');
            }}
            disabled={isAuditor}
            title={isAuditor ? 'Ação restrita ao Financeiro/Administrador' : undefined}
            className={`px-3 py-2 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              isAuditor
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#f8f9ff] border-[#C5A059]/60 text-[#0b1c30] hover:bg-[#fff9ed]'
            }`}
          >
            <span className="material-symbols-outlined text-base text-[#C5A059]">table_chart</span>
            Importar Excel
          </button>

          <button
            onClick={() => {
              if (isAuditor) {
                showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
                return;
              }
              onOpenUploadModal();
            }}
            disabled={isAuditor}
            title={isAuditor ? 'Ação restrita ao Financeiro/Administrador' : undefined}
            className={`px-3.5 py-2 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              isAuditor
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#eff4ff] border-[#d3e4fe] text-[#0b1c30] hover:bg-[#e5eeff]'
            }`}
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            Importar Nota (OCR)
          </button>

          <button
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
            Nova Despesa
          </button>
        </div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Despesas Pagas (Liquidadas)
            </p>
            <p className="text-2xl font-black text-rose-950 mt-1">
              R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="material-symbols-outlined text-rose-600 text-3xl">task_alt</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              A Pagar (A Vencer / Pendente)
            </p>
            <p className="text-2xl font-black text-amber-950 mt-1">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="material-symbols-outlined text-amber-600 text-3xl">schedule</span>
        </div>
      </div>

      {/* Filter and Data Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined text-gray-400 absolute left-2.5 top-2.5 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por fornecedor ou despesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold">Categoria:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-semibold text-[#0b1c30]"
            >
              <option value="TODAS">Todas as Categorias</option>
              <option value="Insumos Médicos & Estéticos">Insumos Médicos & Estéticos</option>
              <option value="Ocupação & Infraestrutura">Ocupação & Infraestrutura</option>
              <option value="Marketing & Publicidade">Marketing & Publicidade</option>
              <option value="Pessoal & Encargos">Pessoal & Encargos</option>
              <option value="Serviços Públicos & Concessionárias">Serviços Públicos & Concessionárias</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Vencimento</th>
                <th className="p-3">Fornecedor</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Comprovante</th>
                <th className="p-3 text-right">Valor (R$)</th>
                <th className="p-3 text-center">Status</th>
                  {!isAuditor && <th className="p-3 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDespesas.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-semibold text-gray-600">{d.dataVencimento}</td>
                  <td className="p-3 font-bold text-[#0b1c30] max-w-[180px] truncate">{d.fornecedorCliente}</td>
                  <td className="p-3 font-medium text-gray-800">{d.descricao}</td>
                  <td className="p-3 text-gray-600">
                    <span className="bg-[#f8f9ff] text-gray-700 border border-[#d3e4fe] px-2 py-0.5 rounded text-[10px]">
                      {d.categoria}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">
                    {d.comprovanteUrl ? (
                      <a
                        href={d.comprovanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span className="material-symbols-outlined text-sm">attach_file</span>
                        Ver Anexo
                      </a>
                    ) : (
                      <span className="text-gray-400 text-[10px] italic">Sem anexo</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-black text-rose-700">
                    R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  {!isAuditor && <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'PAGO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {d.status === 'PENDENTE' && (
                        <button
                          onClick={() => {
                            if (isAuditor) {
                              showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
                              return;
                            }
                            marcarLancamentoComoPago(d.id);
                          }}
                          disabled={isAuditor}
                          title={isAuditor ? 'Perfil Auditoria não pode liquidar contas' : undefined}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                            isAuditor
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-[#131b2e] text-white hover:bg-[#0b1c30]'
                          }`}
                        >
                          Pagar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isAuditor) {
                            showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
                            return;
                          }
                          deleteLancamento(d.id);
                        }}
                        disabled={isAuditor}
                        title={isAuditor ? 'Perfil Auditoria não pode excluir registros' : undefined}
                        className={`p-1 transition ${
                          isAuditor ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
