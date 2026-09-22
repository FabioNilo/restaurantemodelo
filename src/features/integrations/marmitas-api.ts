import { hasN8NBaseUrl, requestJson } from '@/lib/api';
import {
  demoCreateCategoria,
  demoCreateMarmita,
  demoDeleteCategoria,
  demoDeleteMarmita,
  demoGetConfiguracoes,
  demoGetMarmitaDetail,
  demoListCategoriasAdmin,
  demoListMarmitasAdmin,
  demoLogin,
  demoSaveConfiguracoes,
  demoUpdateCategoria,
  demoUpdateMarmita,
  demoUpdateMarmitaStock,
  isDemoToken,
} from '@/lib/demo-backend';
import {
  type ApiEnvelope,
  type AuthSession,
  type ChangeCredentialsRequest,
  type CatalogoPublicoResponse,
  type DeliveryFeeRequest,
  type DeliveryFeeResponse,
  type DeliverySpecialDate,
  type DeliveryZone,
  type LoginRequest,
  type PedidoCancelRequest,
  type PedidoCancelResponse,
  type PedidoCreateRequest,
  type PedidoCreateResponse,
  type PedidoStatusResponse,
  type SiteStatusResponse,
  marmitasWebhookPaths,
} from './n8n-contracts';
import type { CaixaMovimentacao, CaixaResumo, CaixaSerieDiaria } from '@/hooks/useCaixaMovimentacoes';
import type { Pedido, PedidoListItem, PedidosResumo } from '@/hooks/usePedidos';
import type { ConfiguracoesSite, ConfiguracoesSiteUpdate } from '@/lib/site-settings';
import type { Categoria, Marmita, MarmitaAdminListItem } from '@/types/product';

function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'success' in response && 'data' in response) {
    const envelope = response as ApiEnvelope<T>;

    if (envelope.success === false) {
      throw new Error(envelope.error ?? envelope.message ?? 'O backend retornou uma resposta de erro.');
    }

    return envelope.data;
  }

  return response as T;
}

const ADMIN_SESSION_STORAGE_KEY = 'massas_admin_session';

function getAdminSessionStorage() {
  return window.sessionStorage;
}

async function requestMarmitas<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await requestJson<unknown>(path, init);
  return unwrap<T>(response);
}

export function getStoredAdminSession(): AuthSession | null {
  const rawSession = getAdminSessionStorage().getItem(ADMIN_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    getAdminSessionStorage().removeItem(ADMIN_SESSION_STORAGE_KEY);
    return null;
  }
}

