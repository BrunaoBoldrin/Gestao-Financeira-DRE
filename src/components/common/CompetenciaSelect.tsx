import React, { useMemo } from 'react';
import type { Lancamento } from '../../types';

interface CompetenciaSelectProps {
  value: string;
  onChange: (value: string) => void;
  lancamentos: Lancamento[];
  referenceMonth: string;
  allowAll?: boolean;
  disabled?: boolean;
  className?: string;
}

export const formatCompetencia = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const CompetenciaSelect: React.FC<CompetenciaSelectProps> = ({
  value,
  onChange,
  lancamentos,
  referenceMonth,
  allowAll = true,
  disabled = false,
  className = ''
}) => {
  const availableMonths = useMemo(() => {
    const months = new Set<string>(lancamentos.map((item) => item.dataVencimento.substring(0, 7)));
    const [referenceYear, referenceMonthNumber] = referenceMonth.split('-').map(Number);

    for (let index = 0; index < 12; index += 1) {
      const date = new Date(referenceYear, referenceMonthNumber - 1 - index, 1);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    if (value !== 'TODOS') months.add(value);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [lancamentos, referenceMonth, value]);

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={`px-3 py-2 border border-[#d3e4fe] rounded-lg text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${className}`}
    >
      {allowAll && <option value="TODOS">Todos os meses</option>}
      {availableMonths.map((month) => (
        <option key={month} value={month}>
          {formatCompetencia(month)}{month === referenceMonth ? ' (Atual)' : ''}
        </option>
      ))}
    </select>
  );
};
