import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { LancamentosPeriodFilter } from '../common/LancamentosPeriodFilter';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { getCurrentMonthValue, isDateInRange, normalizeDateValue } from '../../utils/dateRange';
import { normalizeText } from '../../utils/text';
import { LiquidacaoModal } from '../modals/LiquidacaoModal';
import { EditarLancamentoModal } from '../modals/EditarLancamentoModal';
import type { Lancamento } from '../../types';

interface ReceitasViewProps {
  onOpenNovoLancamentoModal: () => void;
}

const cardLayoutQuery = '(max-width: 1023px)';
const inputClass = 'min-h-10 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-[#0b1c30]';

function TransactionStatus({ status }: { status: Lancamento['status'] }) {
  const colors = {
    PAGO: 'bg-emerald-100 text-emerald-800',
    CANCELADO: 'bg-gray-100 text-gray-700',
    ATRASADO: 'bg-rose-100 text-rose-800',
    PENDENTE: 'bg-amber-100 text-amber-800',
  }[status];
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${colors}`}>{status}</span>;
}

const formatMovementAmount = (transaction: Lancamento) =>
  `${transaction.tipo === 'RECEITA' ? '+' : '−'} ${transaction.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;

const noTransactions = 'Nenhuma movimentação encontrada para os filtros selecionados.';

export const ReceitasView: React.FC<ReceitasViewProps> = ({ onOpenNovoLancamentoModal }) => {
  const { filteredLancamentos, categorias, marcarLancamentoComoPago, deleteLancamento, isAuditor, flushPersistence, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'TODOS' | 'RECEITA' | 'DESPESA'>('TODOS');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [costCenterFilter, setCostCenterFilter] = useState('TODOS');
  const [accountFilter, setAccountFilter] = useState('TODAS');
  const currentMonth = getCurrentMonthValue();
  const [competencia, setCompetencia] = useState(currentMonth);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [periodoAplicado, setPeriodoAplicado] = useState({ inicio: '', fim: '' });
  const [compact, setCompact] = useState(() => window.matchMedia(cardLayoutQuery).matches);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(cardLayoutQuery);
    const handler = (event: MediaQueryListEvent) => setCompact(event.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const [lancamentoLiquidacao, setLancamentoLiquidacao] = useState<Lancamento | null>(null);
  const [lancamentoEdicao, setLancamentoEdicao] = useState<Lancamento | null>(null);

  const receitas = filteredLancamentos.filter((item) => typeFilter === 'TODOS' || item.tipo === typeFilter);

  const availableMonths = useMemo(() => Array.from(new Set<string>([
    currentMonth,
    ...filteredLancamentos
      .filter((item) => typeFilter === 'TODOS' || item.tipo === typeFilter)
      .map((l) => normalizeDateValue(l.dataVencimento).substring(0, 7))
      .filter(Boolean)
  ])).sort((a, b) => b.localeCompare(a)), [currentMonth, filteredLancamentos, typeFilter]);

  const availableCategories = useMemo(() => Array.from(new Set<string>([
    ...categorias.filter((categoria) => typeFilter === 'TODOS' || categoria.tipo === typeFilter).map((categoria) => categoria.nome),
    ...filteredLancamentos.filter((item) => typeFilter === 'TODOS' || item.tipo === typeFilter).map((item) => item.categoria)
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [categorias, filteredLancamentos, typeFilter]);
  const availableCenters = useMemo(() => Array.from(new Set(receitas.map((item) => item.centroCusto).filter(Boolean))).sort(), [receitas]);
  const availableAccounts = useMemo(() => Array.from(new Set(receitas.map((item) => item.contaBancaria).filter(Boolean))).sort(), [receitas]);

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
    const matchesCenter = costCenterFilter === 'TODOS' || r.centroCusto === costCenterFilter;
    const matchesAccount = accountFilter === 'TODAS' || r.contaBancaria === accountFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesCenter && matchesAccount;
  });

  const { sortedItems: sortedReceitas, sortConfig, requestSort } = useSortableData<Lancamento>(filteredReceitas);

  const totalReceitas = filteredReceitas.filter((item) => item.tipo === 'RECEITA' && item.status !== 'CANCELADO').reduce((total, item) => total + item.valor, 0);
  const totalDespesas = filteredReceitas.filter((item) => item.tipo === 'DESPESA' && item.status !== 'CANCELADO').reduce((total, item) => total + item.valor, 0);

  const activeFilters = Number(typeFilter !== 'TODOS') + Number(categoryFilter !== 'TODAS') +
    Number(costCenterFilter !== 'TODOS') + Number(accountFilter !== 'TODAS') + Number(statusFilter !== 'TODOS');

  const transactionActions = (r: Lancamento) => (
    <div className="flex flex-wrap items-center gap-1">
      {r.status === 'PENDENTE' && (
        <button type="button" onClick={() => setLancamentoLiquidacao(r)}
          className="min-h-10 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800">
          {r.tipo === 'RECEITA' ? 'Receber' : 'Pagar'}
        </button>
      )}
      <button type="button" onClick={() => setLancamentoEdicao(r)} aria-label="Editar transação" title="Editar transação"
        className="grid size-10 place-items-center rounded-lg text-blue-700 hover:bg-blue-50">
        <span aria-hidden="true" className="material-symbols-outlined">edit</span>
      </button>
      <button type="button" onClick={() => deleteLancamento(r.id)} aria-label="Excluir transação" title="Excluir"
        className="grid size-10 place-items-center rounded-lg text-rose-700 hover:bg-rose-50">
        <span aria-hidden="true" className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & KPI cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">trending_up</span>
            Receitas e Despesas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Consulte, filtre e edite todas as movimentações financeiras em uma única página.
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
          className={`hidden px-4 py-2 rounded-lg text-xs font-bold desktop:flex items-center gap-1.5 transition shadow-xs ${
            isAuditor
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#131b2e] text-white hover:bg-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          Novo Lançamento
        </button>}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4">
        <div className="bg-emerald-50 border border-emerald-200 p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800">
              Total de Receitas
            </p>
            <p className="break-words text-lg tabular-nums font-black sm:text-2xl text-emerald-950 mt-1">
              R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="material-symbols-outlined hidden text-emerald-600 lg:inline-block">check_circle</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800">
              Total de Despesas
            </p>
            <p className="break-words text-lg tabular-nums font-black sm:text-2xl text-amber-950 mt-1">
              R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="material-symbols-outlined hidden text-amber-600 lg:inline-block">trending_down</span>
        </div>
        <div className={`${totalReceitas - totalDespesas >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'} col-span-2 border p-3 sm:col-span-1 sm:p-4 rounded-xl flex flex-wrap items-center justify-between`}><div><p className="text-xs font-bold">Resultado filtrado</p><p className="break-words text-lg tabular-nums font-black sm:text-2xl mt-1">R$ {(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div><span className="material-symbols-outlined hidden text-blue-600 lg:inline-block">account_balance_wallet</span></div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="space-y-2.5 border-b border-[#e5eeff] bg-[#f8f9ff] p-3 sm:p-4">
          <div className="flex min-w-0 gap-2">
            <div className="relative min-w-0 flex-1">
              <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">search</span>
              <input type="search" aria-label="Buscar lançamentos" placeholder="Buscar lançamentos"
                value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}
                className={inputClass + ' w-full pl-9 font-normal focus:ring-2 focus:ring-[#131b2e] focus:outline-none'} />
            </div>
            {compact && <button type="button" aria-expanded={showFilters} aria-controls="transaction-filters"
              onClick={() => setShowFilters(!showFilters)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d3e4fe] bg-white px-2.5 text-xs font-bold text-[#0b1c30]">
              <span aria-hidden="true" className="material-symbols-outlined">tune</span>
              Filtros{activeFilters > 0 && <span className="rounded-full bg-[#e5eeff] px-1.5">{activeFilters}</span>}
            </button>}
          </div>

          <div id="transaction-filters" hidden={compact && !showFilters}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select aria-label="Tipo de lançamento" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as typeof typeFilter); setCategoryFilter('TODAS'); }} className={inputClass}>
                <option value="TODOS">Receitas e despesas</option><option value="RECEITA">Somente receitas</option><option value="DESPESA">Somente despesas</option>
              </select>
              <select aria-label="Categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
                <option value="TODAS">Todas as categorias</option>{availableCategories.map((value) => <option key={value}>{value}</option>)}
              </select>
              <select aria-label="Centro de custo" value={costCenterFilter} onChange={(event) => setCostCenterFilter(event.target.value)} className={inputClass}>
                <option value="TODOS">Todos os centros</option>{availableCenters.map((value) => <option key={value}>{value}</option>)}
              </select>
              <select aria-label="Conta bancária" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className={inputClass}>
                <option value="TODAS">Todas as contas</option>{availableAccounts.map((value) => <option key={value}>{value}</option>)}
              </select>
              <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                <option value="TODOS">Todos os status</option><option value="PAGO">Pago</option><option value="PENDENTE">Pendente</option>
                <option value="ATRASADO">Atrasado</option><option value="CANCELADO">Cancelado</option>
              </select>
            </div>
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

        {compact ? (
          <div className="bg-[#f8faff] p-3 sm:p-4">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => requestSort('vencimento', (item) => normalizeDateValue(item.dataVencimento))}
                className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#0b1c30] hover:bg-[#eff4ff]">
                <span aria-hidden="true" className="material-symbols-outlined">{sortConfig?.key === 'vencimento' ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'sort'}</span>
                Ordenar por vencimento
              </button>
            </div>
            {sortedReceitas.length === 0 ? <p className="py-6 text-center text-sm text-slate-600">{noTransactions}</p> : (
              <ul className="grid gap-2.5 sm:grid-cols-2 sm:items-start" aria-label="Lançamentos">
                {sortedReceitas.map((item) => {
                  const due = normalizeDateValue(item.dataVencimento);
                  return (
                    <li key={item.id} className="min-w-0 space-y-2 rounded-xl border border-[#dbe5f1] bg-white p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-xs font-extrabold ${item.tipo === 'RECEITA' ? 'text-emerald-800' : 'text-rose-800'}`}>{item.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</span>
                        <TransactionStatus status={item.status} />
                      </div>
                      <div>
                        <p className="break-words text-sm font-bold text-[#0b1c30]">{item.descricao}</p>
                        {item.fornecedorCliente && item.fornecedorCliente !== item.descricao && <p className="break-words text-xs text-slate-600">{item.fornecedorCliente}</p>}
                      </div>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <p className={`break-words text-base font-extrabold tabular-nums ${item.tipo === 'RECEITA' ? 'text-emerald-800' : 'text-rose-800'}`}>{formatMovementAmount(item)}</p>
                        {due && <time dateTime={due} className="text-xs text-slate-600">Venc. {due.split('-').reverse().join('/')}</time>}
                      </div>
                      <details className="border-t border-[#edf2f8] text-xs text-slate-700">
                        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 font-bold text-[#0b1c30] [&::-webkit-details-marker]:hidden">
                          <span aria-hidden="true" className="material-symbols-outlined">expand_more</span> Detalhes
                        </summary>
                        <dl className="grid grid-cols-2 gap-2 break-words pb-2">
                          <div><dt className="font-bold">Filial</dt><dd>{item.unidade || '—'}</dd></div>
                          <div><dt className="font-bold">Categoria</dt><dd>{item.categoria || '—'}</dd></div>
                          <div><dt className="font-bold">Centro de custo</dt><dd>{item.centroCusto || '—'}</dd></div>
                          <div><dt className="font-bold">Conta / forma de pagamento</dt><dd>{[item.contaBancaria, item.formaPagamento?.replaceAll('_', ' ')].filter(Boolean).join(' · ') || '—'}</dd></div>
                        </dl>
                        {item.comprovanteUrl && <a href={item.comprovanteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 font-bold text-blue-700">
                          <span aria-hidden="true" className="material-symbols-outlined">attach_file</span> Abrir anexo
                        </a>}
                      </details>
                      {!isAuditor && <div className="border-t border-[#edf2f8] pt-2">{transactionActions(item)}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto" role="region" aria-label="Tabela de lançamentos" tabIndex={0}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Data Venc." sortKey="vencimento" accessor={(item) => normalizeDateValue(item.dataVencimento)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Tipo" sortKey="tipo" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Favorecido / Cliente" sortKey="cliente" accessor={(item) => item.fornecedorCliente} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Categoria / Centro" sortKey="categoria" accessor={(item) => `${item.categoria} ${item.centroCusto}`} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Forma Pgto" sortKey="forma" accessor={(item) => item.formaPagamento} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Conta Bancária" sortKey="conta" accessor={(item) => item.contaBancaria} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
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
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{r.tipo}</span></td>
                  <td className="p-3 font-bold text-[#0b1c30]">{r.fornecedorCliente}</td>
                  <td className="p-3 font-medium text-gray-800">{r.descricao}</td>
                  <td className="p-3 text-gray-600"><div>{r.categoria}</div><div className="text-[10px] text-gray-400">{r.centroCusto}</div></td>
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
                  <td className={`p-3 text-right font-black ${r.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {r.tipo === 'RECEITA' ? '+' : '−'} R$ {r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center"><TransactionStatus status={r.status} /></td>
                  {!isAuditor && <td className="p-3">{transactionActions(r)}</td>}
                </tr>
              ))}
              {sortedReceitas.length === 0 && (
                <tr>
                  <td colSpan={isAuditor ? 10 : 11} className="p-8 text-center text-gray-500">
                    {noTransactions}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
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
        onConfirm={async (dados) => {
          if (!lancamentoLiquidacao) return;
          if (!marcarLancamentoComoPago(lancamentoLiquidacao.id, dados)) return;
          const saved = await flushPersistence();
          showToast(
            saved
              ? `${lancamentoLiquidacao.tipo === 'RECEITA' ? 'Recebimento' : 'Pagamento'} confirmado e salvo.`
              : 'A liquidação ainda não foi confirmada. Use “Tentar salvar” antes de sair.',
            saved ? 'success' : 'error'
          );
          setLancamentoLiquidacao(null);
        }}
      />
      <EditarLancamentoModal item={lancamentoEdicao} onClose={() => setLancamentoEdicao(null)} />
    </div>
  );
};
