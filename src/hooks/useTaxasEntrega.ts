import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDataTaxaEspecialN8n,
  createTaxaEntregaN8n,
  deleteDataTaxaEspecialN8n,
  deleteTaxaEntregaN8n,
  fetchDatasTaxaEspecialN8n,
  fetchTaxasEntregaAdminN8n,
  updateDataTaxaEspecialN8n,
  updateTaxaEntregaN8n,
} from '@/features/integrations/marmitas-api';
import type { DeliverySpecialDate, DeliveryZone } from '@/features/integrations/n8n-contracts';
import { queryKeys } from '@/lib/query-keys';

const ONE_MINUTE = 60 * 1000;

export type TaxaEntregaFormData = Pick<DeliveryZone, 'bairro'> & {
  zona?: string | null;
  taxa_quinta_sexta: number;
  taxa_sab_dom_feriado: number;
  ativo?: boolean;
  observacao?: string | null;
};

export type DataTaxaEspecialFormData = Pick<DeliverySpecialDate, 'data'> & {
  descricao?: string | null;
  ativo?: boolean;
};

export function useTaxasEntrega() {
  const queryClient = useQueryClient();

  const taxasQuery = useQuery({
    queryKey: queryKeys.admin.taxasEntrega,
    queryFn: fetchTaxasEntregaAdminN8n,
    staleTime: ONE_MINUTE,
  });

  const datasEspeciaisQuery = useQuery({
    queryKey: queryKeys.admin.datasTaxaEspecial,
    queryFn: fetchDatasTaxaEspecialN8n,
    staleTime: ONE_MINUTE,
  });

  const invalidateTaxas = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.taxasEntrega });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.datasTaxaEspecial });
  };

  const createMutation = useMutation({
    mutationFn: (data: TaxaEntregaFormData) => createTaxaEntregaN8n(data),
    onSuccess: invalidateTaxas,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeliveryZone> }) =>
      updateTaxaEntregaN8n(id, data),
    onSuccess: invalidateTaxas,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaxaEntregaN8n(id),
    onSuccess: invalidateTaxas,
  });

  const createSpecialDateMutation = useMutation({
    mutationFn: (data: DataTaxaEspecialFormData) => createDataTaxaEspecialN8n(data),
    onSuccess: invalidateTaxas,
  });

  const updateSpecialDateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeliverySpecialDate> }) =>
      updateDataTaxaEspecialN8n(id, data),
    onSuccess: invalidateTaxas,
  });

  const deleteSpecialDateMutation = useMutation({
    mutationFn: (id: number) => deleteDataTaxaEspecialN8n(id),
    onSuccess: invalidateTaxas,
  });

  return {
    taxas: taxasQuery.data ?? [],
    datasEspeciais: datasEspeciaisQuery.data ?? [],
    loading: taxasQuery.isLoading || datasEspeciaisQuery.isLoading,
    error: taxasQuery.error || datasEspeciaisQuery.error ? 'Não foi possível carregar as regras de entrega.' : null,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    creatingSpecialDate: createSpecialDateMutation.isPending,
    updatingSpecialDate: updateSpecialDateMutation.isPending,
    deletingSpecialDate: deleteSpecialDateMutation.isPending,
    createTaxa: createMutation.mutateAsync,
    updateTaxa: (id: number, data: Partial<DeliveryZone>) =>
      updateMutation.mutateAsync({ id, data }),
    deleteTaxa: deleteMutation.mutateAsync,
    createSpecialDate: createSpecialDateMutation.mutateAsync,
    updateSpecialDate: (id: number, data: Partial<DeliverySpecialDate>) =>
      updateSpecialDateMutation.mutateAsync({ id, data }),
    deleteSpecialDate: deleteSpecialDateMutation.mutateAsync,
  };
}
