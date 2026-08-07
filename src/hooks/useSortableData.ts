import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortValue = string | number | boolean | Date | null | undefined;

export interface SortConfig<T> {
  key: string;
  direction: SortDirection;
  accessor: (item: T) => SortValue;
}

const collator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base'
});

const compareValues = (left: SortValue, right: SortValue) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  const normalizedLeft = left instanceof Date ? left.getTime() : left;
  const normalizedRight = right instanceof Date ? right.getTime() : right;

  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }

  if (typeof normalizedLeft === 'boolean' && typeof normalizedRight === 'boolean') {
    return Number(normalizedLeft) - Number(normalizedRight);
  }

  return collator.compare(String(normalizedLeft), String(normalizedRight));
};

export const useSortableData = <T,>(items: T[]) => {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(null);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const comparison = compareValues(
          sortConfig.accessor(left.item),
          sortConfig.accessor(right.item)
        );
        if (comparison === 0) return left.index - right.index;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      })
      .map(({ item }) => item);
  }, [items, sortConfig]);

  const requestSort = (key: string, accessor: (item: T) => SortValue) => {
    setSortConfig((current) => ({
      key,
      accessor,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return { sortedItems, sortConfig, requestSort };
};
