// Números digitados pelo admin em pt-BR: aceita vírgula ou ponto como decimal.
export function parseDecimal(raw: string) {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  return normalized === '' || !Number.isFinite(value) ? 0 : value;
}

export function formatDecimal(value: number) {
  return value ? String(value).replace('.', ',') : '';
}
