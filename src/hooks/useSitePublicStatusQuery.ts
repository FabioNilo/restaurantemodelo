import { useQuery } from '@tanstack/react-query';
import { fetchSitePublicStatusN8n } from '@/features/integrations/marmitas-api';
import { hasN8NBaseUrl } from '@/lib/api';
import { demoGetSitePublicStatus } from '@/lib/demo-backend';
import {
  DEFAULT_SITE_SETTINGS,
  SITE_CLOSED_MESSAGE,
  isDeliveryClosed,
} from '@/lib/site-settings';
import { queryKeys } from '@/lib/query-keys';

const ONE_MINUTE = 60 * 1000;

export interface SitePublicStatus {
  whatsapp_numero: string;
  mensagem_fechado: string;
  mostrar_aviso_fechado: boolean;
  entregas_abertas_agora: boolean;
}

async function fetchSitePublicStatus(): Promise<SitePublicStatus> {
  if (!hasN8NBaseUrl()) {
    return demoGetSitePublicStatus();
  }

  try {
    // O backend (n8n) ja calcula entregas_abertas_agora/mostrar_aviso_fechado
    // a partir da configuracao real (dias, horarios, fuso) salva pelo admin -
    // usar o retorno como esta. Sobrescrever esses campos aqui com
    // DEFAULT_SITE_SETTINGS fazia a home nunca refletir o que o admin
    // configurava.
    return await fetchSitePublicStatusN8n();
  } catch {
    const entregasAbertasAgora = !isDeliveryClosed(DEFAULT_SITE_SETTINGS);

    return {
      whatsapp_numero: DEFAULT_SITE_SETTINGS.whatsapp_numero,
      mensagem_fechado: SITE_CLOSED_MESSAGE,
      mostrar_aviso_fechado: true,
      entregas_abertas_agora: entregasAbertasAgora,
    };
  }
}

export function useSitePublicStatusQuery() {
  return useQuery({
    queryKey: queryKeys.public.siteStatus,
    queryFn: fetchSitePublicStatus,
    staleTime: ONE_MINUTE,
    initialData: () => {
      const entregasAbertasAgora = !isDeliveryClosed(DEFAULT_SITE_SETTINGS);

      return {
        whatsapp_numero: DEFAULT_SITE_SETTINGS.whatsapp_numero,
        mensagem_fechado: SITE_CLOSED_MESSAGE,
        mostrar_aviso_fechado: true,
        entregas_abertas_agora: entregasAbertasAgora,
      };
    },
    // Sem isso, o React Query trata o initialData acima como recem-buscado e,
    // com staleTime de 1 minuto, so ia buscar o status real do backend depois
    // de 1 minuto de cada carregamento da pagina - mostrando "fechado" fixo
    // ate la mesmo com a loja aberta. initialDataUpdatedAt: 0 marca esse
    // placeholder como ja velho, forcando a busca real imediatamente.
    initialDataUpdatedAt: 0,
  });
}
