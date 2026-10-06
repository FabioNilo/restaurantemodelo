// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildProdutoFiltro, SEM_CATEGORIA } from './catalog.js';

describe('buildProdutoFiltro', () => {
  it('sem filtros não restringe nada', () => {
    expect(buildProdutoFiltro({})).toEqual({ where: '', params: [] });
    expect(buildProdutoFiltro({ busca: '   ' })).toEqual({ where: '', params: [] });
  });

  it('busca por nome ignora acento e caixa, e trata % e _ como texto', () => {
    const { where, params } = buildProdutoFiltro({ busca: ' 50%_café ' });
    expect(where).toContain('unaccent(lower(nome)) like');
    expect(params).toEqual(['%50\\%\\_café%']);
  });

  it('combina busca e categoria, e entende "sem categoria"', () => {
    const combinado = buildProdutoFiltro({ busca: 'bolo', categoria_id: 'doces' });
    expect(combinado.where).toContain(' and categoria_id = $2');
    expect(combinado.params).toEqual(['%bolo%', 'doces']);
    expect(buildProdutoFiltro({ categoria_id: SEM_CATEGORIA })).toEqual({ where: 'where categoria_id is null', params: [] });
  });
});
