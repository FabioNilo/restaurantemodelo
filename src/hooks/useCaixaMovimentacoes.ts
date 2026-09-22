import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deleteCaixaMovimentacaoN8n,
  fetchCaixaListN8n,
  fetchCaixaResumoN8n,
  fetchCaixaSeriesN8n,
  updateCaixaMovimentacaoN8n,
} from '@/features/integrations/marmitas-api';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';

export interface CaixaMovimentacao {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  origem: string | null;
  created_at: string | null;
}

export interface CaixaResumo {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
}

export interface CaixaSerieDiaria {
  date_label: string;
  entradas: number;
  saidas: number;
}

const THIRTY_SECONDS = 30 * 1000;

function getDateRange(dataInicio?: Date, dataFim?: Date) {
  const start = dataInicio ? new Date(dataInicio) : null;
  if (start) {
    start.setHours(0, 0, 0, 0);
  }

  const end = dataFim ? new Date(dataFim) : null;
  if (end) {
    end.setHours(23, 59, 59, 999);
  }

  return {
    start: start?.toISOString() ?? null,
    end: end?.toISOString() ?? null,
    key: `${start?.toISOString().slice(0, 10) ?? 'all'}:${end?.toISOString().slice(0, 10) ?? 'all'}`,
  };
}

export function useCaixaListQuery(page: number, dataInicio?: Date, dataFim?: Date) {
  const { start, end, key } = getDateRange(dataInicio, dataFim);

  return useQuery({
    queryKey: queryKeys.admin.caixaList(page, key),
    queryFn: async () => {
      return fetchCaixaListN8n({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        dateFrom: start,
        dateTo: end,
      });
    },
    staleTime: THIRTY_SECONDS,
    placeholderData: keepPreviousData,
  });
}

export function useCaixaResumoQuery(dataInicio?: Date, dataFim?: Date) {
  const { start, end, key } = getDateRange(dataInicio, dataFim);

  return useQuery({
    queryKey: queryKeys.admin.caixaResumo(key),
    queryFn: async () => {
      return fetchCaixaResumoN8n({ dateFrom: start, dateTo: end });
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function useCaixaSeriesQuery(dataInicio?: Date, dataFim?: Date) {
  const { start, end, key } = getDateRange(dataInicio, dataFim);

  return useQuery({
    queryKey: queryKeys.admin.caixaSeries(key),
    queryFn: async () => {
      return fetchCaixaSeriesN8n({ dateFrom: start, dateTo: end });
    },
    staleTime: THIRTY_SECONDS,
  });
}

export function useCaixaActions() {
  const queryClient = useQueryClient();

  const invalidateCaixa = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'caixa'] });
  };

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CaixaMovimentacao>;
    }) => {
      await updateCaixaMovimentacaoN8n(id, data);
    },
    onSuccess: invalidateCaixa,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteCaixaMovimentacaoN8n(id);
    },
    onSuccess: invalidateCaixa,
  });

  return {
    updateMovimentacao: async (id: string, data: Partial<CaixaMovimentacao>) => {
      try {
        await updateMutation.mutateAsync({ id, data });
        return true;
      } catch (error) {
        console.error('Erro ao atualizar movimentacao:', error);
        return false;
      }
    },
    deleteMovimentacao: async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch (error) {
        console.error('Erro ao deletar movimentacao:', error);
        return false;
      }
    },
  };
}
