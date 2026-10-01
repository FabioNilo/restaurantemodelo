import type { PedidoMesaRequest } from '@/features/integrations/mesas-contracts';
import type { CartItem } from '@/types/product';

// O id do item no carrinho é "produto" ou "produto:opcao" (CartContext). O
// preço não vai no pedido: o servidor recalcula a partir do cardápio.
export function toPedidoMesaItens(items: CartItem[]): PedidoMesaRequest['itens'] {
  return items.map((item) => ({
    produto_id: item.id.split(':')[0],
    tamanho_codigo: item.tamanho_codigo ?? null,
    quantidade: item.quantidade,
  }));
}

export function buildMesaUrl(token: string, origin = window.location.origin) {
  return `${origin}/mesa/${token}`;
}
