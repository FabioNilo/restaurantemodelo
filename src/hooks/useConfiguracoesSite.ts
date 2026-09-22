import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchConfiguracoesSiteN8n, saveConfiguracoesSiteN8n } from '@/features/integrations/marmitas-api';
import { queryKeys } from '@/lib/query-keys';
import {
  DEFAULT_SITE_SETTINGS,
  type ConfiguracoesSite,
  type ConfiguracoesSiteUpdate,
} from '@/lib/site-settings';

const ONE_MINUTE = 60 * 1000;

async function fetchSettings() {
  return fetchConfiguracoesSiteN8n();
}

export function useConfiguracoesSite() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: queryKeys.admin.configuracoesSite,
    queryFn: fetchSettings,
    staleTime: ONE_MINUTE,
  });

  const saveMutation = useMutation({
    mutationFn: async (nextSettings: ConfiguracoesSiteUpdate) => {
      return saveConfiguracoesSiteN8n(nextSettings);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.admin.configuracoesSite, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.public.siteStatus });
    },
  });

  return {
    settings: settingsQuery.data ?? DEFAULT_SITE_SETTINGS,
    loading: settingsQuery.isLoading,
    saving: saveMutation.isPending,
    error: settingsQuery.error || saveMutation.error
      ? 'Não foi possível carregar ou salvar as configurações do site.'
      : null,
    refetch: settingsQuery.refetch,
    saveSettings: async (nextSettings: ConfiguracoesSiteUpdate) => {
      try {
        const data = await saveMutation.mutateAsync(nextSettings);
        return { success: true as const, data };
      } catch (error) {
        return { success: false as const, error };
      }
    },
  };
}
