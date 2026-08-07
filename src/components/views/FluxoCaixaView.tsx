import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
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

type PeriodoFluxo = 'DIARIO' | 'SEMANAL' | 'MENSAL';

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

const formatMonth = (date: Date) => {
  const text = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const getPeriodInfo = (dateValue: string, periodo: PeriodoFluxo) => {
  const date = parseDate(dateValue);

  if (periodo === 'MENSAL') {
    return {
      chave: dateValue.substring(0, 7),
      periodo: formatMonth(date),
      ordem: new Date(date.getFullYear(), date.getMonth(), 1).getTime()
    };
  }

  if (periodo === 'SEMANAL') {
    const start = new Date(date);
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return {
      chave: start.toISOString().substring(0, 10),
      periodo: `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
      ordem: start.getTime()
    };
  }

  return {
    chave: dateValue,
    periodo: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    ordem: date.getTime()
  };
};

export const FluxoCaixaView: React.FC = () => {
  const { lancamentos, selectedUnit, selectedMonthYear } = useApp();
  const [periodo, setPeriodo] = useState<PeriodoFluxo>('DIARIO');

  const fluxoData = useMemo<FluxoAgrupado[]>(() => {
    const buckets = new Map<string, FluxoAgrupado>();
    const lancamentosDaUnidade = lancamentos.filter((lancamento) =>
      lancamento.status !== 'CANCELADO' &&
      (selectedUnit === 'Todas as Unidades' || lancamento.unidade === selectedUnit)
    );

    const isDateInScope = (date: string) =>
      periodo === 'MENSAL' || selectedMonthYear === 'TODOS' || date.startsWith(selectedMonthYear);

    const ensureBucket = (date: string) => {
      const info = getPeriodInfo(date, periodo);
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

      if (isDateInScope(lancamento.dataVencimento)) {
        ensureBucket(lancamento.dataVencimento).Previsto += signedValue;
      }

      if (lancamento.status === 'PAGO') {
        const paymentDate = lancamento.dataPagamento || lancamento.dataVencimento;
        if (isDateInScope(paymentDate)) {
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

    let saldoAcumulado = 0;
    return Array.from(buckets.values())
      .sort((a, b) => a.ordem - b.ordem)
      .map((bucket) => {
        saldoAcumulado += bucket.Realizado;
        return { ...bucket, SaldoAcumulado: saldoAcumulado };
      });
  }, [lancamentos, periodo, selectedMonthYear, selectedUnit]);

  const periodoLabel = periodo === 'DIARIO' ? 'dia' : periodo === 'SEMANAL' ? 'semana' : 'mês';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">show_chart</span>
            Fluxo de Caixa Operacional (Previsto vs Realizado)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Valores agrupados por {periodoLabel}, respeitando a unidade e a competência selecionadas.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#f8f9ff] p-1 rounded-lg border border-[#d3e4fe]">
          {(['DIARIO', 'SEMANAL', 'MENSAL'] as PeriodoFluxo[]).map((option) => (
            <button
              key={option}
              onClick={() => setPeriodo(option)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                periodo === option ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-white'
              }`}
            >
              {option === 'DIARIO' ? 'Diário' : option === 'SEMANAL' ? 'Semanal' : 'Mensal'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0b1c30]">Curva de Saldo Acumulado e Entradas/Saídas</h3>
          <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2.5 py-1 rounded">
            Visão {periodoLabel}
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
            Detalhamento do Fluxo de Caixa — agrupamento por {periodoLabel}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Período</th>
                <th className="p-3 text-right">Entradas realizadas</th>
                <th className="p-3 text-right">Saídas realizadas</th>
                <th className="p-3 text-right">Resultado realizado</th>
                <th className="p-3 text-right">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fluxoData.map((row) => {
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
