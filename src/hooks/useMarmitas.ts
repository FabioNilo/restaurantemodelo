import { useCatalogoPublicoQuery } from '@/hooks/useCatalogoPublicoQuery';

export function useMarmitas() {
  const { data, isLoading, error } = useCatalogoPublicoQuery();

  return {
    marmitas: data?.marmitas ?? [],
    categorias: data?.categorias ?? [],
    loading: isLoading,
    error: error ? 'Erro ao carregar cardápio. Tente novamente.' : null,
  };
}
