import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CompetenciaSelect, formatCompetencia } from '../common/CompetenciaSelect';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { getDateRangeBounds, isDateInRange, normalizeDateValue } from '../../utils/dateRange';
import { useSortableData } from '../../hooks/useSortableData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const formatTooltipCurrency = (value: number) =>
  `R$ ${Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const MonthlyFinancialTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const monthData = payload[0]?.payload || {};
  const receitas = Number(monthData.Receitas || 0);
  const despesas = Number(monthData.Despesas || 0);
  const resultado = receitas - despesas;
  const resultadoStatus = resultado > 0 ? 'Positivo' : resultado < 0 ? 'Negativo' : 'Zerado';
  const resultadoColor = resultado > 0 ? '#34d399' : resultado < 0 ? '#fb7185' : '#cbd5e1';

  return (
    <div className="min-w-56 rounded-lg border border-slate-600 bg-[#0b1c30] p-3 text-xs shadow-xl">
      <p className="mb-2 font-bold text-white">Competência: {label}</p>
      <div className="space-y-1.5">
        <p className="flex items-center justify-between gap-4 text-emerald-300">
          <span>Receitas:</span>
          <strong>+ {formatTooltipCurrency(receitas)}</strong>
        </p>
        <p className="flex items-center justify-between gap-4 text-amber-300">
          <span>Despesas:</span>
          <strong>− {formatTooltipCurrency(despesas)}</strong>
        </p>
        <div className="my-1 border-t border-slate-600" />
        <p className="flex items-center justify-between gap-4 font-bold" style={{ color: resultadoColor }}>
          <span>Resultado {resultadoStatus}:</span>
          <strong>{resultado > 0 ? '+' : resultado < 0 ? '−' : ''} {formatTooltipCurrency(resultado)}</strong>
        </p>
      </div>
    </div>
  );
};

export const OverviewView: React.FC = () => {
  const {
    filteredLancamentos,
    documentosOCR,
    bancos,
    fechamentoMensal,
    currentUser,
    selectedUnit,
    setSelectedUnit,
    units,
    isFinance,
    setCurrentView,
    setSelectedDocumentForReviewId,
    canExecuteFinancialActions
  } = useApp();

  const [competencia, setCompetencia] = useState(fechamentoMensal.mesAno);
  const [periodoRascunho, setPeriodoRascunho] = useState({ inicio: '', fim: '' });
  const [periodoAplicado, setPeriodoAplicado] = useState({ inicio: '', fim: '' });
  const periodoPersonalizadoAtivo = Boolean(periodoAplicado.inicio && periodoAplicado.fim);
  const caixasFisicosVisiveis = bancos.filter(
    (banco) =>
      banco.ativo &&
      banco.banco.toLocaleLowerCase('pt-BR').includes('caixa') &&
      (selectedUnit === 'Todas as Unidades' || banco.unidade === selectedUnit)
  );
  const saldoCaixaFisico = caixasFisicosVisiveis.reduce((total, banco) => total + banco.saldo, 0);
  const periodoPersonalizadoInvalido = Boolean(
    periodoRascunho.inicio &&
    periodoRascunho.fim &&
    normalizeDateValue(periodoRascunho.inicio) > normalizeDateValue(periodoRascunho.fim)
  );
  const periodoRascunhoCompleto = Boolean(periodoRascunho.inicio && periodoRascunho.fim);

  const lancamentosValidos = useMemo(
    () => filteredLancamentos.filter((lancamento) => lancamento.status !== 'CANCELADO'),
    [filteredLancamentos]
  );

  const periodoDisponivel = useMemo(
    () => getDateRangeBounds(lancamentosValidos.map((lancamento) => lancamento.dataVencimento)),
    [lancamentosValidos]
  );

  const lancamentosCards = useMemo(() => {
    return lancamentosValidos.filter((lancamento) => {
      if (periodoPersonalizadoAtivo) {
        return isDateInRange(lancamento.dataVencimento, periodoAplicado);
      }

      const dataVencimento = normalizeDateValue(lancamento.dataVencimento);
      return competencia === 'TODOS' || dataVencimento.startsWith(competencia);
    });
  }, [competencia, lancamentosValidos, periodoAplicado, periodoPersonalizadoAtivo]);

  const totalReceitas = lancamentosCards
    .filter((l) => l.tipo === 'RECEITA')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalDespesas = lancamentosCards
    .filter((l) => l.tipo === 'DESPESA')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const resultadoOperacional = totalReceitas - totalDespesas;
  const margemOperacional = totalReceitas > 0 ? (resultadoOperacional / totalReceitas) * 100 : 0;
  const revenueVariation = useMemo(() => {
    if (periodoPersonalizadoAtivo || competencia === 'TODOS') return null;

    const [competenciaYear, competenciaMonth] = competencia.split('-').map(Number);
    const previousDate = new Date(competenciaYear, competenciaMonth - 2, 1);
    const previousCompetencia = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    const previousRevenue = lancamentosValidos
      .filter((item) => item.tipo === 'RECEITA' && normalizeDateValue(item.dataVencimento).startsWith(previousCompetencia))
      .reduce((total, item) => total + item.valor, 0);

    return previousRevenue > 0 ? ((totalReceitas - previousRevenue) / previousRevenue) * 100 : null;
  }, [competencia, lancamentosValidos, periodoPersonalizadoAtivo, totalReceitas]);

  const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
  const periodoCardsLabel = periodoPersonalizadoAtivo
    ? `${formatDate(periodoAplicado.inicio)} até ${formatDate(periodoAplicado.fim)}`
    : competencia === 'TODOS'
      ? 'Todos os meses'
      : formatCompetencia(competencia);

  const pendingOCRDocs = documentosOCR.filter((d) => d.status === 'PENDENTE_REVISAO');

  const chartData = useMemo(() => {
    const year = Number(fechamentoMensal.mesAno.substring(0, 4));
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(year, index, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const items = lancamentosValidos.filter((item) => normalizeDateValue(item.dataVencimento).startsWith(monthKey));
      const label = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      return {
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        Receitas: items.filter((item) => item.tipo === 'RECEITA').reduce((total, item) => total + item.valor, 0),
        Despesas: items.filter((item) => item.tipo === 'DESPESA').reduce((total, item) => total + item.valor, 0)
      };
    });
  }, [fechamentoMensal.mesAno, lancamentosValidos]);

  const chartYear = fechamentoMensal.mesAno.substring(0, 4);
  const lancamentosAnoGrafico = useMemo(
    () => lancamentosValidos.filter((item) => normalizeDateValue(item.dataVencimento).startsWith(chartYear)),
    [chartYear, lancamentosValidos]
  );

  const categoryPieData = useMemo(() => {
    const colors = ['#131b2e', '#C5A059', '#003366', '#64748b', '#94a3b8', '#cbd5e1'];
    const totals = new Map<string, number>();
    lancamentosAnoGrafico
      .filter((item) => item.tipo === 'DESPESA')
      .forEach((item) => totals.set(item.categoria, (totals.get(item.categoria) || 0) + item.valor));

    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }));
  }, [lancamentosAnoGrafico]);

  const ultimosLancamentos = useMemo(
    () => [...lancamentosValidos]
      .sort((a, b) => normalizeDateValue(b.dataVencimento).localeCompare(normalizeDateValue(a.dataVencimento)))
      .slice(0, 5),
    [lancamentosValidos]
  );
  const { sortedItems: sortedUltimosLancamentos, sortConfig, requestSort } = useSortableData(ultimosLancamentos);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Quick Action */}
      <div className="bg-gradient-to-r from-[#0b1c30] via-[#131b2e] to-[#0f243d] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-300 text-xs">Royal Face Estética Facial</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Painel de Controle Financeiro & DRE Gerencial
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-xl">
              Acompanhamento financeiro por unidade, validação de documentos e apuração do DRE gerencial.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 md:justify-end">
            <div>
              <label className="block text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-1">Unidade / Filial</label>
              <select
                value={selectedUnit}
                onChange={(event) => setSelectedUnit(event.target.value)}
                disabled={isFinance}
                title={isFinance ? 'Perfil Financeiro limitado à unidade cadastrada' : undefined}
                className="px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#C5A059] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed max-w-[230px]"
              >
                {!isFinance && <option value="Todas as Unidades">Todas as Unidades (Consolidado)</option>}
                {units.filter((unit) =>
                  unit.ativa !== false && unit.id !== 'all' && (!isFinance || unit.nome === currentUser?.unit)
                ).map((unit) => (
                  <option key={unit.id} value={unit.nome}>{unit.nome} ({unit.cidade})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-1">Competência dos cards</label>
              <CompetenciaSelect
                value={competencia}
                onChange={(value) => {
                  setCompetencia(value);
                  setPeriodoRascunho({ inicio: '', fim: '' });
                  setPeriodoAplicado({ inicio: '', fim: '' });
                }}
                lancamentos={filteredLancamentos}
                referenceMonth={fechamentoMensal.mesAno}
                allowAll
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-1">Data inicial</label>
              <input
                type="date"
                value={periodoRascunho.inicio}
                onChange={(event) => setPeriodoRascunho((current) => ({ ...current, inicio: event.target.value }))}
                className="px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#C5A059]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-1">Data final</label>
              <input
                type="date"
                value={periodoRascunho.fim}
                onChange={(event) => setPeriodoRascunho((current) => ({ ...current, fim: event.target.value }))}
                className="px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#C5A059]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPeriodoAplicado({
                  inicio: normalizeDateValue(periodoRascunho.inicio),
                  fim: normalizeDateValue(periodoRascunho.fim)
                });
                setCompetencia('TODOS');
              }}
              disabled={!periodoRascunhoCompleto || periodoPersonalizadoInvalido}
              className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-xs font-bold hover:bg-[#b08d46] disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              Aplicar período
            </button>
            {(periodoRascunho.inicio || periodoRascunho.fim || periodoPersonalizadoAtivo) && (
              <button
                type="button"
                onClick={() => {
                  setPeriodoRascunho({ inicio: '', fim: '' });
                  setPeriodoAplicado({ inicio: '', fim: '' });
                  setCompetencia(fechamentoMensal.mesAno);
                }}
                className="px-3 py-2 border border-white/40 text-white rounded-lg text-xs font-bold hover:bg-white/10"
              >
                Limpar período
              </button>
            )}
            {canExecuteFinancialActions && <button
              onClick={() => setCurrentView('pending_review')}
              className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-xs font-bold hover:bg-[#b08d46] transition flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              Revisar Fila OCR ({pendingOCRDocs.length})
            </button>}
          </div>
        </div>
        {periodoPersonalizadoInvalido && (
          <p className="relative z-10 mt-3 text-[11px] font-semibold text-rose-200 text-right">
            A data inicial não pode ser posterior à data final.
          </p>
        )}
        {!periodoPersonalizadoInvalido && periodoDisponivel.min && periodoDisponivel.max && (
          <p className="relative z-10 mt-3 text-[11px] font-semibold text-gray-300 text-right">
            Dados cadastrados: {formatDate(periodoDisponivel.min)} até {formatDate(periodoDisponivel.max)}
            {periodoPersonalizadoAtivo && ` · ${lancamentosCards.length} lançamento(s) no período aplicado`}
          </p>
        )}
        {periodoPersonalizadoAtivo && lancamentosCards.length === 0 && (
          <p className="relative z-10 mt-1 text-[11px] font-semibold text-amber-200 text-right">
            Nenhum lançamento foi encontrado entre as datas selecionadas para esta unidade.
          </p>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Receitas Brutas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">trending_up</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-emerald-700 font-semibold">
            <span className="material-symbols-outlined text-sm mr-0.5">arrow_upward</span>
            {revenueVariation === null
              ? periodoCardsLabel
              : `${revenueVariation >= 0 ? '+' : ''}${revenueVariation.toFixed(1)}% vs mês anterior`}
          </div>
        </div>

        {/* Despesas */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Despesas Operacionais
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">trending_down</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-rose-700 font-semibold">
            <span className="material-symbols-outlined text-sm mr-0.5">arrow_downward</span>
            {periodoCardsLabel}
          </div>
        </div>

        {/* Resultado Operacional / EBITDA */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Resultado do Período
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {resultadoOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-blue-700 font-semibold">
              <span>Margem do período: </span>
            <span className="ml-1 px-1.5 py-0.2 bg-blue-100 rounded text-blue-900 font-bold">
              {margemOperacional.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Status Caixa Físico */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Caixa Físico Recepção
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
              {selectedUnit === 'Todas as Unidades' ? 'Consolidado' : 'Saldo contínuo'}
            </span>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {saldoCaixaFisico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            {caixasFisicosVisiveis.length === 0
              ? 'Nenhuma conta de Caixa Físico nesta seleção'
              : `${caixasFisicosVisiveis.length} caixa(s) incluído(s) · ${selectedUnit}`}
          </p>
        </div>
      </div>

      {/* OCR & Excel Import Action Banners */}
      {canExecuteFinancialActions && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingOCRDocs.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-lg">
                <span className="material-symbols-outlined text-2xl">document_scanner</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  {pendingOCRDocs.length} Documentos na Fila de Conferência OCR
                </h4>
                <p className="text-[11px] text-amber-700">
                  Último arquivo: {pendingOCRDocs[0].nomeArquivo} ({pendingOCRDocs[0].confiancaOCR}% confiança)
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedDocumentForReviewId(pendingOCRDocs[0].id);
                setCurrentView('pending_review');
              }}
              className="px-3 py-1.5 bg-amber-700 text-white text-xs font-bold rounded-md hover:bg-amber-800 transition"
            >
              Conferir Lado a Lado
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <span className="material-symbols-outlined text-2xl">task_alt</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-900">Fila OCR Concluída</h4>
                <p className="text-[11px] text-emerald-700">Nenhum documento aguardando auditoria no momento.</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-900 via-[#131b2e] to-blue-950 text-white border border-blue-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C5A059]/20 text-[#C5A059] rounded-lg">
              <span className="material-symbols-outlined text-2xl">table_chart</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Importar Planilha / Dados Históricos</h4>
              <p className="text-[11px] text-gray-300">Alimente o sistema com lançamentos em lote via Excel/CSV.</p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('import_excel')}
            className="px-3 py-1.5 bg-[#C5A059] text-white text-xs font-bold rounded-md hover:bg-[#b08d46] transition flex items-center gap-1"
          >
            <span>Importar Excel</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Evolução Receitas x Despesas */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Evolução Mensal de Receitas vs Despesas</h3>
              <p className="text-xs text-gray-500">Janeiro a dezembro de {chartYear}, independente do filtro dos cards</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-600" aria-label="Legenda do gráfico">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#0b1c30]"></span>
                  Receitas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#C5A059]"></span>
                  Despesas
                </span>
              </div>
              <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2.5 py-1 rounded">
                Visão Competência
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<MonthlyFinancialTooltip />} />
                <Bar dataKey="Receitas" fill="#0b1c30" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#C5A059" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Composição das Despesas */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">Distribuição de Custos por Categoria</h3>
            <p className="text-xs text-gray-500 mb-2">Despesas de {chartYear} na unidade selecionada</p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR')}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 mt-2 border-t border-gray-100 pt-3">
            {categoryPieData.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="text-gray-700 truncate">{cat.name}</span>
                </div>
                <span className="font-bold text-[#0b1c30]">
                  R$ {cat.value.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Latest Entries Table Preview */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#e5eeff] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">receipt</span>
            <h3 className="text-sm font-bold text-[#0b1c30]">Últimos Lançamentos da Unidade</h3>
          </div>
          <button
            onClick={() => setCurrentView('receitas')}
            className="text-xs font-bold text-[#775a19] hover:underline flex items-center gap-1"
          >
            Ver todos os lançamentos
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Data Venc." sortKey="data" accessor={(item) => normalizeDateValue(item.dataVencimento)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Tipo" sortKey="tipo" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Categoria" sortKey="categoria" accessor={(item) => item.categoria} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Valor" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.status} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUltimosLancamentos.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-semibold text-gray-600">{l.dataVencimento}</td>
                  <td className="p-3 font-bold text-[#0b1c30] max-w-xs truncate">{l.descricao}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {l.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{l.categoria}</td>
                  <td
                    className={`p-3 text-right font-black ${
                      l.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.status === 'PAGO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.status === 'ATRASADO'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {l.status}
                    </span>
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
