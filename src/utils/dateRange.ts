export interface DateRange {
  inicio: string;
  fim: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/;
const BR_DATE_PATTERN = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[T\s].*)?$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const normalizeDateParts = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return '';
  if (!Number.isInteger(month) || !Number.isInteger(day)) return '';

  const parsedDate = new Date(year, month - 1, day, 12);
  if (
    parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) return '';

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const normalizeDateValue = (value?: string | null) => {
  if (!value) return '';

  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    return normalizeDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const brMatch = trimmedValue.match(BR_DATE_PATTERN);
  if (brMatch) {
    const year = brMatch[3].length === 2 ? Number(`20${brMatch[3]}`) : Number(brMatch[3]);
    return normalizeDateParts(year, Number(brMatch[2]), Number(brMatch[1]));
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return normalizeDateParts(parsedDate.getFullYear(), parsedDate.getMonth() + 1, parsedDate.getDate());
};

export const isMonthValue = (value?: string | null): value is string =>
  Boolean(value && MONTH_PATTERN.test(value));

export const getMonthValue = (value?: string | null) => {
  const normalizedDate = normalizeDateValue(value);
  return normalizedDate ? normalizedDate.substring(0, 7) : '';
};

export const resolveReferenceMonth = (
  values: Array<string | undefined | null>,
  preferredMonth?: string | null,
  fallbackDate = new Date()
) => {
  if (isMonthValue(preferredMonth)) return preferredMonth;

  const latestAvailableMonth = values
    .map(getMonthValue)
    .filter(isMonthValue)
    .sort((a, b) => b.localeCompare(a))[0];

  if (latestAvailableMonth) return latestAvailableMonth;

  return `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}`;
};

export const isDateInRange = (value: string | undefined, range: DateRange) => {
  const normalizedValue = normalizeDateValue(value);
  const normalizedStart = normalizeDateValue(range.inicio);
  const normalizedEnd = normalizeDateValue(range.fim);

  if (!normalizedValue) return false;
  if (normalizedStart && normalizedValue < normalizedStart) return false;
  if (normalizedEnd && normalizedValue > normalizedEnd) return false;
  return true;
};

export const getDateRangeBounds = (values: Array<string | undefined>) => {
  const normalizedValues = values
    .map(normalizeDateValue)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));

  return {
    min: normalizedValues[0] || '',
    max: normalizedValues[normalizedValues.length - 1] || ''
  };
};
