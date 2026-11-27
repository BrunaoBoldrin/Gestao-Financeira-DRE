import { isMonthValue, normalizeDateValue } from './dateRange';

export type CalendarPrecision = 'day' | 'month';

export function formatCalendarInput(raw: string, precision: CalendarPrecision): string {
  const value = raw.trim();
  const parts = precision === 'month'
    ? /^(\d{4})-(\d{2})$/.exec(value)
    : /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (parts) return parts.slice(1).reverse().join('/');

  const digits = value.replace(/\D/g, '');
  if (precision === 'month') return [digits.slice(0, 2), digits.slice(2, 6)].filter(Boolean).join('/');
  const pastedDate = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (pastedDate) {
    return [pastedDate[1].padStart(2, '0'), pastedDate[2].padStart(2, '0'), pastedDate[3]].join('/');
  }
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

export function readCalendarInput(value: string, precision: CalendarPrecision): string {
  if (precision === 'day') return /^\d{2}\/\d{2}\/[1-9]\d{3}$/.test(value) ? normalizeDateValue(value) : '';
  const month = /^(\d{2})\/([1-9]\d{3})$/.exec(value);
  const result = month ? `${month[2]}-${month[1]}` : '';
  return isMonthValue(result) ? result : '';
}

export function readMoneyInput(raw: string) {
  const cleaned = raw.replace(/\s/g, '').replace('−', '-').replace(/^(-?)R\$/i, '$1');
  const parts = /^(-?)([\d.,]*)$/.exec(cleaned);
  if (!parts) return null;
  const [, sign, amount] = parts;
  const dot = amount.lastIndexOf('.');
  const comma = amount.lastIndexOf(',');
  const groupedReais = /^\d{1,3}(?:\.\d{3})+$/.test(amount);
  const separator = groupedReais ? -1 : Math.max(dot, comma);
  const integer = separator >= 0 ? amount.slice(0, separator) : amount;
  const integerPattern = amount[separator] === '.' ? /^\d{1,3}(?:,\d{3})+$/ : /^\d{1,3}(?:\.\d{3})+$/;
  if (!/^\d*$/.test(integer) && !integerPattern.test(integer)) return null;
  const reais = integer.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const cents = separator >= 0 ? amount.slice(separator + 1).replace(/\D/g, '').slice(0, 2) : '';
  const whole = reais || (separator >= 0 ? '0' : '');
  return {
    draft: whole ? sign + whole + (separator >= 0 ? ',' + cents : '') : sign,
    value: whole ? sign + whole + (cents ? '.' + cents : '') : '',
  };
}

export function formatMoneyInput(value: string): string {
  if (!value) return '';
  const canonical = /^-?\d+(?:\.\d{1,2})?$/.test(value) ? value : readMoneyInput(value)?.value;
  if (!canonical) return '';
  const [reais, cents = ''] = canonical.split('.');
  return `${reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${cents.padEnd(2, '0')}`;
}
