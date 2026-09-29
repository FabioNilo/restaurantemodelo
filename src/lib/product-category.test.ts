import { Coffee, IceCreamCone, Utensils } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { getCategoryIcon, productMatchesSearch } from './product-category';
import { categoriasCardapio, produtosCardapio } from '@/data/cardapio';

describe('productMatchesSearch', () => {
  const polpa = {
    nome: 'Polpa de fruta',
    descricao: 'Polpa natural congelada.',
    tamanhos: [
      { codigo: 'opcao_acai', nome: 'Açaí', serve: '', preco: 3.5 },
      { codigo: 'opcao_cupuacu', nome: 'Cupuaçu', serve: '', preco: 3.5 },
    ],
  };

  it('ignores accents and case, and searches inside the options', () => {
    expect(productMatchesSearch(polpa, 'ACAI')).toBe(true);
    expect(productMatchesSearch(polpa, 'cupuacu')).toBe(true);
    expect(productMatchesSearch(polpa, 'morango')).toBe(false);
  });

  it('matches the category name and requires every term', () => {
    expect(productMatchesSearch({ nome: 'Cappuccino', descricao: null }, 'cafe', 'Cafés')).toBe(true);
    expect(productMatchesSearch({ nome: 'Cappuccino', descricao: null }, 'cafe bolo', 'Cafés')).toBe(false);
    expect(productMatchesSearch({ nome: 'Cappuccino', descricao: null }, '   ')).toBe(true);
  });
});

describe('getCategoryIcon', () => {
  it('maps café categories by keyword and falls back to a generic icon', () => {
    expect(getCategoryIcon({ id: 'cafes', nome: 'Cafés' })).toBe(Coffee);
    expect(getCategoryIcon({ id: 'x', nome: 'Picolés e sorvetes' })).toBe(IceCreamCone);
    expect(getCategoryIcon({ id: 'nova', nome: 'Categoria nova' })).toBe(Utensils);
  });
});

describe('cardápio do Nosso Bistrô', () => {
  it('keeps unique ids, valid categories and unique option codes per product', () => {
    const categoryIds = new Set(categoriasCardapio.map((categoria) => categoria.id));
    const productIds = produtosCardapio.map((produto) => produto.id);

    expect(new Set(productIds).size).toBe(productIds.length);

    for (const produto of produtosCardapio) {
      expect(categoryIds.has(produto.categoria_id!)).toBe(true);
      const codes = (produto.tamanhos ?? []).map((tamanho) => tamanho.codigo);
      expect(new Set(codes).size).toBe(codes.length);

      if (produto.disponivel) {
        expect(produto.preco).toBeGreaterThan(0);
      }
    }
  });
});
