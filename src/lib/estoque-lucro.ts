import type { Categoria, MarmitaAdminListItem } from '@/types/product';

export interface LucroProduto {
  /** null = custo não informado: não há lucro nem margem para calcular. */
  lucro: number | null;
  /** Percentual do preço de venda (lucro / preço), ex.: 42.5. */
  margem: number | null;
}

const arredonda = (valor: number) => Math.round(valor * 100) / 100;

export function calcularLucro(preco: number, custo: number | null | undefined): LucroProduto {
  if (custo === null || custo === undefined || !Number.isFinite(custo)) {
    return { lucro: null, margem: null };
  }

  const lucro = arredonda(preco - custo);
  return { lucro, margem: preco > 0 ? arredonda((lucro / preco) * 100) : null };
}

export interface LinhaEstoque {
  produto: string;
  categoria: string;
  custo: number | null;
  preco: number;
  lucro: number | null;
  margem: number | null;
  estoque: number;
  lucroEstoque: number | null;
  status: string;
}

export const CABECALHO_ESTOQUE = [
  'Produto',
  'Categoria',
  'Custo (R$)',
  'Venda (R$)',
  'Lucro unitário (R$)',
  'Margem (%)',
  'Estoque',
  'Lucro potencial (R$)',
  'Status',
];

// Linhas da planilha de estoque (testável sem o exceljs). Produto sem custo fica com
// lucro/margem em branco e fora dos totais.
export function linhasEstoque(produtos: MarmitaAdminListItem[], categorias: Pick<Categoria, 'id' | 'nome'>[]) {
  const nomeCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));

  const linhas: LinhaEstoque[] = produtos.map((produto) => {
    const preco = Number(produto.preco);
    const estoque = Number(produto.estoque ?? 0);
    const custo = produto.custo === null || produto.custo === undefined ? null : Number(produto.custo);
    const { lucro, margem } = calcularLucro(preco, custo);

    return {
      produto: produto.nome,
      categoria: (produto.categoria_id && nomeCategoria.get(produto.categoria_id)) || 'Sem categoria',
      custo,
      preco,
      lucro,
      margem,
      estoque,
      lucroEstoque: lucro === null ? null : arredonda(lucro * estoque),
      status: produto.disponivel !== false && estoque > 0 ? 'Disponível' : 'Indisponível',
    };
  });

  const comCusto = linhas.filter((linha) => linha.lucro !== null);

  return {
    linhas,
    semCusto: linhas.length - comCusto.length,
    totais: {
      estoque: linhas.reduce((soma, linha) => soma + linha.estoque, 0),
      lucroEstoque: arredonda(comCusto.reduce((soma, linha) => soma + (linha.lucroEstoque ?? 0), 0)),
    },
  };
}

export const nomeArquivoEstoque = (data = new Date()) => `estoque_${data.toISOString().slice(0, 10)}.xlsx`;
