export function normalizeStock(value: unknown) {
  return Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0);
}

export function getAvailabilityFromStock(stock: number) {
  return stock > 0;
}
