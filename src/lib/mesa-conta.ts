import type { ItemPedidoMesa, PedidoMesaPainel } from '@/features/integrations/mesas-contracts';

export const SEM_NOME = 'Sem nome';

type PedidoConta = Pick<PedidoMesaPainel, 'status' | 'nome_cliente' | 'itens' | 'created_at'>;

export interface ItemResumo {
  nome: string;
  opcao: string | null;
  preco: number;
  quantidade: number;
  total: number;
}

export interface GrupoPessoa {
  nome: string;
  itens: ItemResumo[];
  pedidos: number;
  total: number;
}

const centavos = (valor: number) => Math.round(valor * 100) / 100;
// Só pedidos confirmados valem na conta: cancelados e os que ainda aguardam confirmação ficam de fora.
const ativos = <T extends Pick<PedidoMesaPainel, 'status'>>(pedidos: T[]) =>
  pedidos.filter((pedido) => pedido.status !== 'cancelado' && pedido.status !== 'pendente');

// Soma itens iguais (mesmo produto, opção e preço): "3× Café" em vez de três linhas.
export function somarItens(itens: ItemPedidoMesa[]): ItemResumo[] {
  const mapa = new Map<string, ItemResumo>();

  for (const item of itens) {
    const chave = `${item.produto_id}|${item.tamanho_codigo ?? ''}|${item.preco}`;
    const atual = mapa.get(chave);

    if (atual) {
      atual.quantidade += item.quantidade;
      atual.total = centavos(atual.total + item.preco * item.quantidade);
    } else {
      mapa.set(chave, {
        nome: item.nome,
        opcao: item.tamanho_nome,
        preco: item.preco,
        quantidade: item.quantidade,
        total: centavos(item.preco * item.quantidade),
      });
    }
  }

  return [...mapa.values()];
}

// Resumo da mesa: todos os itens somados, sem os pedidos cancelados.
export function resumirConta(pedidos: PedidoConta[]) {
  const itens = somarItens(ativos(pedidos).flatMap((pedido) => pedido.itens));
  return { itens, total: centavos(itens.reduce((soma, item) => soma + item.total, 0)) };
}

const chaveNome = (nome: string | null) => (nome ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

// Uma seção por pessoa. "Ana" e "ana " são a mesma pessoa; pedidos sem nome ficam juntos.
export function agruparPorPessoa(pedidos: PedidoConta[]): GrupoPessoa[] {
  const grupos = new Map<string, { nome: string; itens: ItemPedidoMesa[]; pedidos: number }>();

  for (const pedido of ativos(pedidos)) {
    const chave = chaveNome(pedido.nome_cliente);
    const grupo = grupos.get(chave) ?? {
      nome: chave ? (pedido.nome_cliente ?? '').trim().replace(/\s+/g, ' ') : SEM_NOME,
      itens: [],
      pedidos: 0,
    };

    grupo.itens.push(...pedido.itens);
    grupo.pedidos += 1;
    grupos.set(chave, grupo);
  }

  return [...grupos.entries()]
    // Quem tem nome primeiro, na ordem em que apareceu; "Sem nome" por último.
    .sort(([a], [b]) => Number(a === '') - Number(b === ''))
    .map(([, grupo]) => {
      const itens = somarItens(grupo.itens);
      return { nome: grupo.nome, itens, pedidos: grupo.pedidos, total: centavos(itens.reduce((soma, item) => soma + item.total, 0)) };
    });
}
