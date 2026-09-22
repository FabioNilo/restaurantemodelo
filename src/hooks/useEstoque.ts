import type { CartItem } from '@/types/product';

export interface ItemComEstoque extends CartItem {
  estoque?: number;
}

export async function validarEstoque(_items: CartItem[]) {
  return {
    sucesso: true,
    mensagem: 'Validacao de estoque delegada ao n8n/PostgreSQL.',
  };
}

export async function reduzirEstoque(_items: CartItem[], _pedidoId: string) {
  return {
    sucesso: true,
    mensagem: 'Reducao de estoque delegada ao n8n/PostgreSQL.',
  };
}

export async function restaurarEstoque(_pedidoId: string) {
  return {
    sucesso: true,
    mensagem: 'Restauracao de estoque delegada ao n8n/PostgreSQL.',
  };
}

export async function obterHistoricoMovimentacoes(_produtoId: string) {
  return [];
}

export async function obterRelatorioMovimentacoes(_dataInicio: string, _dataFim: string) {
  return [];
}
