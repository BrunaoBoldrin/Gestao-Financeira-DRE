export const normalizeText = (value?: string) =>
  (value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

export const normalizeTaxId = (value?: string) =>
  String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

export function formatTaxId(value: string): string {
  const document = normalizeTaxId(value).slice(0, 14);
  if (document.length > 11 || /[A-Z]/.test(document)) {
    return document
      .replace(/^(.{2})(?=.)/, '$1.')
      .replace(/^(..\....)(?=.)/, '$1.')
      .replace(/^(..\....\....)(?=.)/, '$1/')
      .replace(/^(..\....\....\/.{4})(?=.)/, '$1-');
  }
  return document
    .replace(/^(\d{3})(?=\d)/, '$1.')
    .replace(/^(\d{3}\.\d{3})(?=\d)/, '$1.')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(?=\d)/, '$1-');
}
