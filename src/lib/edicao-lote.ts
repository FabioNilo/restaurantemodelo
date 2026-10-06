import type { MarmitaAdminListItem, ProdutoLoteAlteracao } from '@/types/product';

// Chaves do rascunho: "<produto>:preco", "<produto>:custo" e "<produto>:opcao:<codigo>".
export const chavePreco = (id: string) => `${id}:preco`;
export const chaveCusto = (id: string) => `${id}:custo`;
export const chaveOpcao = (id: string, codigo: string) => `${id}:opcao:${codigo}`;
export const centavos = (valor: number) => Math.round(valor * 100);

export function valoresOriginais(produtos: MarmitaAdminListItem[]) {
  const originais: Record<string, number> = {};
  for (const produto of produtos) {
    originais[chavePreco(produto.id)] = Number(produto.preco);
    originais[chaveCusto(produto.id)] = Number(produto.custo ?? 0);
    for (const opcao of produto.tamanhos ?? []) originais[chaveOpcao(produto.id, opcao.codigo)] = Number(opcao.preco);
  }
  return originais;
}

// Só o que mudou, agrupado por produto (formato da action marmitas.lote).
export function montarAlteracoes(produtos: MarmitaAdminListItem[], rascunho: Record<string, number>): ProdutoLoteAlteracao[] {
  return produtos.flatMap((produto) => {
    const alteracao: ProdutoLoteAlteracao = { id: produto.id };
    const preco = rascunho[chavePreco(produto.id)];
    const custo = rascunho[chaveCusto(produto.id)];

    if (preco !== undefined) alteracao.preco = preco;
    // Custo vazio (0) = sem custo informado.
    if (custo !== undefined) alteracao.custo = custo > 0 ? custo : null;

    const opcoes = (produto.tamanhos ?? [])
      .filter((opcao) => rascunho[chaveOpcao(produto.id, opcao.codigo)] !== undefined)
      .map((opcao) => ({ codigo: opcao.codigo, preco: rascunho[chaveOpcao(produto.id, opcao.codigo)] }));
    if (opcoes.length > 0) alteracao.opcoes = opcoes;

    return Object.keys(alteracao).length > 1 ? [alteracao] : [];
  });
}
