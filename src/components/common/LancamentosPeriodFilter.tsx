import React from 'react';
import { normalizeDateValue } from '../../utils/dateRange';

export type CompetenciaFilter = 'TODOS' | 'PERSONALIZADO' | string;

interface LancamentosPeriodFilterProps {
  competencia: CompetenciaFilter;
  availableMonths: string[];
  dataInicio: string;
  dataFim: string;
  periodoAplicado: { inicio: string; fim: string };
  resultCount: number;
  onCompetenciaChange: (value: CompetenciaFilter) => void;
  onDataInicioChange: (value: string) => void;
  onDataFimChange: (value: string) => void;
  onApplyPeriod: () => void;
  onClearPeriod: () => void;
}

const formatCompetencia = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

export const LancamentosPeriodFilter: React.FC<LancamentosPeriodFilterProps> = ({
  competencia,
  availableMonths,
  dataInicio,
  dataFim,
  periodoAplicado,
  resultCount,
  onCompetenciaChange,
  onDataInicioChange,
  onDataFimChange,
  onApplyPeriod,
  onClearPeriod
}) => {
  const customMode = competencia === 'PERSONALIZADO';
  const invalidRange = Boolean(
    dataInicio && dataFim && normalizeDateValue(dataInicio) > normalizeDateValue(dataFim)
  );
  const completeRange = Boolean(dataInicio && dataFim);
  const appliedRangeActive = Boolean(periodoAplicado.inicio && periodoAplicado.fim);

  return (
    <div className="px-4 py-3 bg-white border-b border-[#e5eeff] space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="w-full sm:w-64">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Competência da tabela e dos totais
          </label>
          <select
            value={competencia}
            onChange={(event) => onCompetenciaChange(event.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e]"
          >
            <option value="TODOS">Todos os meses</option>
            {availableMonths.map((month) => (
              <option key={month} value={month}>{formatCompetencia(month)}</option>
            ))}
            <option value="PERSONALIZADO">Período personalizado</option>
          </select>
        </div>

        {customMode && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data inicial</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(event) => onDataInicioChange(event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data final</label>
              <input
                type="date"
                value={dataFim}
                onChange={(event) => onDataFimChange(event.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>
            <button
              type="button"
              onClick={onApplyPeriod}
              disabled={!completeRange || invalidRange}
              className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Aplicar período
            </button>
            {(dataInicio || dataFim || appliedRangeActive) && (
              <button
                type="button"
                onClick={onClearPeriod}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="font-semibold text-[#775a19]">
          {competencia === 'TODOS'
            ? 'Exibindo todos os meses'
            : customMode
              ? appliedRangeActive
                ? `Período aplicado: ${formatDate(periodoAplicado.inicio)} até ${formatDate(periodoAplicado.fim)}`
                : 'Informe as duas datas e clique em Aplicar período'
              : `Competência: ${formatCompetencia(competencia)}`}
        </span>
        <span className="text-gray-500">{resultCount} lançamento(s) no período</span>
        {invalidRange && (
          <span className="font-semibold text-rose-600">A data inicial não pode ser posterior à data final.</span>
        )}
      </div>
    </div>
  );
};
