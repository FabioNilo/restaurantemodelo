import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from './useCatalogoPublicoQuery';
import type { CatalogoPublicoResponse } from '@/features/integrations/n8n-contracts';

describe('normalizeCatalog', () => {
  it('hides products with zero stock or unavailable status', () => {
    const catalog = {
      categorias: [],
      marmitas: [
        { id: 'ok', nome: 'Nhoque', descricao: null, categoria_id: null, preco: 30, estoque: 2, imagem_url: null, disponivel: true },
        { id: 'zero', nome: 'Risoto', descricao: null, categoria_id: null, preco: 40, estoque: 0, imagem_url: null, disponivel: true },
        { id: 'off', nome: 'Talharim', descricao: null, categoria_id: null, preco: 35, estoque: 4, imagem_url: null, disponivel: false },
      ],
    } satisfies CatalogoPublicoResponse;

    expect(normalizeCatalog(catalog).marmitas.map((item) => item.id)).toEqual(['ok']);
  });

  it('orders categories and products with the default restaurant priority when order is missing', () => {
    const catalog = {
      categorias: [
        { id: 'bebidas', nome: 'Bebidas', ordem: null },
        { id: 'gnocchi', nome: 'Gnocchi', ordem: null },
        { id: 'sobremesa', nome: 'Sobremesa', ordem: null },
        { id: 'risottos', nome: 'Risotto', ordem: null },
      ],
      marmitas: [
        { id: 'suco', nome: 'Suco', descricao: null, categoria_id: 'bebidas', preco: 8, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'tiramissu', nome: 'Tiramissu', descricao: null, categoria_id: 'sobremesa', preco: 18, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'nhoque', nome: 'Nhoque', descricao: null, categoria_id: 'gnocchi', preco: 40, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'risoto', nome: 'Risoto', descricao: null, categoria_id: 'risottos', preco: 42, estoque: 3, imagem_url: null, disponivel: true },
      ],
    } satisfies CatalogoPublicoResponse;

    const normalized = normalizeCatalog(catalog);

    expect(normalized.categorias.map((item) => item.id)).toEqual(['risottos', 'gnocchi', 'sobremesa', 'bebidas']);
    expect(normalized.marmitas.map((item) => item.id)).toEqual(['risoto', 'nhoque', 'tiramissu', 'suco']);
  });

  it('uses admin category order when it is configured', () => {
    const catalog = {
      categorias: [
        { id: 'bebidas', nome: 'Bebidas', ordem: 1 },
        { id: 'risottos', nome: 'Risotto', ordem: 2 },
      ],
      marmitas: [
        { id: 'risoto', nome: 'Risoto', descricao: null, categoria_id: 'risottos', preco: 42, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'suco', nome: 'Suco', descricao: null, categoria_id: 'bebidas', preco: 8, estoque: 3, imagem_url: null, disponivel: true },
      ],
    } satisfies CatalogoPublicoResponse;

    const normalized = normalizeCatalog(catalog);

    expect(normalized.categorias.map((item) => item.id)).toEqual(['bebidas', 'risottos']);
    expect(normalized.marmitas.map((item) => item.id)).toEqual(['suco', 'risoto']);
  });
});
