import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getDateRangeBounds, isDateInRange, normalizeDateValue } from '../../utils/dateRange';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
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

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

const toDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
  return {
    inicio: `${competencia}-01`,
    fim: `${competencia}-${String(lastDay).padStart(2, '0')}`
  };
};

export const FluxoCaixaView: React.FC = () => {
  const { lancamentos, selectedUnit, fechamentoMensal } = useApp();
  const competenciaAbertaRange = useMemo(
    () => getCompetenciaRange(fechamentoMensal.mesAno),
    [fechamentoMensal.mesAno]
  );
  const [dataInicioInput, setDataInicioInput] = useState(competenciaAbertaRange.inicio);
  const [dataFimInput, setDataFimInput] = useState(competenciaAbertaRange.fim);
  const [periodoAplicado, setPeriodoAplicado] = useState(competenciaAbertaRange);
  const periodoPersonalizadoInvalido = Boolean(
    dataInicioInput &&
    dataFimInput &&
    normalizeDateValue(dataInicioInput) > normalizeDateValue(dataFimInput)
  );
  const periodoInputCompleto = Boolean(dataInicioInput && dataFimInput);
  const periodoAplicadoAtivo = Boolean(periodoAplicado.inicio && periodoAplicado.fim);

  const lancamentosDaUnidade = useMemo(
    () => lancamentos.filter((lancamento) =>
      lancamento.status !== 'CANCELADO' &&
      (selectedUnit === 'Todas as Unidades' || lancamento.unidade === selectedUnit)
    ),
    [lancamentos, selectedUnit]
  );

  const periodoDisponivel = useMemo(
    () => getDateRangeBounds(lancamentosDaUnidade.flatMap((lancamento) => [
      lancamento.dataVencimento,
      lancamento.dataPagamento
    ])),
    [lancamentosDaUnidade]
  );

  const eventosNoPeriodo = useMemo(() => {
    if (!periodoAplicadoAtivo) return null;

    return lancamentosDaUnidade.reduce((total, lancamento) => {
      const previstoNoPeriodo = isDateInRange(lancamento.dataVencimento, periodoAplicado) ? 1 : 0;
      const realizadoNoPeriodo = lancamento.status === 'PAGO' &&
        isDateInRange(lancamento.dataPagamento || lancamento.dataVencimento, periodoAplicado) ? 1 : 0;
      return total + previstoNoPeriodo + realizadoNoPeriodo;
    }, 0);
  }, [lancamentosDaUnidade, periodoAplicado, periodoAplicadoAtivo]);

  const fluxoData = useMemo<FluxoAgrupado[]>(() => {
    const buckets = new Map<string, FluxoAgrupado>();

    const isDateInScope = (date: string) => {
      return !periodoAplicadoAtivo || isDateInRange(date, periodoAplicado);
    };

    const ensureBucket = (date: string) => {
      const info = getPeriodInfo(date);
      const existing = buckets.get(info.chave);
      if (existing) return existing;

      const bucket: FluxoAgrupado = {
        ...info,
        Previsto: 0,
        Realizado: 0,
        EntradasRealizadas: 0,
        SaidasRealizadas: 0,
        SaldoAcumulado: 0
      };
      buckets.set(info.chave, bucket);
      return bucket;
    };

    lancamentosDaUnidade.forEach((lancamento) => {
      const signedValue = lancamento.tipo === 'RECEITA' ? lancamento.valor : -lancamento.valor;
      const dueDate = normalizeDateValue(lancamento.dataVencimento);

      if (dueDate && isDateInScope(dueDate)) {
        ensureBucket(dueDate).Previsto += signedValue;
      }

      if (lancamento.status === 'PAGO') {
        const paymentDate = normalizeDateValue(lancamento.dataPagamento || lancamento.dataVencimento);
        if (paymentDate && isDateInScope(paymentDate)) {
          const bucket = ensureBucket(paymentDate);
          bucket.Realizado += signedValue;
          if (lancamento.tipo === 'RECEITA') {
            bucket.EntradasRealizadas += lancamento.valor;
          } else {
            bucket.SaidasRealizadas += lancamento.valor;
          }
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
    return Array.from(buckets.values())
      .sort((a, b) => a.ordem - b.ordem)
      .map((bucket) => {
        saldoAcumulado += bucket.Realizado;
        return { ...bucket, SaldoAcumulado: saldoAcumulado };
      });
  }, [lancamentosDaUnidade, periodoAplicado, periodoAplicadoAtivo]);

  const formatDate = (value: string) => parseDate(value).toLocaleDateString('pt-BR');
  const periodoAplicadoLabel = periodoAplicadoAtivo
    ? `${formatDate(periodoAplicado.inicio)} até ${formatDate(periodoAplicado.fim)}`
    : `${formatDate(competenciaAbertaRange.inicio)} até ${formatDate(competenciaAbertaRange.fim)}`;
  const { sortedItems: sortedFluxoData, sortConfig, requestSort } = useSortableData(fluxoData);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">show_chart</span>
            Fluxo de Caixa Operacional (Previsto vs Realizado)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Visão diária da competência aberta, respeitando a unidade e o período informado.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#e5eeff] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Período personalizado</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">A aba inicia com a competência aberta ({fechamentoMensal.mesAno}). Altere as duas datas e clique em Aplicar período para consultar outro intervalo.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data inicial</label>
              <input
                type="date"
                value={dataInicioInput}
                onChange={(event) => setDataInicioInput(event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data final</label>
              <input
                type="date"
                value={dataFimInput}
                onChange={(event) => setDataFimInput(event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>
            <button
              type="button"
              onClick={() => setPeriodoAplicado({
                inicio: normalizeDateValue(dataInicioInput),
                fim: normalizeDateValue(dataFimInput)
              })}
              disabled={periodoPersonalizadoInvalido || !periodoInputCompleto}
              className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Aplicar período
            </button>
            {(dataInicioInput || dataFimInput || periodoAplicadoAtivo) && (
              <button
                type="button"
                onClick={() => {
                  setDataInicioInput(competenciaAbertaRange.inicio);
                  setDataFimInput(competenciaAbertaRange.fim);
                  setPeriodoAplicado(competenciaAbertaRange);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Restaurar competência
              </button>
            )}
          </div>
        </div>
        {periodoPersonalizadoInvalido && (
          <p className="text-[11px] font-semibold text-rose-600 mt-2">A data inicial não pode ser posterior à data final.</p>
        )}
        {!periodoPersonalizadoInvalido && (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] font-semibold text-[#775a19]">Período exibido: {periodoAplicadoLabel}</p>
            {periodoDisponivel.min && periodoDisponivel.max && (
              <p className="text-[11px] text-gray-500">
                Movimentações cadastradas: {formatDate(periodoDisponivel.min)} até {formatDate(periodoDisponivel.max)}
                {eventosNoPeriodo !== null && ` · ${eventosNoPeriodo} evento(s) financeiro(s) no intervalo`}
              </p>
            )}
            {periodoAplicadoAtivo && eventosNoPeriodo === 0 && (
              <p className="text-[11px] font-semibold text-amber-700">
                Não existem vencimentos ou pagamentos no intervalo selecionado para esta unidade.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0b1c30]">Curva de Saldo Acumulado e Entradas/Saídas</h3>
          <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2.5 py-1 rounded">
            Visão diária · {periodoAplicadoLabel}
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fluxoData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: number) => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                contentStyle={{ backgroundColor: '#0b1c30', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />
              <Legend />
              <Line type="monotone" dataKey="SaldoAcumulado" stroke="#131b2e" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Realizado" stroke="#059669" strokeWidth={2} />
              <Line type="monotone" dataKey="Previsto" stroke="#C5A059" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Detalhamento diário do Fluxo de Caixa
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Período" sortKey="periodo" accessor={(item) => item.ordem} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Entradas realizadas" sortKey="entradas" accessor={(item) => item.EntradasRealizadas} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Saídas realizadas" sortKey="saidas" accessor={(item) => item.SaidasRealizadas} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Resultado realizado" sortKey="resultado" accessor={(item) => item.Realizado} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Saldo acumulado" sortKey="saldo" accessor={(item) => item.SaldoAcumulado} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedFluxoData.map((row) => {
                return (
                  <tr key={row.chave} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-[#0b1c30]">{row.periodo}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      R$ {row.EntradasRealizadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-700">
                      R$ {row.SaidasRealizadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-3 text-right font-bold ${row.Realizado >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      R$ {row.Realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-black text-[#0b1c30]">
                      R$ {row.SaldoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}

              {fluxoData.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhuma movimentação encontrada para os filtros selecionados.
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
