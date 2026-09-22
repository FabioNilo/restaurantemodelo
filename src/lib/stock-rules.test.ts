import { describe, expect, it } from 'vitest';
import { getAvailabilityFromStock, normalizeStock } from './stock-rules';

describe('stock rules', () => {
  it('normalizes invalid or negative stock values to zero', () => {
    expect(normalizeStock('-5')).toBe(0);
    expect(normalizeStock('abc')).toBe(0);
    expect(normalizeStock(null)).toBe(0);
  });

  it('marks products as unavailable when stock is zero', () => {
    expect(getAvailabilityFromStock(0)).toBe(false);
    expect(getAvailabilityFromStock(1)).toBe(true);
  });
});
