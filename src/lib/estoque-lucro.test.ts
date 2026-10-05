import { describe, expect, it } from 'vitest';
import { calcularLucro, linhasEstoque } from './estoque-lucro';

const base = { categoria_id: 'bolos', disponivel: true, imagem_url: null, created_at: null };

describe('calcularLucro', () => {
  it('calcula lucro e margem sobre o preço de venda', () => {
    expect(calcularLucro(10, 6)).toEqual({ lucro: 4, margem: 40 });
  });

  it('não calcula nada sem custo', () => {
    expect(calcularLucro(10, null)).toEqual({ lucro: null, margem: null });
    expect(calcularLucro(10, undefined)).toEqual({ lucro: null, margem: null });
  });

  it('aceita custo zero e preço abaixo do custo', () => {
    expect(calcularLucro(10, 0)).toEqual({ lucro: 10, margem: 100 });
    expect(calcularLucro(10, 12).lucro).toBe(-2);
  });
});

describe('linhasEstoque', () => {
  const produtos = [
    { ...base, id: 'a', nome: 'Bolo', preco: 10, custo: 6, estoque: 5 },
    { ...base, id: 'b', nome: 'Café', preco: 5, custo: null, estoque: 3, categoria_id: null },
    { ...base, id: 'c', nome: 'Torta', preco: 20, custo: 8, estoque: 0 },
  ];
  const resultado = linhasEstoque(produtos, [{ id: 'bolos', nome: 'Bolos' }]);

  it('deixa lucro em branco para produto sem custo e fora dos totais', () => {
    expect(resultado.linhas[1]).toMatchObject({ categoria: 'Sem categoria', lucro: null, margem: null, lucroEstoque: null });
    expect(resultado.semCusto).toBe(1);
    expect(resultado.totais).toEqual({ estoque: 8, lucroEstoque: 20 });
  });

  it('marca como indisponível sem estoque', () => {
    expect(resultado.linhas.map((linha) => linha.status)).toEqual(['Disponível', 'Disponível', 'Indisponível']);
    expect(resultado.linhas[0]).toMatchObject({ categoria: 'Bolos', lucro: 4, lucroEstoque: 20 });
  });
});
