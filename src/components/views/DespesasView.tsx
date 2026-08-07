import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LancamentosPeriodFilter } from '../common/LancamentosPeriodFilter';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { isDateInRange, normalizeDateValue } from '../../utils/dateRange';
import { normalizeText } from '../../utils/text';

interface DespesasViewProps {
  onOpenNovoLancamentoModal: () => void;
  onOpenUploadModal: () => void;
}

export const DespesasView: React.FC<DespesasViewProps> = ({ onOpenNovoLancamentoModal, onOpenUploadModal }) => {
  const { filteredLancamentos, categorias, marcarLancamentoComoPago, deleteLancamento, setCurrentView, isAuditor, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [competencia, setCompetencia] = useState('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [periodoAplicado, setPeriodoAplicado] = useState({ inicio: '', fim: '' });

  const despesas = filteredLancamentos.filter((l) => l.tipo === 'DESPESA');

  const availableMonths = useMemo(() => Array.from(new Set<string>(
    filteredLancamentos
      .filter((l) => l.tipo === 'DESPESA')
      .map((l) => normalizeDateValue(l.dataVencimento).substring(0, 7))
      .filter(Boolean)
  )).sort((a, b) => b.localeCompare(a)), [filteredLancamentos]);

  const availableCategories = useMemo(() => Array.from(new Set<string>([
    ...categorias.filter((categoria) => categoria.tipo === 'DESPESA').map((categoria) => categoria.nome),
    ...filteredLancamentos.filter((l) => l.tipo === 'DESPESA').map((l) => l.categoria)
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [categorias, filteredLancamentos]);

  const despesasNoPeriodo = despesas.filter((d) => {
    if (competencia === 'TODOS') return true;
    if (competencia === 'PERSONALIZADO') {
      if (!periodoAplicado.inicio || !periodoAplicado.fim) return true;
      return isDateInRange(d.dataVencimento, periodoAplicado);
    }
    return normalizeDateValue(d.dataVencimento).startsWith(competencia);
  });

  const filteredDespesas = despesasNoPeriodo.filter((d) => {
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch =
      normalizeText(d.descricao).includes(normalizedSearch) ||
      normalizeText(d.fornecedorCliente).includes(normalizedSearch);
    const matchesCategory = categoryFilter === 'TODAS' || normalizeText(d.categoria) === normalizeText(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const { sortedItems: sortedDespesas, sortConfig, requestSort } = useSortableData(filteredDespesas);

  const totalPago = despesasNoPeriodo.filter((d) => d.status === 'PAGO').reduce((a, b) => a + b.valor, 0);
  const totalPendente = despesasNoPeriodo.filter((d) => d.status === 'PENDENTE').reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-6">
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
              {availableCategories.map((categoria) => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>
        </div>

        <LancamentosPeriodFilter
          competencia={competencia}
          availableMonths={availableMonths}
          dataInicio={dataInicio}
          dataFim={dataFim}
          periodoAplicado={periodoAplicado}
          resultCount={filteredDespesas.length}
          onCompetenciaChange={(value) => {
            setCompetencia(value);
            if (value !== 'PERSONALIZADO') {
              setDataInicio('');
              setDataFim('');
              setPeriodoAplicado({ inicio: '', fim: '' });
            }
          }}
          onDataInicioChange={setDataInicio}
          onDataFimChange={setDataFim}
          onApplyPeriod={() => setPeriodoAplicado({
            inicio: normalizeDateValue(dataInicio),
            fim: normalizeDateValue(dataFim)
          })}
          onClearPeriod={() => {
            setDataInicio('');
            setDataFim('');
            setPeriodoAplicado({ inicio: '', fim: '' });
          }}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Vencimento" sortKey="vencimento" accessor={(item) => normalizeDateValue(item.dataVencimento)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Fornecedor" sortKey="fornecedor" accessor={(item) => item.fornecedorCliente} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Categoria" sortKey="categoria" accessor={(item) => item.categoria} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Comprovante" sortKey="comprovante" accessor={(item) => Boolean(item.comprovanteUrl)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Valor (R$)" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.status} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-center" />
                {!isAuditor && <th className="p-3 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedDespesas.map((d) => (
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
                        title={d.documentoRef || 'Abrir anexo'}
                        className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span className="material-symbols-outlined text-sm">attach_file</span>
                        Abrir
                      </a>
                    ) : (
                      <span className="text-gray-400 text-[10px] italic">Sem anexo</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-black text-rose-700">
                    R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'PAGO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                  {!isAuditor && <td className="p-3 text-center">
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
                  </td>}
                </tr>
              ))}
              {sortedDespesas.length === 0 && (
                <tr>
                  <td colSpan={isAuditor ? 7 : 8} className="p-8 text-center text-gray-500">
                    Nenhuma despesa encontrada para os filtros selecionados.
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