function storeAdminSession(session: AuthSession) {
  getAdminSessionStorage().setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAdminSession() {
  getAdminSessionStorage().removeItem(ADMIN_SESSION_STORAGE_KEY);
}

export async function fetchCatalogoPublicoN8n(): Promise<CatalogoPublicoResponse> {
  return requestMarmitas<CatalogoPublicoResponse>(marmitasWebhookPaths.public.catalogo, {
    method: 'GET',
  });
}

export async function fetchSitePublicStatusN8n(): Promise<SiteStatusResponse> {
  return requestMarmitas<SiteStatusResponse>(marmitasWebhookPaths.public.siteStatus, {
    method: 'GET',
  });
}

export async function createPedidoN8n(
  payload: PedidoCreateRequest
): Promise<PedidoCreateResponse> {
  return requestMarmitas<PedidoCreateResponse>(marmitasWebhookPaths.public.pedidos, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchPedidoStatusN8n(
  id: string,
  token: string
): Promise<PedidoStatusResponse> {
  const params = new URLSearchParams({ id, token });

  return requestMarmitas<PedidoStatusResponse>(
    `${marmitasWebhookPaths.public.pedidoStatus}?${params.toString()}`,
    { method: 'GET' }
  );
}

export async function cancelPedidoN8n(
  payload: PedidoCancelRequest
): Promise<PedidoCancelResponse> {
  return requestMarmitas<PedidoCancelResponse>(marmitasWebhookPaths.public.pedidoCancelar, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDeliveryFeeN8n(
  payload: DeliveryFeeRequest
): Promise<DeliveryFeeResponse> {
  return requestMarmitas<DeliveryFeeResponse>(marmitasWebhookPaths.public.deliveryFee, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDeliveryZonesN8n(): Promise<DeliveryZone[]> {
  return requestMarmitas<DeliveryZone[]>(marmitasWebhookPaths.public.deliveryZones, {
    method: 'GET',
  });
}

export async function loginAdminN8n(payload: LoginRequest): Promise<AuthSession> {
  if (!hasN8NBaseUrl()) {
    const session = await demoLogin(payload.username, payload.password);
    storeAdminSession(session);
    return session;
  }

  const session = await requestMarmitas<AuthSession>(marmitasWebhookPaths.auth.login, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  storeAdminSession(session);
  return session;
}

export async function validateStoredAdminSessionN8n(): Promise<AuthSession | null> {
  const session = getStoredAdminSession();

  if (!session?.access_token) {
    return null;
  }

  if (!hasN8NBaseUrl()) {
    if (isDemoToken(session.access_token)) {
      return session;
    }

    clearStoredAdminSession();
    return null;
  }

  try {
    const refreshedSession = await requestMarmitas<AuthSession>(marmitasWebhookPaths.auth.session, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    storeAdminSession(refreshedSession);
    return refreshedSession;
  } catch {
    clearStoredAdminSession();
    return null;
  }
}

export async function logoutAdminN8n() {
  const session = getStoredAdminSession();

  if (!hasN8NBaseUrl()) {
    clearStoredAdminSession();
    return;
  }

  try {
    if (session?.access_token) {
      await requestMarmitas(marmitasWebhookPaths.auth.logout, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }
  } finally {
    clearStoredAdminSession();
  }
}

export async function changeAdminCredentialsN8n(
  payload: ChangeCredentialsRequest
): Promise<AuthSession> {
  const session = getStoredAdminSession();

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const nextSession = await requestMarmitas<AuthSession>(marmitasWebhookPaths.auth.changePassword, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  storeAdminSession(nextSession);
  return nextSession;
}

async function requestMarmitasAdmin<T>(action: string, payload: Record<string, unknown> = {}) {
  const session = getStoredAdminSession();

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return requestMarmitas<T>(marmitasWebhookPaths.admin.api, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
}

async function requestMarmitasAdminPath<T>(path: string, payload: Record<string, unknown> = {}) {
  const session = getStoredAdminSession();

  if (!session?.access_token) {
    throw new Error('SessÃ£o expirada. FaÃ§a login novamente.');
  }

  return requestMarmitas<T>(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchMarmitasAdminPageN8n(page: number, pageSize: number) {
  if (!hasN8NBaseUrl()) {
    return demoListMarmitasAdmin(page, pageSize);
  }

  return requestMarmitasAdmin<{ data: MarmitaAdminListItem[]; count: number }>('marmitas.list', {
    page,
    pageSize,
    orderBy: 'nome',
    orderDirection: 'asc',
    caseInsensitive: true,
  });
}

export function fetchCategoriasAdminN8n() {
  if (!hasN8NBaseUrl()) {
    return demoListCategoriasAdmin();
  }

  return requestMarmitasAdmin<Categoria[]>('categorias.list');
}

export function fetchMarmitaDetailN8n(id: string) {
  if (!hasN8NBaseUrl()) {
    return demoGetMarmitaDetail(id);
  }

  return requestMarmitasAdmin<Marmita>('marmitas.detail', { id });
}

export function createMarmitaN8n(data: Omit<Marmita, 'id' | 'created_at' | 'updated_at'>) {
  if (!hasN8NBaseUrl()) {
    return demoCreateMarmita(data);
  }

  return requestMarmitasAdmin<{ id: string }>('marmitas.create', { data });
}

export function updateMarmitaN8n(id: string, data: Partial<Marmita>) {
  if (!hasN8NBaseUrl()) {
    return demoUpdateMarmita(id, data);
  }

  return requestMarmitasAdmin<{ id: string }>('marmitas.update', { id, data });
}

export function updateMarmitaStockN8n(id: string, estoque: number) {
  if (!hasN8NBaseUrl()) {
    return demoUpdateMarmitaStock(id, estoque);
  }

  return requestMarmitasAdminPath<{ id: string; estoque: number; disponivel: boolean }>(marmitasWebhookPaths.admin.estoque, {
    id,
    estoque,
  });
}

export function deleteMarmitaN8n(id: string) {
  if (!hasN8NBaseUrl()) {
    return demoDeleteMarmita(id);
  }

  return requestMarmitasAdmin<{ id: string }>('marmitas.delete', { id });
}

export async function createCategoriaN8n(data: { id?: string; nome: string; ordem?: number; ativo?: boolean }) {
  if (!hasN8NBaseUrl()) {
    return demoCreateCategoria(data);
  }

  const payloads = [
    data,
    { id: data.id, nome: data.nome, ordem: data.ordem },
    { nome: data.nome },
  ];

  let lastError: unknown = null;

  for (const payload of payloads) {
    try {
      return await requestMarmitasAdmin<{ id: string }>('categorias.create', { data: payload });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Não foi possível criar a categoria.');
}

export function updateCategoriaN8n(id: string, data: Partial<Categoria>) {
  if (!hasN8NBaseUrl()) {
    return demoUpdateCategoria(id, data);
  }

  return requestMarmitasAdmin<{ id: string }>('categorias.update', { id, data });
}

export function deleteCategoriaN8n(id: string) {
  if (!hasN8NBaseUrl()) {
    return demoDeleteCategoria(id);
  }

  return requestMarmitasAdmin<{ id: string }>('categorias.delete', { id });
}

export function fetchConfiguracoesSiteN8n() {
  if (!hasN8NBaseUrl()) {
    return demoGetConfiguracoes();
  }

  return requestMarmitasAdmin<ConfiguracoesSite>('configuracoes.get');
}

export function saveConfiguracoesSiteN8n(data: ConfiguracoesSiteUpdate) {
  if (!hasN8NBaseUrl()) {
    return demoSaveConfiguracoes(data);
  }

  return requestMarmitasAdmin<ConfiguracoesSite>('configuracoes.save', { data });
}

export function fetchTaxasEntregaAdminN8n() {
  return requestMarmitasAdmin<DeliveryZone[]>('taxasEntrega.list');
}

export function createTaxaEntregaN8n(data: Pick<DeliveryZone, 'bairro' | 'taxa_quinta_sexta' | 'taxa_sab_dom_feriado'> & {
  ativo?: boolean;
  zona?: string | null;
  observacao?: string | null;
}) {
  return requestMarmitasAdmin<DeliveryZone>('taxasEntrega.create', { data });
}

export function updateTaxaEntregaN8n(id: number, data: Partial<DeliveryZone>) {
  return requestMarmitasAdmin<DeliveryZone>('taxasEntrega.update', { id, data });
}

export function deleteTaxaEntregaN8n(id: number) {
  return requestMarmitasAdmin<{ id: number }>('taxasEntrega.delete', { id });
}

export function fetchDatasTaxaEspecialN8n() {
  return requestMarmitasAdmin<DeliverySpecialDate[]>('datasTaxaEspecial.list');
}

export function createDataTaxaEspecialN8n(data: Pick<DeliverySpecialDate, 'data'> & {
  descricao?: string | null;
  ativo?: boolean;
}) {
  return requestMarmitasAdmin<DeliverySpecialDate>('datasTaxaEspecial.create', { data });
}

export function updateDataTaxaEspecialN8n(id: number, data: Partial<DeliverySpecialDate>) {
  return requestMarmitasAdmin<DeliverySpecialDate>('datasTaxaEspecial.update', { id, data });
}

export function deleteDataTaxaEspecialN8n(id: number) {
  return requestMarmitasAdmin<{ id: number }>('datasTaxaEspecial.delete', { id });
}

export interface GestorAcesso {
  id: string;
  username: string;
  name: string | null;
  role: 'gestor';
  created_at: string | null;
}

export function fetchGestoresN8n() {
  return requestMarmitasAdminPath<GestorAcesso[]>(marmitasWebhookPaths.admin.gestores, { action: 'list' });
}

export function createGestorN8n(data: { username: string; password: string; name?: string | null }) {
  return requestMarmitasAdminPath<GestorAcesso>(marmitasWebhookPaths.admin.gestores, { action: 'create', data });
}

export function fetchPedidosListN8n(params: {
  page: number;
  pageSize: number;
  searchTerm: string;
  statusFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  return requestMarmitasAdmin<{ data: PedidoListItem[]; count: number }>('pedidos.list', params);
}

export function fetchPedidoDetailN8n(id: string) {
  return requestMarmitasAdmin<Pedido>('pedidos.detail', { id });
}

export function fetchPedidosResumoN8n(params: {
  searchTerm: string;
  statusFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  return requestMarmitasAdmin<PedidosResumo>('pedidos.resumo', params);
}

export function updatePedidoStatusN8n(id: string, status: string) {
  return requestMarmitasAdminPath<{ id: string }>(marmitasWebhookPaths.admin.pedidoStatus, { id, status });
}

export function updatePedidoObservacoesN8n(id: string, observacoes_admin: string) {
  return requestMarmitasAdmin<{ id: string }>('pedidos.updateObservacoes', {
    id,
    observacoes_admin,
  });
}

export function fetchCaixaListN8n(params: {
  page: number;
  pageSize: number;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  return requestMarmitasAdminPath<{ data: CaixaMovimentacao[]; count: number }>(
    marmitasWebhookPaths.admin.caixa,
    { action: 'list', ...params }
  );
}

export function fetchCaixaResumoN8n(params: { dateFrom: string | null; dateTo: string | null }) {
  return requestMarmitasAdminPath<CaixaResumo>(marmitasWebhookPaths.admin.caixa, {
    action: 'resumo',
    ...params,
  });
}

export function fetchCaixaSeriesN8n(params: { dateFrom: string | null; dateTo: string | null }) {
  return requestMarmitasAdminPath<CaixaSerieDiaria[]>(marmitasWebhookPaths.admin.caixa, {
    action: 'series',
    ...params,
  });
}

export function updateCaixaMovimentacaoN8n(id: string, data: Partial<CaixaMovimentacao>) {
  return requestMarmitasAdminPath<{ id: string }>(marmitasWebhookPaths.admin.caixa, {
    action: 'update',
    id,
    data,
  });
}

export function deleteCaixaMovimentacaoN8n(id: string) {
  return requestMarmitasAdminPath<{ id: string }>(marmitasWebhookPaths.admin.caixa, {
    action: 'delete',
    id,
  });
}

export function restorePedidoEstoqueN8n(id: string) {
  return requestMarmitasAdmin<{ id: string }>('estoque.restorePedido', { id });
}
