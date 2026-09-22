import { describe, expect, it } from 'vitest';
import { calcularTaxaEntrega, existeTaxaEspecialHoje, formatarDataLocal } from './deliveryFee';

const bairro = {
  taxa_quinta_sexta: 8,
  taxa_sab_dom_feriado: 12,
};

describe('delivery fee rules', () => {
  it('formats dates in the local Sao Paulo date format', () => {
    expect(formatarDataLocal('2026-07-02T12:00:00-03:00')).toBe('2026-07-02');
  });

  it('returns quinta/sexta fee on Thursday and Friday', () => {
    expect(calcularTaxaEntrega(bairro, '2026-07-02T12:00:00-03:00', [])).toBe(8);
    expect(calcularTaxaEntrega(bairro, '2026-07-03T12:00:00-03:00', [])).toBe(8);
  });

  it('returns sab/dom/feriado fee on Saturday and Sunday', () => {
    expect(calcularTaxaEntrega(bairro, '2026-07-04T12:00:00-03:00', [])).toBe(12);
    expect(calcularTaxaEntrega(bairro, '2026-07-05T12:00:00-03:00', [])).toBe(12);
  });

  it('returns null from Monday to Wednesday without an active special date', () => {
    expect(calcularTaxaEntrega(bairro, '2026-07-06T12:00:00-03:00', [])).toBeNull();
    expect(calcularTaxaEntrega(bairro, '2026-07-07T12:00:00-03:00', [])).toBeNull();
    expect(calcularTaxaEntrega(bairro, '2026-07-08T12:00:00-03:00', [])).toBeNull();
  });

  it('uses holiday fee for active special dates and ignores inactive ones', () => {
    expect(existeTaxaEspecialHoje('2026-07-02T12:00:00-03:00', [{ data: '2026-07-02', ativo: true }])).toBe(true);
    expect(calcularTaxaEntrega(bairro, '2026-07-02T12:00:00-03:00', [{ data: '2026-07-02', ativo: true }])).toBe(12);
    expect(calcularTaxaEntrega(bairro, '2026-07-02T12:00:00-03:00', [{ data: '2026-07-02', ativo: false }])).toBe(8);
  });
});
