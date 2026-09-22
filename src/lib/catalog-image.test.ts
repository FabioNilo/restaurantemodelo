import { describe, expect, it } from 'vitest';
import { getCatalogImageSources } from './catalog-image';

describe('getCatalogImageSources', () => {
  it('returns responsive optimized menu images for public catalog filenames', () => {
    expect(getCatalogImageSources('/Risoto de File\u0301 Mignon.jpg')).toEqual({
      src: '/menu/risoto-de-file-mignon-400.webp',
      srcSet: '/menu/risoto-de-file-mignon-400.webp 400w, /menu/risoto-de-file-mignon-800.webp 800w',
      sizes: '(max-width: 640px) 92vw, (max-width: 1024px) 44vw, 320px',
    });
  });

  it('repairs legacy mojibake filenames before building optimized paths', () => {
    expect(getCatalogImageSources('/Risoto de Fil\u00c3\u00a9 Mignon.jpg')?.src).toBe(
      '/menu/risoto-de-file-mignon-400.webp'
    );
    expect(getCatalogImageSources('/Risoto de Fil\u00c3\u0192\u00c2\u00a9 Mignon.jpg')?.src).toBe(
      '/menu/risoto-de-file-mignon-400.webp'
    );
  });

  it('handles the highlighted menu items with accents and cedilla', () => {
    expect(getCatalogImageSources('/Talharim ao Camara\u0303o Provenc\u0327al.jpg')?.src).toBe(
      '/menu/talharim-ao-camarao-provencal-400.webp'
    );
    expect(getCatalogImageSources('/Talharim ao Camar\u00c3\u00a3o Proven\u00c3\u00a7al.jpg')?.src).toBe(
      '/menu/talharim-ao-camarao-provencal-400.webp'
    );
    expect(getCatalogImageSources('/Nhoque a\u0300 Bolonhesa.jpg')?.src).toBe(
      '/menu/nhoque-a-bolonhesa-400.webp'
    );
    expect(getCatalogImageSources('/Nhoque \u00c3\u00a0 Bolonhesa.jpg')?.src).toBe(
      '/menu/nhoque-a-bolonhesa-400.webp'
    );
  });
});
