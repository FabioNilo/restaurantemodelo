import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategoriaN8n,
  createMarmitaN8n,
  deleteCategoriaN8n,
  deleteMarmitaN8n,
  fetchCategoriasAdminN8n,
  fetchMarmitaDetailN8n,
  fetchMarmitasAdminPageN8n,
  updateCategoriaN8n,
  updateMarmitaN8n,
  updateMarmitaStockN8n,
} from '@/features/integrations/marmitas-api';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import type { Categoria, Marmita, MarmitaAdminListItem } from '@/types/product';

const ONE_MINUTE = 60 * 1000;

const marmitaNameCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

function sortMarmitasByName<T extends Pick<MarmitaAdminListItem, 'id' | 'nome'>>(items: T[]) {
  return [...items].sort((a, b) => {
    const byName = marmitaNameCollator.compare(a.nome, b.nome);

    if (byName !== 0) {
      return byName;
    }

    return a.id.localeCompare(b.id);
  });
}

async function fetchMarmitasPage(page: number) {
  const result = await fetchMarmitasAdminPageN8n(page, DEFAULT_PAGE_SIZE);

  return {
    ...result,
    data: sortMarmitasByName(result.data ?? []),
  };
}

async function fetchCategorias() {
  return fetchCategoriasAdminN8n();
}

async function fetchMarmitaDetail(marmitaId: string) {
  return fetchMarmitaDetailN8n(marmitaId);
}

export function useMarmitaDetailQuery(marmitaId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.marmitaDetail(marmitaId),
    queryFn: () => fetchMarmitaDetail(marmitaId as string),
    enabled: enabled && !!marmitaId,
    staleTime: ONE_MINUTE,
  });
}

export function useMarmitasAdmin(page = 1) {
  const queryClient = useQueryClient();

  const marmitasQuery = useQuery({
    queryKey: queryKeys.admin.marmitasList(page),
    queryFn: () => fetchMarmitasPage(page),
    staleTime: ONE_MINUTE,
    placeholderData: keepPreviousData,
  });

  const categoriasQuery = useQuery({
    queryKey: queryKeys.admin.categorias,
    queryFn: fetchCategorias,
    staleTime: ONE_MINUTE,
  });

  const invalidateMarmitas = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'marmitas'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.public.catalogo }),
    ]);
  };

  const invalidateCategorias = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.categorias }),
      queryClient.invalidateQueries({ queryKey: queryKeys.public.catalogo }),
    ]);
  };

  const createMarmitaMutation = useMutation({
    mutationFn: async (data: Omit<Marmita, 'id' | 'created_at' | 'updated_at'>) => {
      await createMarmitaN8n(data);
    },
    onSuccess: invalidateMarmitas,
  });

  const updateMarmitaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Marmita> }) => {
      await updateMarmitaN8n(id, data);
    },
    onSuccess: async (_, variables) => {
      await invalidateMarmitas();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.marmitaDetail(variables.id),
      });
    },
  });

  const updateMarmitaStockMutation = useMutation({
    mutationFn: async ({ id, estoque }: { id: string; estoque: number }) => {
      await updateMarmitaStockN8n(id, estoque);
    },
    onSuccess: async (_, variables) => {
      await invalidateMarmitas();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admin.marmitaDetail(variables.id),
      });
    },
  });

  const deleteMarmitaMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteMarmitaN8n(id);
    },
    onSuccess: invalidateMarmitas,
  });

  const createCategoriaMutation = useMutation({
    mutationFn: async (data: { id?: string; nome: string; ordem?: number; ativo?: boolean }) => {
      await createCategoriaN8n(data);
    },
    onSuccess: invalidateCategorias,
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Categoria> }) => {
      await updateCategoriaN8n(id, data);
    },
    onSuccess: invalidateCategorias,
  });

  const deleteCategoriaMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteCategoriaN8n(id);
    },
    onSuccess: invalidateCategorias,
  });

  return {
    marmitas: marmitasQuery.data?.data ?? [],
    totalCount: marmitasQuery.data?.count ?? 0,
    categorias: categoriasQuery.data ?? [],
    loading: marmitasQuery.isLoading || categoriasQuery.isLoading,
    error: marmitasQuery.error || categoriasQuery.error ? 'Erro ao carregar dados. Tente novamente.' : null,
    refetch: async () => {
      await Promise.all([marmitasQuery.refetch(), categoriasQuery.refetch()]);
    },
    createMarmita: async (data: Omit<Marmita, 'id' | 'created_at' | 'updated_at'>) => {
      try {
        await createMarmitaMutation.mutateAsync(data);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
    updateMarmita: async (id: string, data: Partial<Marmita>) => {
      try {
        await updateMarmitaMutation.mutateAsync({ id, data });
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
    updateMarmitaStock: async (id: string, estoque: number) => {
      try {
        await updateMarmitaStockMutation.mutateAsync({ id, estoque });
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
    deleteMarmita: async (id: string) => {
      try {
        await deleteMarmitaMutation.mutateAsync(id);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
    createCategoria: async (data: { id?: string; nome: string; ordem?: number; ativo?: boolean }) => {
      try {
        await createCategoriaMutation.mutateAsync(data);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
    updateCategoria: async (id: string, data: Partial<Categoria>) => {
      try {
        await updateCategoriaMutation.mutateAsync({ id, data });
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
    deleteCategoria: async (id: string) => {
      try {
        await deleteCategoriaMutation.mutateAsync(id);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error };
      }
    },
  };
}
