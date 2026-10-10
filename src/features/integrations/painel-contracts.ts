// Contratos do painel (comanda, delivery, caixa e relatórios) — espelham
// server/mesas.ts, server/delivery.ts e server/relatorios.ts.
import type { FormaPagamento } from '@/lib/pagamentos';
import type { ItemPedidoMesa, PedidoMesaPainel } from './mesas-contracts';

export interface MesaDetalhe {
  mesa: { id: number; numero: number; nome: string; token: string; ativa: boolean };
  conta: {
    id: string;
    aberta_em: string;
    pedidos: PedidoMesaPainel[];
    total: number;
    em_andamento: number;
  } | null;
  fechadas: Array<{
    id: string;
    aberta_em: string;
    fechada_em: string;
    valor_total: number;
    pagamentos: Array<{ metodo: FormaPagamento; valor: number }>;
  }>;
}

export type StatusDelivery = 'recebido' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelado';

export const STATUS_DELIVERY_LABELS: Record<StatusDelivery, string> = {
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export interface PedidoDelivery {
  id: string;
  numero: number;
  /** 'retirada' = retirada no balcão (sem endereço, bairro nem taxa) */
  tipo: 'entrega' | 'retirada';
  nome: string;
  telefone: string;
  endereco: string | null;
  bairro: string | null;
  complemento: string | null;
  observacoes: string | null;
  itens: ItemPedidoMesa[];
  subtotal: number;
  taxa_entrega: number | null;
  valor_total: number;
  forma_pagamento: FormaPagamento;
  status: StatusDelivery;
  created_at: string;
  updated_at: string;
  entregue_em: string | null;
}

export interface MovimentoCaixa {
  id: string;
  /** horário local da loja, "YYYY-MM-DDTHH:mm:ss" */
  data: string;
  canal: 'mesa' | 'delivery' | 'retirada';
  referencia: string;
  cliente: string | null;
  metodo: FormaPagamento;
  valor: number;
  /** parte do valor que é taxa de entrega (0 nas mesas) */
  taxa_entrega: number;
}

interface Indicador {
  valor: number;
  /** variação % contra o período anterior; null quando não havia base */
  variacao: number | null;
}

export interface Metricas {
  periodo: { inicio: string; fim: string; dias: number };
  vendas: Indicador;
  pedidos: Indicador;
  ticket_medio: Indicador;
  cancelados: number;
  por_canal: { mesa: number; delivery: number; retirada: number };
  por_dia: Array<{ dia: string; vendas: number; pedidos: number }>;
  top_produtos: Array<{ nome: string; quantidade: number }>;
}

export interface RankingRow {
  key: string;
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
  share: number;
  avgPrice: number;
  prevQuantity: number;
  prevRevenue: number;
  revenueChange: number | null;
}

export interface Desempenho {
  periodo: { inicio: string; fim: string; dias: number };
  faturamento: number;
  itens_vendidos: number;
  com_venda: number;
  parados: number;
  movers: { up: RankingRow[]; down: RankingRow[] };
  ranking: RankingRow[];
}

/** Bairro atendido pelo delivery, com taxa única (Configurações → Bairros). */
export interface BairroEntrega {
  id: number;
  nome: string;
  taxa: number;
  /** false = pausado: some do carrinho, mas continua cadastrado */
  ativo: boolean;
  created_at: string;
  updated_at: string;
}
