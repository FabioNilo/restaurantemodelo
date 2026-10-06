import type { MarmitaFiltros } from '@/types/product';

export const queryKeys = {
  public: {
    catalogo: ['public', 'catalogo'] as const,
    siteStatus: ['public', 'site-status'] as const,
    mesa: (token: string) => ['public', 'mesa', token] as const,
  },
  admin: {
    categorias: ['admin', 'categorias'] as const,
    marmitasList: (page: number, filtros?: MarmitaFiltros) => ['admin', 'marmitas', 'list', page, filtros ?? {}] as const,
    marmitaDetail: (marmitaId: string | null) => ['admin', 'marmitas', 'detail', marmitaId] as const,
    pedidosList: (
      page: number,
      search: string,
      status: string,
      dateKey: string
    ) => ['admin', 'pedidos', 'list', page, search, status, dateKey] as const,
    pedidoDetail: (pedidoId: string | null) => ['admin', 'pedidos', 'detail', pedidoId] as const,
    pedidosResumo: (search: string, status: string, dateKey: string) =>
      ['admin', 'pedidos', 'resumo', search, status, dateKey] as const,
    caixaList: (page: number, dateKey: string) => ['admin', 'caixa', 'list', page, dateKey] as const,
    caixaResumo: (dateKey: string) => ['admin', 'caixa', 'resumo', dateKey] as const,
    caixaSeries: (dateKey: string) => ['admin', 'caixa', 'series', dateKey] as const,
    configuracoesSite: ['admin', 'configuracoes-site'] as const,
    taxasEntrega: ['admin', 'taxas-entrega'] as const,
    datasTaxaEspecial: ['admin', 'datas-taxa-especial'] as const,
    mesas: ['admin', 'mesas'] as const,
    painelMesas: ['admin', 'mesas', 'painel'] as const,
  },
};
