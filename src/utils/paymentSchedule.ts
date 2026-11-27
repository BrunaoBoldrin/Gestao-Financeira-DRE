import type { ParcelaPrevista } from '../types';
import { calculateDueDateSchedule } from './financialDates';

export type ParcelaEditavel = Omit<ParcelaPrevista, 'valor'> & { valor: string };

const isoDay = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime()
    : null;
};

export function centsFromAmount(value: string | number): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export const paymentTotal = (rows: { valor: number | string }[]) =>
  rows.reduce((total, row) => total + (centsFromAmount(row.valor) ?? 0), 0);

export function readPaymentSchedule(rows: ParcelaEditavel[]): ParcelaPrevista[] | null {
  const validated: ParcelaPrevista[] = [];
  for (const row of rows) {
    const cents = centsFromAmount(row.valor);
    if (isoDay(row.dataVencimento) === null || cents === null || cents <= 0) return null;
    validated.push({ ...row, valor: cents / 100 });
  }
  return validated.length && Number.isSafeInteger(paymentTotal(validated)) ? validated : null;
}

export function paymentTermsFromDates(issueDate: string, rows: Pick<ParcelaPrevista, 'dataVencimento'>[]): number[] {
  const issueDay = isoDay(issueDate);
  if (issueDay === null) return [];
  const days: number[] = [];
  for (const row of rows) {
    const dueDay = isoDay(row.dataVencimento);
    if (dueDay === null || dueDay < issueDay) return [];
    days.push((dueDay - issueDay) / 86_400_000);
  }
  return days.sort((left, right) => left - right);
}

export function buildPaymentSchedule(
  issueDate: string, terms: number[], total: string, firstDueDate?: string
): ParcelaEditavel[] {
  if (isoDay(issueDate) === null || !terms.length || terms.some((days) => !Number.isInteger(days) || days < 0)) {
    return [];
  }
  const cents = centsFromAmount(total) ?? 0;
  const share = Math.floor(cents / terms.length);
  const remainder = cents % terms.length;
  return calculateDueDateSchedule(issueDate, terms, firstDueDate).map((dataVencimento, index) => ({
    dataVencimento,
    valor: cents ? ((share + (index < remainder ? 1 : 0)) / 100).toFixed(2) : ''
  }));
}
