import { describe, expect, it } from 'vitest';
import { chaveCusto, chaveOpcao, chavePreco, montarAlteracoes, valoresOriginais } from './edicao-lote';

const base = { categoria_id: 'doces', estoque: 3, disponivel: true, imagem_url: null, created_at: null };
const produtos = [
  { ...base, id: 'bolo', nome: 'Bolo', preco: 10, custo: 4 },
  {
    ...base,
    id: 'picole',
    nome: 'Picolé',
    preco: 10,
    custo: null,
    tamanhos: [
      { codigo: 'pistache', nome: 'Pistache', serve: '', preco: 12 },
      { codigo: 'morango', nome: 'Morango', serve: '', preco: 10 },
    ],
  },
];

describe('edição em lote', () => {
  it('lê os valores atuais, com custo vazio como 0', () => {
    const originais = valoresOriginais(produtos);
    expect(originais[chaveCusto('picole')]).toBe(0);
    expect(originais[chaveOpcao('picole', 'pistache')]).toBe(12);
  });

  it('envia só o que mudou, agrupado por produto', () => {
    const alteracoes = montarAlteracoes(produtos, {
      [chavePreco('bolo')]: 11,
      [chaveCusto('picole')]: 4.5,
      [chaveOpcao('picole', 'morango')]: 11,
    });
    expect(alteracoes).toEqual([
      { id: 'bolo', preco: 11 },
      { id: 'picole', custo: 4.5, opcoes: [{ codigo: 'morango', preco: 11 }] },
    ]);
  });

  it('apagar o custo (0) manda null; produto sem mudança fica de fora', () => {
    expect(montarAlteracoes(produtos, { [chaveCusto('bolo')]: 0 })).toEqual([{ id: 'bolo', custo: null }]);
    expect(montarAlteracoes(produtos, {})).toEqual([]);
  });
});
