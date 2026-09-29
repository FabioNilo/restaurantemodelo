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

  it('orders categories and products with the default café priority when order is missing', () => {
    const catalog = {
      categorias: [
        { id: 'bomboniere', nome: 'Bomboniere', ordem: null },
        { id: 'cafes', nome: 'Cafés', ordem: null },
        { id: 'sobremesas', nome: 'Sobremesas', ordem: null },
        { id: 'promocao-do-dia', nome: 'Promoção do dia', ordem: null },
      ],
      marmitas: [
        { id: 'bala', nome: 'Bala', descricao: null, categoria_id: 'bomboniere', preco: 0.25, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'pudim', nome: 'Pudim', descricao: null, categoria_id: 'sobremesas', preco: 8, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'cappuccino', nome: 'Cappuccino', descricao: null, categoria_id: 'cafes', preco: 11, estoque: 3, imagem_url: null, disponivel: true },
        { id: 'combo', nome: 'Combo light', descricao: null, categoria_id: 'promocao-do-dia', preco: 16.9, estoque: 3, imagem_url: null, disponivel: true },
      ],
    } satisfies CatalogoPublicoResponse;

    const normalized = normalizeCatalog(catalog);

    expect(normalized.categorias.map((item) => item.id)).toEqual(['promocao-do-dia', 'cafes', 'sobremesas', 'bomboniere']);
    expect(normalized.marmitas.map((item) => item.id)).toEqual(['combo', 'cappuccino', 'pudim', 'bala']);
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
