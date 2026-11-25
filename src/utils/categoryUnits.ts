import type { BancoMaster, CategoriaMaster, FornecedorMaster, UnitConfig } from '../types';
import { normalizeText } from './text';

export function findUnit(value: string | undefined, units: UnitConfig[]) {
  if (!value) return undefined;
  const candidates = units.filter((unit) => unit.id !== 'all');
  const exact = candidates.find((unit) => unit.id === value || unit.nome === value);
  if (exact) return exact;
  const name = normalizeText(value);
  const matches = candidates.filter((unit) => normalizeText(unit.nome) === name);
  return matches.length === 1 ? matches[0] : undefined;
}

// Account plans are shared across branches; a new transaction still needs an active branch.
export function categoryBelongsToUnit(_category: CategoriaMaster, unitName: string | undefined, units: UnitConfig[]): boolean {
  return Boolean(findUnit(unitName, units)?.ativa);
}

export function supplierBelongsToUnit(supplier: FornecedorMaster, unitName: string | undefined, units: UnitConfig[]): boolean {
  const unit = findUnit(unitName, units);
  return Boolean(unit?.ativa && (supplier.unidadeIds === undefined || supplier.unidadeIds.includes(unit.id)));
}

export function bankBelongsToUnit(bank: BancoMaster, unitName: string | undefined, units: UnitConfig[]): boolean {
  if (!unitName || !bank.unidade) return false;
  if (bank.unidade === unitName) return true;
  const unit = findUnit(unitName, units);
  return Boolean(unit && findUnit(bank.unidade, units)?.id === unit.id);
}

export const isPhysicalCashAccount = (account: Pick<BancoMaster, 'banco'>) =>
  /\bcaixa fisico\b/.test(normalizeText(account.banco));
