import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LancamentosPeriodFilter } from '../common/LancamentosPeriodFilter';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { isDateInRange, normalizeDateValue } from '../../utils/dateRange';
import { normalizeText } from '../../utils/text';
import { LiquidacaoModal } from '../modals/LiquidacaoModal';
import type { Lancamento } from '../../types';

interface ReceitasViewProps {
  onOpenNovoLancamentoModal: () => void;
}

export const ReceitasView: React.FC<ReceitasViewProps> = ({ onOpenNovoLancamentoModal }) => {
  const { filteredLancamentos, categorias, marcarLancamentoComoPago, deleteLancamento, isAuditor, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [competencia, setCompetencia] = useState('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [periodoAplicado, setPeriodoAplicado] = useState({ inicio: '', fim: '' });
  const [lancamentoLiquidacao, setLancamentoLiquidacao] = useState<Lancamento | null>(null);

  const receitas = filteredLancamentos.filter((l) => l.tipo === 'RECEITA');

  const availableMonths = useMemo(() => Array.from(new Set<string>(
    filteredLancamentos
      .filter((l) => l.tipo === 'RECEITA')
      .map((l) => normalizeDateValue(l.dataVencimento).substring(0, 7))
      .filter(Boolean)
  )).sort((a, b) => b.localeCompare(a)), [filteredLancamentos]);

  const availableCategories = useMemo(() => Array.from(new Set<string>([
    ...categorias.filter((categoria) => categoria.tipo === 'RECEITA').map((categoria) => categoria.nome),
    ...filteredLancamentos.filter((l) => l.tipo === 'RECEITA').map((l) => l.categoria)
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [categorias, filteredLancamentos]);

  const receitasNoPeriodo = receitas.filter((r) => {
    if (competencia === 'TODOS') return true;
    if (competencia === 'PERSONALIZADO') {
      if (!periodoAplicado.inicio || !periodoAplicado.fim) return true;
      return isDateInRange(r.dataVencimento, periodoAplicado);
    }
    return normalizeDateValue(r.dataVencimento).startsWith(competencia);
  });

  const filteredReceitas = receitasNoPeriodo.filter((r) => {
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch =
      normalizeText(r.descricao).includes(normalizedSearch) ||
      normalizeText(r.fornecedorCliente).includes(normalizedSearch);
    const matchesStatus = statusFilter === 'TODOS' || r.status === statusFilter;
    const matchesCategory = categoryFilter === 'TODAS' || normalizeText(r.categoria) === normalizeText(categoryFilter);
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const { sortedItems: sortedReceitas, sortConfig, requestSort } = useSortableData(filteredReceitas);

  const totalPago = receitasNoPeriodo.filter((r) => r.status === 'PAGO').reduce((a, b) => a + b.valor, 0);
  const totalPendente = receitasNoPeriodo.filter((r) => r.status === 'PENDENTE').reduce((a, b) => a + b.valor, 0);

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

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold">Categoria:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-semibold text-[#0b1c30] max-w-[220px]"
            >
              <option value="TODAS">Todas as Categorias</option>
              {availableCategories.map((categoria) => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500 font-semibold ml-1">Status:</span>
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

        <LancamentosPeriodFilter
          competencia={competencia}
          availableMonths={availableMonths}
          dataInicio={dataInicio}
          dataFim={dataFim}
          periodoAplicado={periodoAplicado}
          resultCount={filteredReceitas.length}
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
                <SortableTableHeader label="Data Venc." sortKey="vencimento" accessor={(item) => normalizeDateValue(item.dataVencimento)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Paciente / Cliente" sortKey="cliente" accessor={(item) => item.fornecedorCliente} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição do Procedimento" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Forma Pgto" sortKey="forma" accessor={(item) => item.formaPagamento} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Conta Destino" sortKey="conta" accessor={(item) => item.contaBancaria} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Anexo" sortKey="anexo" accessor={(item) => Boolean(item.comprovanteUrl)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Valor (R$)" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.status} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-center" />
                {!isAuditor && <th className="p-3 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedReceitas.map((r) => (
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
                            setLancamentoLiquidacao(r);
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
              {sortedReceitas.length === 0 && (
                <tr>
                  <td colSpan={isAuditor ? 8 : 9} className="p-8 text-center text-gray-500">
                    Nenhuma receita encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LiquidacaoModal
        item={lancamentoLiquidacao ? {
          titulo: lancamentoLiquidacao.descricao,
          contraparte: lancamentoLiquidacao.fornecedorCliente,
          tipo: lancamentoLiquidacao.tipo,
          valor: lancamentoLiquidacao.valor,
          unidade: lancamentoLiquidacao.unidade
        } : null}
        onClose={() => setLancamentoLiquidacao(null)}
        onConfirm={(dados) => {
          if (!lancamentoLiquidacao) return;
          marcarLancamentoComoPago(lancamentoLiquidacao.id, dados);
          setLancamentoLiquidacao(null);
        }}
      />
    </div>
  );
};
