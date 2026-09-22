import { useQuery } from '@tanstack/react-query';
import { cardapioLocal } from '@/data/cardapio';
import { fetchCatalogoPublicoN8n } from '@/features/integrations/marmitas-api';
import { hasN8NBaseUrl } from '@/lib/api';
import { demoGetPublicCatalog } from '@/lib/demo-backend';
import { sortCategoriesByDisplayOrder, sortProductsByCategoryOrder } from '@/lib/product-category';
import { queryKeys } from '@/lib/query-keys';
import type { CategoriaListItem, MarmitaListItem } from '@/types/product';

const TEN_MINUTES = 10 * 60 * 1000;

interface CatalogoPublicoResult {
  marmitas: MarmitaListItem[];
  categorias: CategoriaListItem[];
}

export function normalizeCatalog(catalog: CatalogoPublicoResult): CatalogoPublicoResult {
  const categorias = sortCategoriesByDisplayOrder(catalog.categorias);
  const availableMarmitas = catalog.marmitas.filter((item) => item.disponivel !== false && Number(item.estoque ?? 0) > 0);

  return {
    categorias,
    marmitas: sortProductsByCategoryOrder(availableMarmitas, categorias),
  };
}

async function fetchCatalogoPublico(): Promise<CatalogoPublicoResult> {
  if (!hasN8NBaseUrl()) {
    const demoCatalog = await demoGetPublicCatalog();
    return normalizeCatalog(demoCatalog);
  }

  try {
    return normalizeCatalog(await fetchCatalogoPublicoN8n());
  } catch (error) {
    console.warn('Falha ao carregar catálogo via n8n. Usando cardápio local.', error);
    return normalizeCatalog(cardapioLocal);
  }
}

export function useCatalogoPublicoQuery() {
  return useQuery({
    queryKey: queryKeys.public.catalogo,
    queryFn: fetchCatalogoPublico,
    staleTime: TEN_MINUTES,
  });
}
