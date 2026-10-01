import { useQuery } from '@tanstack/react-query';
import { fetchMesaPublica } from '@/features/integrations/marmitas-api';
import { queryKeys } from '@/lib/query-keys';

// Mesa do QR code + pedidos da conta aberta. `acompanhando` liga a atualização
// periódica (só enquanto o cliente está com "Minha conta" aberta).
export function useMesaQuery(token: string, acompanhando = false) {
  return useQuery({
    queryKey: queryKeys.public.mesa(token),
    queryFn: () => fetchMesaPublica(token),
    retry: false,
    staleTime: 10 * 1000,
    refetchInterval: acompanhando ? 20 * 1000 : false,
    refetchIntervalInBackground: false,
  });
}
