export interface DateRange {
  inicio: string;
  fim: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const BR_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})/;

export const normalizeDateValue = (value?: string) => {
  if (!value) return '';

  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(ISO_DATE_PATTERN);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = trimmedValue.match(BR_DATE_PATTERN);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
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
