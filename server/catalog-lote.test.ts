// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, transactionMock } = vi.hoisted(() => ({ queryMock: vi.fn(), transactionMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, transaction: transactionMock, getSql: vi.fn() }));

import { buildProdutoFiltro, produtosLoteSchema, updateProdutosLote, updateProdutosMassa } from './catalog.js';

const PICOLE = {
  id: 'picole',
  nome: 'Picolé',
  tamanhos: [
    { codigo: 'pistache', nome: 'Pistache', serve: '', preco: 12 },
    { codigo: 'morango', nome: 'Morango', serve: '', preco: 10 },
  ],
};

beforeEach(() => {
  queryMock.mockReset();
  transactionMock.mockReset().mockResolvedValue([]);
});

describe('filtros rápidos da lista', () => {
  it('foto, disponibilidade, sem custo e estoque', () => {
    expect(buildProdutoFiltro({ foto: 'sem' }).where).toBe("where coalesce(imagem_url, '') = ''");
    expect(buildProdutoFiltro({ foto: 'com', disponibilidade: 'indisponivel' }).where).toBe("where coalesce(imagem_url, '') <> '' and not disponivel");
    expect(buildProdutoFiltro({ sem_custo: true, estoque: 'baixo' }).where).toBe('where custo is null and estoque between 1 and 5');
    expect(buildProdutoFiltro({ estoque: 'zerado', disponibilidade: 'disponivel' }).where).toBe('where disponivel and estoque = 0');
  });
});

describe('edição em lote', () => {
  it('grava preço, custo e o preço só das opções alteradas, tudo numa transação', async () => {
    queryMock.mockResolvedValue([PICOLE, { id: 'cafe', nome: 'Café', tamanhos: [] }]);

    await updateProdutosLote({
      itens: [
        { id: 'picole', custo: 4.5, opcoes: [{ codigo: 'morango', preco: 11 }] },
        { id: 'cafe', preco: 6, custo: null },
      ],
    });

    const [updates] = transactionMock.mock.calls[0];
    expect(updates).toHaveLength(2);
    const [sqlPicole, paramsPicole] = updates[0];
    expect(sqlPicole).toBe('update produtos set custo = $1, tamanhos = $2::jsonb, updated_at = now() where id = $3');
    expect(JSON.parse(paramsPicole[1])).toEqual([PICOLE.tamanhos[0], { ...PICOLE.tamanhos[1], preco: 11 }]);
    // null apaga o custo (produto volta a ficar "sem custo").
    expect(updates[1]).toEqual(['update produtos set preco = $1, custo = $2, updated_at = now() where id = $3', [6, null, 'cafe']]);
  });

  it('recusa opção que não existe mais e não grava nada', async () => {
    queryMock.mockResolvedValue([PICOLE]);
    await expect(updateProdutosLote({ itens: [{ id: 'picole', opcoes: [{ codigo: 'uva', preco: 9 }] }] })).rejects.toThrow('mudou');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('valida limites: até 25 produtos e preço maior que zero', () => {
    const muitos = Array.from({ length: 26 }, (_, i) => ({ id: `p${i}`, preco: 1 }));
    expect(produtosLoteSchema.safeParse({ itens: muitos }).success).toBe(false);
    expect(produtosLoteSchema.safeParse({ itens: [{ id: 'a', preco: 0 }] }).success).toBe(false);
    expect(produtosLoteSchema.safeParse({ itens: [{ id: 'a', custo: -1 }] }).success).toBe(false);
  });
});

describe('ações em massa', () => {
  it('disponibiliza vários produtos de uma vez', async () => {
    queryMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    expect(await updateProdutosMassa({ ids: ['a', 'b'], disponivel: true })).toEqual({ atualizados: 2 });
    expect(queryMock).toHaveBeenCalledWith('update produtos set disponivel = $1, updated_at = now() where id = any($2) returning id', [true, ['a', 'b']]);
  });

  it('"sem categoria" tira a categoria; categoria inexistente é recusada', async () => {
    queryMock.mockResolvedValue([{ id: 'a' }]);
    await updateProdutosMassa({ ids: ['a'], categoria_id: 'sem-categoria' });
    expect(queryMock).toHaveBeenCalledWith('update produtos set categoria_id = $1, updated_at = now() where id = any($2) returning id', [null, ['a']]);

    queryMock.mockReset().mockResolvedValue([]);
    await expect(updateProdutosMassa({ ids: ['a'], categoria_id: 'nao-existe' })).rejects.toThrow('Categoria não encontrada');
  });
});
