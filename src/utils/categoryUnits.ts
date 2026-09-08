import type { CategoriaMaster, FornecedorMaster, UnitConfig } from '../types';

// Account plans are shared across branches; a transaction still needs an active branch.
export function categoryBelongsToUnit(_category: CategoriaMaster, unitName: string | undefined, units: UnitConfig[]): boolean {
  return units.some(item => item.id !== 'all' && item.ativa && item.nome === unitName);
}

export function supplierBelongsToUnit(supplier: FornecedorMaster, unitName: string | undefined, units: UnitConfig[]): boolean {
  const unit = units.find(item => item.id !== 'all' && item.ativa && item.nome === unitName);
  return Boolean(unit && (supplier.unidadeIds === undefined || supplier.unidadeIds.includes(unit.id)));
}
