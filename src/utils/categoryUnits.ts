import type { CategoriaMaster, UnitConfig } from '../types';

/** Missing restrictions preserve availability of legacy accounts. Empty selections allow none. */
export function categoryBelongsToUnit(category: CategoriaMaster, unitName: string | undefined, units: UnitConfig[]): boolean {
  const unit = units.find(item => item.id !== 'all' && item.ativa && item.nome === unitName);
  return Boolean(unit && (category.unidadeIds === undefined || category.unidadeIds.includes(unit.id)));
}
