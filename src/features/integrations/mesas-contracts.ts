// Contratos dos pedidos pela mesa (QR code) — espelham server/mesas.ts.

export type StatusPedidoMesa = 'novo' | 'em_preparo' | 'entregue' | 'cancelado';

export interface ItemPedidoMesa {
  produto_id: string;
  nome: string;
  tamanho_codigo: string | null;
  tamanho_nome: string | null;
  tamanho_serve: string | null;
  preco: number;
  quantidade: number;
}

export interface MesaPublica {
  mesa: { numero: number; nome: string; ativa: boolean };
  conta: {
    pedidos: Array<{ numero: number; status: StatusPedidoMesa; itens: ItemPedidoMesa[]; valor_total: number; created_at: string }>;
    total: number;
  } | null;
}

// O cliente manda só produto, opção e quantidade: o preço é calculado no servidor.
export interface PedidoMesaRequest {
  nome_cliente?: string | null;
  observacoes?: string | null;
  itens: Array<{ produto_id: string; tamanho_codigo?: string | null; quantidade: number }>;
}

export interface PedidoMesaResponse {
  numero: number;
  status: StatusPedidoMesa;
  valor_total: number;
}

export interface MesaAdmin {
  id: number;
  numero: number;
  nome: string;
  token: string;
  ativa: boolean;
  conta_id: string | null;
  aberta_em: string | null;
  total: number;
  pedidos: number;
  novos: number;
  em_andamento: number;
  ids_novos: string[];
}

export interface PedidoMesaPainel {
  id: string;
  numero: number;
  status: StatusPedidoMesa;
  nome_cliente: string | null;
  observacoes: string | null;
  itens: ItemPedidoMesa[];
  valor_total: number;
  created_at: string;
}

export const STATUS_PEDIDO_MESA_LABELS: Record<StatusPedidoMesa, string> = {
  novo: 'Recebido',
  em_preparo: 'Em preparo',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
