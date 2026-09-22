import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchPedidoDetailN8n,
  fetchPedidosListN8n,
  fetchPedidosResumoN8n,
  updatePedidoObservacoesN8n,
  updatePedidoStatusN8n,
} from '@/features/integrations/marmitas-api';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export interface PedidoListItem {
  id: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  status: string | null;
  valor_total: number;
  created_at: string | null;
  itens_resumo: string | null;
}

export interface Pedido {
  id: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  endereco_cliente: string | null;
  bairro_cliente: string | null;
  complemento_cliente: string | null;
  observacoes_cliente: string | null;
  observacoes_admin: string | null;
  itens: unknown;
  subtotal?: number | null;
  taxa_entrega?: number | null;
  valor_entrega?: number | null;
  delivery_fee?: number | null;
  valor_total: number;
  forma_pagamento?: string | null;
  tipo_entrega?: string | null;
  status: string | null;
  created_at: string | null;
}

export interface PedidosResumo {
  total_pedidos: number;
  pendentes: number;
  entregues: number;
  faturamento: number;
}

const THIRTY_SECONDS = 30 * 1000;
const STATUS_OPTIONS = [
  'enviado_whatsapp',
  'confirmado',
  'em_preparo',
  'saiu_entrega',
  'entregue',
  'cancelado',
] as const;

export type PedidoStatus = typeof STATUS_OPTIONS[number];

export const STATUS_LABELS: Record<string, string> = {
  enviado_whatsapp: 'Enviado WhatsApp',
  confirmado: 'Confirmado',
  em_preparo: 'Em Preparo',
  saiu_entrega: 'Saiu p/ Entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const STATUS_COLORS: Record<string, string> = {
  enviado_whatsapp: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
  confirmado: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  em_preparo: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  saiu_entrega: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
  entregue: 'bg-green-500/15 text-green-700 border-green-500/30',
  cancelado: 'bg-red-500/15 text-red-700 border-red-500/30',
};

export { STATUS_OPTIONS };

function getDateRange(dateFilter?: Date) {
  if (!dateFilter) {
    return { start: null, end: null, key: 'all' };
  }

  const start = new Date(dateFilter);
  start.setHours(0, 0, 0, 0);

  const end = new Date(dateFilter);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    key: start.toISOString().slice(0, 10),
  };
}

export function usePedidosListQuery(
  page: number,
  searchTerm: string,
  statusFilter: string,
  dateFilter?: Date
) {
  const { start, end, key: dateKey } = getDateRange(dateFilter);

  return useQuery({
    queryKey: queryKeys.admin.pedidosList(page, searchTerm, statusFilter, dateKey),
    queryFn: async () => {
      return fetchPedidosListN8n({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        searchTerm,
        statusFilter,
        dateFrom: start,
        dateTo: end,
      });
    },
    staleTime: THIRTY_SECONDS,
    placeholderData: keepPreviousData,
  });
}

export function usePedidoDetailQuery(pedidoId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.pedidoDetail(pedidoId),
    queryFn: async () => {
      return fetchPedidoDetailN8n(pedidoId as string);
    },
    enabled: enabled && !!pedidoId,
    staleTime: THIRTY_SECONDS,
  });
}

export function usePedidosResumoQuery(
  searchTerm: string,
  statusFilter: string,
  dateFilter?: Date
) {
  const { start, end, key: dateKey } = getDateRange(dateFilter);

  return useQuery({
    queryKey: queryKeys.admin.pedidosResumo(searchTerm, statusFilter, dateKey),
    queryFn: async () => {
      return fetchPedidosResumoN8n({
        searchTerm,
        statusFilter,
        dateFrom: start,
        dateTo: end,
      });
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function usePedidosActions() {
  const queryClient = useQueryClient();

  const invalidatePedidos = async (pedidoId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'pedidos'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'caixa'] }),
      pedidoId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.admin.pedidoDetail(pedidoId) })
        : Promise.resolve(),
    ]);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updatePedidoStatusN8n(id, status);
    },
    onSuccess: async (_, variables) => {
      await invalidatePedidos(variables.id);
    },
  });

  const updateObservacoesMutation = useMutation({
    mutationFn: async ({
      id,
      observacoes_admin,
    }: {
      id: string;
      observacoes_admin: string;
    }) => {
      await updatePedidoObservacoesN8n(id, observacoes_admin);
    },
    onSuccess: async (_, variables) => {
      await invalidatePedidos(variables.id);
    },
  });

  return {
    updateStatus: async (id: string, status: string) => {
      try {
        await updateStatusMutation.mutateAsync({ id, status });
        return true;
      } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error);
        return false;
      }
    },
    updateObservacoesAdmin: async (id: string, observacoes_admin: string) => {
      try {
        await updateObservacoesMutation.mutateAsync({ id, observacoes_admin });
        return true;
      } catch (error) {
        console.error('Erro ao atualizar observações do pedido:', error);
        return false;
      }
    },
  };
}
