import React, { useState } from 'react';
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

export const FluxoCaixaView: React.FC = () => {
  const { lancamentos } = useApp();
  const [periodo, setPeriodo] = useState<'DIARIO' | 'SEMANAL' | 'MENSAL'>('DIARIO');

  const dailyData = [
    { dia: '01/05', Previsto: 4500, Realizado: 4500, SaldoAcumulado: 42000 },
    { dia: '02/05', Previsto: 2450, Realizado: 2450, SaldoAcumulado: 44450 },
    { dia: '05/05', Previsto: 1800, Realizado: 1800, SaldoAcumulado: 46250 },
    { dia: '08/05', Previsto: -5400, Realizado: -5400, SaldoAcumulado: 40850 },
    { dia: '10/05', Previsto: -9300, Realizado: -9300, SaldoAcumulado: 31550 },
    { dia: '15/05', Previsto: 680, Realizado: 680, SaldoAcumulado: 32230 },
    { dia: '20/05', Previsto: -2150, Realizado: 0, SaldoAcumulado: 30080 },
    { dia: '25/05', Previsto: 4500, Realizado: 0, SaldoAcumulado: 34580 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">show_chart</span>
            Fluxo de Caixa Operacional (Previsto vs Realizado)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Projeção financeira contínua de movimentações diárias, saldo acumulado e previsibilidade.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-[#f8f9ff] p-1 rounded-lg border border-[#d3e4fe]">
          <button
            onClick={() => setPeriodo('DIARIO')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodo === 'DIARIO' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-white'
            }`}
          >
            Diário
          </button>
          <button
            onClick={() => setPeriodo('SEMANAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodo === 'SEMANAL' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-white'
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => setPeriodo('MENSAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              periodo === 'MENSAL' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-white'
            }`}
          >
            Mensal
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0b1c30]">Curva de Saldo Acumulado e Entradas/Saídas</h3>
          <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2.5 py-1 rounded">
            Projeção Financeira
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR')}`}
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

      {/* Daily Cash Flow Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Detalhamento do Fluxo de Caixa ({periodo})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Data</th>
                <th className="p-3 text-right">Entradas (R$)</th>
                <th className="p-3 text-right">Saídas (R$)</th>
                <th className="p-3 text-right">Resultado do Dia</th>
                <th className="p-3 text-right">Saldo Final Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dailyData.map((row, idx) => {
                const entradas = row.Previsto > 0 ? row.Previsto : 0;
                const saidas = row.Previsto < 0 ? Math.abs(row.Previsto) : 0;
                const resultadoDia = entradas - saidas;

                return (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-bold text-[#0b1c30]">{row.dia}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      R$ {entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-700">
                      R$ {saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`p-3 text-right font-bold ${
                        resultadoDia >= 0 ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      R$ {resultadoDia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-black text-[#0b1c30]">
                      R$ {row.SaldoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
