import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getDateRangeBounds, isDateInRange, normalizeDateValue } from '../../utils/dateRange';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import type { Lancamento } from '../../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface FluxoAgrupado {
  chave: string;
  periodo: string;
  ordem: number;
  Previsto: number;
  Realizado: number;
  EntradasRealizadas: number;
  SaidasRealizadas: number;
  SaldoAcumulado: number;
}

interface DiaCalendario {
  data: string;
  dia: number;
  noMes: boolean;
  receitas: number;
  despesas: number;
  resultado: number;
  saldoProjetado: number;
  lancamentos: Lancamento[];
}

type ModoCalendario = 'COMPARATIVO' | 'RECEITAS' | 'DESPESAS';

const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const toDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getPeriodInfo = (dateValue: string) => {
  const date = parseDate(dateValue);
  return {
    chave: dateValue,
    periodo: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    ordem: date.getTime()
  };
};

const getCompetenciaRange = (competencia: string) => {
  const [year, month] = competencia.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { inicio: `${competencia}-01`, fim: `${competencia}-${String(lastDay).padStart(2, '0')}` };
};

const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const shiftMonth = (month: string, delta: number) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const FluxoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as FluxoAgrupado;
  if (!row) return null;
  return (
    <div className="min-w-[270px] rounded-xl border border-slate-600 bg-[#0b1c30] p-4 text-xs text-white shadow-2xl">
      <p className="mb-3 border-b border-slate-600 pb-2 text-sm font-black">Data: {label}</p>
      <div className="space-y-2">
        <p className="flex justify-between gap-5 text-emerald-300"><span>Entradas realizadas</span><strong>+ {formatCurrency(row.EntradasRealizadas)}</strong></p>
        <p className="flex justify-between gap-5 text-rose-300"><span>Saídas realizadas</span><strong>− {formatCurrency(row.SaidasRealizadas)}</strong></p>
        <p className={`flex justify-between gap-5 font-bold ${row.Realizado >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}><span>Resultado realizado</span><strong>{row.Realizado > 0 ? '+' : row.Realizado < 0 ? '−' : ''} {formatCurrency(Math.abs(row.Realizado))}</strong></p>
        <p className="flex justify-between gap-5 text-amber-300"><span>Resultado previsto</span><strong>{row.Previsto > 0 ? '+' : row.Previsto < 0 ? '−' : ''} {formatCurrency(Math.abs(row.Previsto))}</strong></p>
        <div className="border-t border-slate-600 pt-2">
          <p className={`flex justify-between gap-5 text-sm font-black ${row.SaldoAcumulado >= 0 ? 'text-sky-200' : 'text-rose-300'}`}><span>Saldo acumulado no período</span><strong>{row.SaldoAcumulado > 0 ? '+' : row.SaldoAcumulado < 0 ? '−' : ''} {formatCurrency(Math.abs(row.SaldoAcumulado))}</strong></p>
        </div>
      </div>
    </div>
  );
};

export const FluxoCaixaView: React.FC = () => {
  const { lancamentos, bancos, units, selectedUnit, fechamentoMensal, isFinance, currentUser } = useApp();
  const [unidadeFluxo, setUnidadeFluxo] = useState(isFinance && currentUser ? currentUser.unit : selectedUnit);
  const competenciaAbertaRange = useMemo(() => getCompetenciaRange(fechamentoMensal.mesAno), [fechamentoMensal.mesAno]);
  const [dataInicioInput, setDataInicioInput] = useState(competenciaAbertaRange.inicio);
  const [dataFimInput, setDataFimInput] = useState(competenciaAbertaRange.fim);
  const [periodoAplicado, setPeriodoAplicado] = useState(competenciaAbertaRange);
  const [visao, setVisao] = useState<'GRAFICO' | 'CALENDARIO'>('GRAFICO');
  const [mesCalendario, setMesCalendario] = useState(fechamentoMensal.mesAno);
  const [modoCalendario, setModoCalendario] = useState<ModoCalendario>('COMPARATIVO');
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const periodoPersonalizadoInvalido = Boolean(
    dataInicioInput && dataFimInput && normalizeDateValue(dataInicioInput) > normalizeDateValue(dataFimInput)
  );
  const periodoInputCompleto = Boolean(dataInicioInput && dataFimInput);
  const periodoAplicadoAtivo = Boolean(periodoAplicado.inicio && periodoAplicado.fim);

  const lancamentosDaUnidade = useMemo(
    () => lancamentos.filter((item) =>
      item.status !== 'CANCELADO' &&
      (unidadeFluxo === 'Todas as Unidades' || item.unidade === unidadeFluxo)
    ),
    [lancamentos, unidadeFluxo]
  );

  const periodoDisponivel = useMemo(
    () => getDateRangeBounds(lancamentosDaUnidade.flatMap((item) => [item.dataVencimento, item.dataPagamento])),
    [lancamentosDaUnidade]
  );

  const eventosNoPeriodo = useMemo(() => {
    if (!periodoAplicadoAtivo) return null;
    return lancamentosDaUnidade.reduce((total, item) => {
      const previsto = isDateInRange(item.dataVencimento, periodoAplicado) ? 1 : 0;
      const realizado = item.status === 'PAGO' && isDateInRange(item.dataPagamento || item.dataVencimento, periodoAplicado) ? 1 : 0;
      return total + previsto + realizado;
    }, 0);
  }, [lancamentosDaUnidade, periodoAplicado, periodoAplicadoAtivo]);

  const fluxoData = useMemo<FluxoAgrupado[]>(() => {
    const buckets = new Map<string, FluxoAgrupado>();
    const inScope = (date: string) => !periodoAplicadoAtivo || isDateInRange(date, periodoAplicado);
    const ensureBucket = (date: string) => {
      const info = getPeriodInfo(date);
      const existing = buckets.get(info.chave);
      if (existing) return existing;
      const bucket: FluxoAgrupado = { ...info, Previsto: 0, Realizado: 0, EntradasRealizadas: 0, SaidasRealizadas: 0, SaldoAcumulado: 0 };
      buckets.set(info.chave, bucket);
      return bucket;
    };

    lancamentosDaUnidade.forEach((item) => {
      const signedValue = item.tipo === 'RECEITA' ? item.valor : -item.valor;
      const dueDate = normalizeDateValue(item.dataVencimento);
      if (dueDate && inScope(dueDate)) ensureBucket(dueDate).Previsto += signedValue;
      if (item.status === 'PAGO') {
        const paymentDate = normalizeDateValue(item.dataPagamento || item.dataVencimento);
        if (paymentDate && inScope(paymentDate)) {
          const bucket = ensureBucket(paymentDate);
          bucket.Realizado += signedValue;
          if (item.tipo === 'RECEITA') bucket.EntradasRealizadas += item.valor;
          else bucket.SaidasRealizadas += item.valor;
        }
      }
    });

    if (periodoAplicadoAtivo) {
      const cursor = parseDate(periodoAplicado.inicio);
      const end = parseDate(periodoAplicado.fim);
      while (cursor <= end) {
        ensureBucket(toDateValue(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    let saldoAcumulado = 0;
    return Array.from(buckets.values()).sort((a, b) => a.ordem - b.ordem).map((bucket) => {
      saldoAcumulado += bucket.Realizado;
      return { ...bucket, SaldoAcumulado: saldoAcumulado };
    });
  }, [lancamentosDaUnidade, periodoAplicado, periodoAplicadoAtivo]);

  const eventosCalendario = useMemo(() => lancamentosDaUnidade.filter((item) => {
    const dataEvento = normalizeDateValue(item.status === 'PAGO' ? item.dataPagamento || item.dataVencimento : item.dataVencimento);
    return dataEvento.startsWith(mesCalendario);
  }), [lancamentosDaUnidade, mesCalendario]);

  const diasCalendario = useMemo<DiaCalendario[]>(() => {
    const [year, month] = mesCalendario.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const gridStart = new Date(year, month - 1, 1 - first.getDay());
    const grid = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const data = toDateValue(date);
      const itens = eventosCalendario.filter((item) =>
        normalizeDateValue(item.status === 'PAGO' ? item.dataPagamento || item.dataVencimento : item.dataVencimento) === data
      );
      const receitas = itens.filter((item) => item.tipo === 'RECEITA').reduce((sum, item) => sum + item.valor, 0);
      const despesas = itens.filter((item) => item.tipo === 'DESPESA').reduce((sum, item) => sum + item.valor, 0);
      return { data, dia: date.getDate(), noMes: date.getMonth() === month - 1, receitas, despesas, resultado: receitas - despesas, saldoProjetado: 0, lancamentos: itens };
    });
    let saldoProjetado = 0;
    return grid.map((dia) => {
      if (dia.noMes) saldoProjetado += dia.resultado;
      return { ...dia, saldoProjetado };
    });
  }, [eventosCalendario, mesCalendario]);

  const totaisCalendario = useMemo(() => {
    const receitas = eventosCalendario.filter((item) => item.tipo === 'RECEITA').reduce((sum, item) => sum + item.valor, 0);
    const despesas = eventosCalendario.filter((item) => item.tipo === 'DESPESA').reduce((sum, item) => sum + item.valor, 0);
    const realizado = eventosCalendario.filter((item) => item.status === 'PAGO').reduce((sum, item) => sum + (item.tipo === 'RECEITA' ? item.valor : -item.valor), 0);
    const pendente = eventosCalendario.filter((item) => item.status !== 'PAGO').reduce((sum, item) => sum + (item.tipo === 'RECEITA' ? item.valor : -item.valor), 0);
    return { receitas, despesas, resultado: receitas - despesas, realizado, pendente };
  }, [eventosCalendario]);

  const contasAtivasUnidade = bancos.filter((banco) =>
    banco.ativo && (unidadeFluxo === 'Todas as Unidades' || banco.unidade === unidadeFluxo)
  );
  const saldoAtual = contasAtivasUnidade.reduce((sum, banco) => sum + banco.saldo, 0);
  const saldoAposPendencias = saldoAtual + totaisCalendario.pendente;
  const detalheDia = diasCalendario.find((dia) => dia.data === diaSelecionado);
  const formatDate = (value: string) => parseDate(value).toLocaleDateString('pt-BR');
  const periodoAplicadoLabel = `${formatDate(periodoAplicado.inicio)} até ${formatDate(periodoAplicado.fim)}`;
  const { sortedItems: sortedFluxoData, sortConfig, requestSort } = useSortableData(fluxoData);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2"><span className="material-symbols-outlined text-[#131b2e]">show_chart</span>Fluxo de Caixa e Calendário Financeiro</h2>
          <p className="text-xs text-gray-500 mt-0.5">Compare previsto, realizado, receitas, despesas e giro financeiro por unidade.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Unidade analisada</label>
            <select value={unidadeFluxo} onChange={(event) => setUnidadeFluxo(event.target.value)} disabled={isFinance} className="px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold bg-white disabled:bg-gray-100">
              {!isFinance && <option value="Todas as Unidades">Todas as Unidades (Consolidado)</option>}
              {units.filter((unit) => unit.ativa && (!isFinance || unit.nome === currentUser?.unit)).map((unit) => <option key={unit.id} value={unit.nome}>{unit.nome}</option>)}
            </select>
          </div>
          <div className="flex rounded-lg border border-[#d3e4fe] p-1 bg-[#f8f9ff]">
            <button onClick={() => setVisao('GRAFICO')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${visao === 'GRAFICO' ? 'bg-[#131b2e] text-white' : 'text-gray-600'}`}>Gráfico diário</button>
            <button onClick={() => setVisao('CALENDARIO')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${visao === 'CALENDARIO' ? 'bg-[#131b2e] text-white' : 'text-gray-600'}`}>Calendário</button>
          </div>
        </div>
      </div>

      {visao === 'GRAFICO' ? (
        <>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff] shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
              <div><h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Período personalizado</h3><p className="text-[11px] text-gray-500 mt-0.5">A consulta inicia na competência aberta. Informe as duas datas e aplique o período.</p></div>
              <div className="flex flex-wrap items-end gap-2">
                <div><label className="block text-[10px] font-semibold text-gray-600 mb-1">Data inicial</label><input type="date" value={dataInicioInput} onChange={(event) => setDataInicioInput(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white" /></div>
                <div><label className="block text-[10px] font-semibold text-gray-600 mb-1">Data final</label><input type="date" value={dataFimInput} onChange={(event) => setDataFimInput(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white" /></div>
                <button type="button" onClick={() => setPeriodoAplicado({ inicio: normalizeDateValue(dataInicioInput), fim: normalizeDateValue(dataFimInput) })} disabled={periodoPersonalizadoInvalido || !periodoInputCompleto} className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold disabled:bg-gray-300">Aplicar período</button>
                <button type="button" onClick={() => { setDataInicioInput(competenciaAbertaRange.inicio); setDataFimInput(competenciaAbertaRange.fim); setPeriodoAplicado(competenciaAbertaRange); }} className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600">Restaurar competência</button>
              </div>
            </div>
            {periodoPersonalizadoInvalido ? <p className="text-[11px] font-semibold text-rose-600 mt-2">A data inicial não pode ser posterior à data final.</p> : (
              <div className="mt-2 space-y-1"><p className="text-[11px] font-semibold text-[#775a19]">Período exibido: {periodoAplicadoLabel} · {unidadeFluxo}</p>{periodoDisponivel.min && periodoDisponivel.max && <p className="text-[11px] text-gray-500">Movimentações cadastradas: {formatDate(periodoDisponivel.min)} até {formatDate(periodoDisponivel.max)}{eventosNoPeriodo !== null && ` · ${eventosNoPeriodo} evento(s) no intervalo`}</p>}{eventosNoPeriodo === 0 && <p className="text-[11px] font-semibold text-amber-700">Não existem vencimentos ou pagamentos no período para esta unidade.</p>}</div>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#0b1c30]">Curva de Saldo Acumulado e Entradas/Saídas</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Soma todos os lançamentos de {unidadeFluxo}, mesmo quando a unidade possui mais de uma conta; o saldo acumulado do período inicia em zero.</p>
              </div>
              <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2.5 py-1 rounded">Visão diária · {periodoAplicadoLabel}</span>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fluxoData} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<FluxoTooltip />} />
                  <Legend />
                  <Line name="Saldo acumulado no período" type="monotone" dataKey="SaldoAcumulado" stroke="#131b2e" strokeWidth={3} dot={{ r: 4 }} />
                  <Line name="Resultado realizado" type="monotone" dataKey="Realizado" stroke="#059669" strokeWidth={2} />
                  <Line name="Resultado previsto" type="monotone" dataKey="Previsto" stroke="#C5A059" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]"><h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Detalhamento diário do Fluxo de Caixa</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead><tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                  <SortableTableHeader label="Período" sortKey="periodo" accessor={(item) => item.ordem} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Entradas realizadas" sortKey="entradas" accessor={(item) => item.EntradasRealizadas} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                  <SortableTableHeader label="Saídas realizadas" sortKey="saidas" accessor={(item) => item.SaidasRealizadas} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                  <SortableTableHeader label="Resultado realizado" sortKey="resultado" accessor={(item) => item.Realizado} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                  <SortableTableHeader label="Saldo acumulado" sortKey="saldo" accessor={(item) => item.SaldoAcumulado} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                </tr></thead>
                <tbody className="divide-y divide-gray-100">{sortedFluxoData.map((row) => <tr key={row.chave} className="hover:bg-gray-50"><td className="p-3 font-bold text-[#0b1c30]">{row.periodo}</td><td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(row.EntradasRealizadas)}</td><td className="p-3 text-right font-bold text-rose-700">{formatCurrency(row.SaidasRealizadas)}</td><td className={`p-3 text-right font-bold ${row.Realizado >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{formatCurrency(row.Realizado)}</td><td className="p-3 text-right font-black text-[#0b1c30]">{formatCurrency(row.SaldoAcumulado)}</td></tr>)}{fluxoData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhuma movimentação encontrada.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-[#e5eeff]"><p className="text-[10px] font-bold text-gray-500 uppercase">Receitas do mês</p><p className="text-lg font-black text-emerald-700 mt-1">{formatCurrency(totaisCalendario.receitas)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-[#e5eeff]"><p className="text-[10px] font-bold text-gray-500 uppercase">Despesas do mês</p><p className="text-lg font-black text-rose-700 mt-1">{formatCurrency(totaisCalendario.despesas)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-[#e5eeff]"><p className="text-[10px] font-bold text-gray-500 uppercase">Resultado do mês</p><p className={`text-lg font-black mt-1 ${totaisCalendario.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(totaisCalendario.resultado)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-[#e5eeff]"><p className="text-[10px] font-bold text-gray-500 uppercase">Saldo atual das contas</p><p className="text-lg font-black text-[#0b1c30] mt-1">{formatCurrency(saldoAtual)}</p><p className="text-[9px] text-gray-500 mt-1">{contasAtivasUnidade.length} conta(s) ativa(s) somada(s)</p></div>
            <div className="bg-[#eff4ff] p-4 rounded-xl border border-[#d3e4fe]"><p className="text-[10px] font-bold text-[#0b1c30] uppercase">Saldo após pendências do mês</p><p className={`text-lg font-black mt-1 ${saldoAposPendencias >= 0 ? 'text-[#0b1c30]' : 'text-rose-700'}`}>{formatCurrency(saldoAposPendencias)}</p></div>
          </div>

          <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#e5eeff] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div><div className="flex items-center gap-2"><button onClick={() => { setMesCalendario(shiftMonth(mesCalendario, -1)); setDiaSelecionado(null); }} className="p-2 rounded-lg border border-gray-200"><span className="material-symbols-outlined text-base">chevron_left</span></button><h3 className="min-w-44 text-center text-sm font-black text-[#0b1c30]">{monthLabel(mesCalendario)}</h3><button onClick={() => { setMesCalendario(shiftMonth(mesCalendario, 1)); setDiaSelecionado(null); }} className="p-2 rounded-lg border border-gray-200"><span className="material-symbols-outlined text-base">chevron_right</span></button></div><p className="text-[9px] text-gray-500 mt-1">A projeção acumulada começa em zero e considera todas as receitas e despesas da unidade.</p></div>
              <div className="flex items-center gap-1 bg-[#f8f9ff] border border-[#e5eeff] rounded-lg p-1">{(['COMPARATIVO', 'RECEITAS', 'DESPESAS'] as ModoCalendario[]).map((modo) => <button key={modo} onClick={() => setModoCalendario(modo)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold ${modoCalendario === modo ? 'bg-[#131b2e] text-white' : 'text-gray-600'}`}>{modo === 'COMPARATIVO' ? 'Receitas × Despesas' : modo.charAt(0) + modo.slice(1).toLowerCase()}</button>)}</div>
            </div>
            <div className="grid grid-cols-7 bg-[#eff4ff] text-center text-[10px] font-bold uppercase text-[#0b1c30]">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div key={day} className="p-2 border-r border-[#d3e4fe] last:border-r-0">{day}</div>)}</div>
            <div className="grid grid-cols-7">
              {diasCalendario.map((dia) => (
                <button key={dia.data} onClick={() => setDiaSelecionado(dia.data)} className={`min-h-28 p-2 border-r border-b border-[#e5eeff] text-left hover:bg-[#f8f9ff] ${!dia.noMes ? 'bg-gray-50 opacity-45' : ''} ${diaSelecionado === dia.data ? 'ring-2 ring-inset ring-[#C5A059]' : ''}`}>
                  <span className="text-[11px] font-bold text-gray-600">{dia.dia}</span>
                  <div className="mt-2 space-y-1">
                    {modoCalendario !== 'DESPESAS' && dia.receitas > 0 && <p className="truncate rounded bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700">+ {formatCurrency(dia.receitas)}</p>}
                    {modoCalendario !== 'RECEITAS' && dia.despesas > 0 && <p className="truncate rounded bg-rose-50 px-1.5 py-1 text-[10px] font-bold text-rose-700">− {formatCurrency(dia.despesas)}</p>}
                    {modoCalendario === 'COMPARATIVO' && (dia.receitas > 0 || dia.despesas > 0) && <p className={`truncate px-1 text-[9px] font-black ${dia.resultado >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>Resultado {formatCurrency(dia.resultado)}</p>}
                    {(dia.receitas > 0 || dia.despesas > 0) && <p className={`truncate rounded px-1.5 py-1 text-[9px] font-black ${dia.saldoProjetado >= 0 ? 'bg-blue-50 text-blue-800' : 'bg-rose-100 text-rose-900'}`}>Saldo proj. {dia.saldoProjetado >= 0 ? '+' : '−'} {formatCurrency(Math.abs(dia.saldoProjetado))}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {detalheDia && (
            <div className="bg-white rounded-xl border border-[#e5eeff] p-5">
              <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#0b1c30]">Movimentações de {formatDate(detalheDia.data)}</h3><p className="text-[11px] text-gray-500">{detalheDia.lancamentos.length} lançamento(s) · {unidadeFluxo}</p><p className={`text-[11px] font-black mt-1 ${detalheDia.saldoProjetado >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>Saldo projetado acumulado até o dia: {detalheDia.saldoProjetado >= 0 ? '+' : '−'} {formatCurrency(Math.abs(detalheDia.saldoProjetado))}</p></div><button onClick={() => setDiaSelecionado(null)} className="text-gray-500"><span className="material-symbols-outlined">close</span></button></div>
              <div className="mt-3 divide-y divide-gray-100">{detalheDia.lancamentos.map((item) => <div key={item.id} className="py-3 flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-[#0b1c30]">{item.descricao}</p><p className="text-[10px] text-gray-500">{item.fornecedorCliente} · {item.status} · {item.unidade}</p></div><p className={`text-xs font-black ${item.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'}`}>{item.tipo === 'RECEITA' ? '+' : '−'} {formatCurrency(item.valor)}</p></div>)}{detalheDia.lancamentos.length === 0 && <p className="py-5 text-center text-xs text-gray-500">Nenhum lançamento nesta data.</p>}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
