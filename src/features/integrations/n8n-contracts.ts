import type { CategoriaListItem, CartItem, MarmitaListItem } from '@/types/product';
import type { SitePublicStatus } from '@/hooks/useSitePublicStatusQuery';

export const marmitasWebhookPaths = {
  public: {
    catalogo: '/massas/catalogo',
    siteStatus: '/massas/site-status',
    pedidos: '/massas/pedidos',
    pedidoStatus: '/massas/pedidos/status',
    pedidoCancelar: '/massas/pedidos/cancelar',
    deliveryFee: '/massas/delivery-fee',
    deliveryZones: '/massas/delivery-zones',
  },
  auth: {
    login: '/massas/auth/login',
    session: '/massas/auth/session',
    logout: '/massas/auth/logout',
    changePassword: '/massas/auth/change-password',
  },
  admin: {
    api: '/massas/admin/api',
    pedidoStatus: '/massas/admin/pedidos/status',
    caixa: '/massas/admin/caixa',
    estoque: '/massas/admin/estoque',
    gestores: '/massas/admin/gestores',
  },
} as const;

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
  error?: string;
}

export interface CatalogoPublicoResponse {
  marmitas: MarmitaListItem[];
  categorias: CategoriaListItem[];
}

export type SiteStatusResponse = SitePublicStatus;

export interface DeliveryFeeRequest {
  bairro: string;
}

export interface DeliveryFeeResponse {
  bairro: string;
  taxa: number | null;
  encontrado: boolean;
  entrega_disponivel: boolean;
  motivo_indisponivel?: string | null;
  data_referencia?: string | null;
  regra_aplicada?: 'quinta_sexta' | 'sab_dom_feriado' | 'data_especial' | 'sem_entrega' | null;
  observacao?: string | null;
}

export interface DeliveryZone {
  id: number;
  bairro: string;
  bairro_normalizado?: string;
  zona?: string | null;
  taxa?: number;
  taxa_quinta_sexta: number;
  taxa_sab_dom_feriado: number;
  ativo: boolean;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeliverySpecialDate {
  id: number;
  data: string;
  descricao: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoCreateRequest {
  itens: Array<Pick<CartItem, 'id' | 'nome' | 'preco' | 'quantidade' | 'tamanho_codigo' | 'tamanho_nome' | 'tamanho_serve'>>;
  subtotal?: number;
  taxa_entrega?: number;
  valor_total: number;
  nome_cliente: string;
  telefone_cliente: string;
  endereco_cliente: string;
  bairro_cliente: string;
  complemento_cliente?: string | null;
  observacoes_cliente?: string | null;
  tipo_entrega?: 'delivery';
  forma_pagamento?: 'pix' | 'cartao_credito';
  tracking_base_url?: string;
}

export interface PedidoCreateResponse {
  id: string;
  status: string;
  valor_total: number;
  created_at: string;
  tracking_token?: string;
  tracking_url?: string;
  cancel_until?: string;
}

export interface PedidoStatusItem {
  nome?: string;
  quantidade?: number;
  preco?: number;
  tamanho_nome?: string;
  tamanho_serve?: string;
}

export interface PedidoStatusResponse {
  id: string;
  status: string;
  valor_total: number;
  created_at: string;
  cancel_until: string;
  can_cancel: boolean;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  endereco_cliente: string | null;
  bairro_cliente: string | null;
  complemento_cliente: string | null;
  observacoes_cliente: string | null;
  tipo_entrega?: string | null;
  forma_pagamento?: string | null;
  itens: PedidoStatusItem[];
}

export interface PedidoCancelRequest {
  id: string;
  token: string;
}

export interface PedidoCancelResponse {
  id: string;
  status: string;
  cancelled_at: string;
}

export interface AuthUser {
  id: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  name?: string | null;
}

export interface AuthSession {
  access_token: string;
  expires_at?: string | null;
  user: AuthUser;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangeCredentialsRequest {
  username: string;
  currentPassword: string;
  newUsername: string;
  newPassword: string;
}
