import React from 'react';
import type { SortConfig, SortValue } from '../../hooks/useSortableData';

interface SortableTableHeaderProps {
  label: React.ReactNode;
  sortKey: string;
  accessor: (item: any) => SortValue;
  sortConfig: SortConfig<any> | null;
  onSort: (key: string, accessor: (item: any) => SortValue) => void;
  className?: string;
}

export const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  label,
  sortKey,
  accessor,
  sortConfig,
  onSort,
  className = ''
}) => {
  const isActive = sortConfig?.key === sortKey;
  const icon = !isActive
    ? 'unfold_more'
    : sortConfig.direction === 'asc'
      ? 'arrow_upward'
      : 'arrow_downward';
  const directionLabel = isActive
    ? sortConfig.direction === 'asc' ? 'crescente' : 'decrescente'
    : 'não ordenada';

  return (
    <th className={className} aria-sort={
      !isActive ? 'none' : sortConfig.direction === 'asc' ? 'ascending' : 'descending'
    }>
      <button
        type="button"
        onClick={() => onSort(sortKey, accessor)}
        title={`Ordenação ${directionLabel}. Clique para alternar.`}
        className={`group inline-flex w-full items-center gap-1 rounded-sm hover:text-[#775a19] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
          className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : 'justify-start'
        }`}
      >
        <span>{label}</span>
        <span className={`material-symbols-outlined text-sm ${isActive ? 'text-[#C5A059]' : 'text-gray-400 group-hover:text-[#C5A059]'}`}>
          {icon}
        </span>
      </button>
    </th>
  );
};
