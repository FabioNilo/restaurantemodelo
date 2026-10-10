// "Backend" local para a demo: quando não há n8n configurado
// (public/runtime-config.js com VITE_CHIPTRACK_WEBHOOK_BASE_URL vazio),
// login, cardápio e configurações do admin passam a ler/gravar no
// localStorage do navegador, em vez de falhar. Cada visitante enxerga
// o próprio estado; nada disso é compartilhado ou enviado a lugar nenhum.
import { cardapioLocal } from '@/data/cardapio';
import type { AuthSession } from '@/features/integrations/n8n-contracts';
import { DEFAULT_SITE_SETTINGS, isDeliveryClosed, isRetiradaClosed, SITE_CLOSED_MESSAGE, type ConfiguracoesSite, type ConfiguracoesSiteUpdate } from '@/lib/site-settings';
import { ESTOQUE_BAIXO, SEM_CATEGORIA, type Categoria, type Marmita, type MarmitaAdminListItem, type MarmitaFiltros, type ProdutoLoteAlteracao } from '@/types/product';

export const DEMO_ADMIN_USERNAME = 'admin';
export const DEMO_ADMIN_PASSWORD = 'demo1234';
const DEMO_TOKEN = 'demo-admin-token';

// Chaves próprias do Nosso Bistrô: quem já abriu a demo antiga recebe o cardápio novo.
const STORAGE_KEY_CARDAPIO = 'nossobistro_demo_cardapio_v1';
const STORAGE_KEY_CONFIG = 'nossobistro_demo_config_v1';

interface DemoState {
  categorias: Categoria[];
  marmitas: Marmita[];
}

function nowIso() {
  return new Date().toISOString();
}

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function seedState(): DemoState {
  const timestamp = nowIso();

  return {
    categorias: cardapioLocal.categorias.map((categoria) => ({
      id: categoria.id,
      nome: categoria.nome,
      ordem: categoria.ordem,
      ativo: true,
      created_at: timestamp,
    })),
    marmitas: cardapioLocal.marmitas.map((marmita) => ({
      ...marmita,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  };
}

function loadState(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CARDAPIO);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // localStorage indisponível (modo privado, etc.) — segue com o cardápio padrão.
  }

  const seeded = seedState();
  saveState(seeded);
  return seeded;
}

function saveState(state: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY_CARDAPIO, JSON.stringify(state));
  } catch {
    // Sem persistência disponível — a sessão atual continua funcionando em memória.
  }
}

export function resetDemoData() {
  try {
    window.localStorage.removeItem(STORAGE_KEY_CARDAPIO);
    window.localStorage.removeItem(STORAGE_KEY_CONFIG);
  } catch {
    // ignore
  }
}

// --- Autenticação ---

export async function demoLogin(username: string, password: string): Promise<AuthSession> {
  await delay(null, 300);

  if (username.trim().toLowerCase() !== DEMO_ADMIN_USERNAME || password !== DEMO_ADMIN_PASSWORD) {
    throw new Error('Usuário ou senha incorretos');
  }

  return {
    access_token: DEMO_TOKEN,
    expires_at: null,
    user: { id: 'demo-admin', username: DEMO_ADMIN_USERNAME, role: 'admin', name: 'Admin (demo)' },
  };
}

export function isDemoToken(token: string | undefined | null) {
  return token === DEMO_TOKEN;
}

// --- Cardápio (produtos e categorias) ---

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function demoListMarmitasAdmin(page: number, pageSize: number, filtros: MarmitaFiltros = {}) {
  const state = loadState();
  const busca = semAcento(filtros.busca?.trim() ?? '');
  const sorted = state.marmitas
    .filter((marmita) => !busca || semAcento(marmita.nome).includes(busca))
    .filter((marmita) =>
      !filtros.categoria_id ? true : filtros.categoria_id === SEM_CATEGORIA ? !marmita.categoria_id : marmita.categoria_id === filtros.categoria_id
    )
    // Mesmos filtros rápidos do servidor (buildProdutoFiltro).
    .filter((marmita) => !filtros.foto || (filtros.foto === 'com') === !!marmita.imagem_url?.trim())
    .filter((marmita) => !filtros.disponibilidade || (filtros.disponibilidade === 'disponivel') === !!marmita.disponivel)
    .filter((marmita) => !filtros.sem_custo || marmita.custo === null || marmita.custo === undefined)
    .filter((marmita) => {
      const estoque = marmita.estoque ?? 0;
      if (filtros.estoque === 'zerado') return estoque === 0;
      if (filtros.estoque === 'baixo') return estoque >= 1 && estoque <= ESTOQUE_BAIXO;
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const start = (page - 1) * pageSize;
  const data = sorted.slice(start, start + pageSize) as MarmitaAdminListItem[];

  return delay({ data, count: sorted.length });
}

export async function demoListCategoriasAdmin(): Promise<Categoria[]> {
  return delay(loadState().categorias);
}

export async function demoGetMarmitaDetail(id: string): Promise<Marmita> {
  const item = loadState().marmitas.find((marmita) => marmita.id === id);

  if (!item) {
    throw new Error('Produto não encontrado.');
  }

  return delay(item);
}

export async function demoCreateMarmita(
  data: Omit<Marmita, 'id' | 'created_at' | 'updated_at'>
): Promise<{ id: string }> {
  const state = loadState();
  const id = generateId('produto');
  const timestamp = nowIso();

  state.marmitas.push({ ...data, id, created_at: timestamp, updated_at: timestamp });
  saveState(state);

  return delay({ id });
}

export async function demoUpdateMarmitasLote(itens: ProdutoLoteAlteracao[]) {
  const state = loadState();

  for (const item of itens) {
    const index = state.marmitas.findIndex((marmita) => marmita.id === item.id);
    if (index === -1) throw new Error('Um dos produtos não existe mais. Atualize a tela.');
    const atual = state.marmitas[index];
    const precos = new Map(item.opcoes?.map((opcao) => [opcao.codigo, opcao.preco]));

    state.marmitas[index] = {
      ...atual,
      preco: item.preco ?? atual.preco,
      custo: item.custo === undefined ? atual.custo : item.custo,
      tamanhos: atual.tamanhos?.map((tamanho) => (precos.has(tamanho.codigo) ? { ...tamanho, preco: precos.get(tamanho.codigo) as number } : tamanho)),
      updated_at: nowIso(),
    };
  }

  saveState(state);
  return delay({ atualizados: itens.length });
}

export async function demoUpdateMarmitasMassa(input: { ids: string[]; disponivel?: boolean; categoria_id?: string }) {
  const state = loadState();
  const ids = new Set(input.ids);
  state.marmitas = state.marmitas.map((marmita) =>
    ids.has(marmita.id)
      ? {
          ...marmita,
          ...(input.disponivel === undefined ? {} : { disponivel: input.disponivel }),
          ...(input.categoria_id === undefined ? {} : { categoria_id: input.categoria_id === SEM_CATEGORIA ? null : input.categoria_id }),
          updated_at: nowIso(),
        }
      : marmita
  );
  saveState(state);
  return delay({ atualizados: ids.size });
}

export async function demoUpdateMarmita(id: string, data: Partial<Marmita>): Promise<{ id: string }> {
  const state = loadState();
  const index = state.marmitas.findIndex((marmita) => marmita.id === id);

  if (index === -1) {
    throw new Error('Produto não encontrado.');
  }

  state.marmitas[index] = { ...state.marmitas[index], ...data, id, updated_at: nowIso() };
  saveState(state);

  return delay({ id });
}

export async function demoUpdateMarmitaStock(
  id: string,
  estoque: number
): Promise<{ id: string; estoque: number; disponivel: boolean }> {
  const state = loadState();
  const index = state.marmitas.findIndex((marmita) => marmita.id === id);

  if (index === -1) {
    throw new Error('Produto não encontrado.');
  }

  const disponivel = estoque > 0;
  state.marmitas[index] = { ...state.marmitas[index], estoque, disponivel, updated_at: nowIso() };
  saveState(state);

  return delay({ id, estoque, disponivel });
}

export async function demoDeleteMarmita(id: string): Promise<{ id: string }> {
  const state = loadState();
  state.marmitas = state.marmitas.filter((marmita) => marmita.id !== id);
  saveState(state);

  return delay({ id });
}

export async function demoCreateCategoria(data: {
  id?: string;
  nome: string;
  ordem?: number;
  ativo?: boolean;
}): Promise<{ id: string }> {
  const state = loadState();
  const id = data.id?.trim() || generateId('categoria');

  state.categorias.push({
    id,
    nome: data.nome,
    ordem: data.ordem ?? state.categorias.length + 1,
    ativo: data.ativo ?? true,
    created_at: nowIso(),
  });
  saveState(state);

  return delay({ id });
}

export async function demoUpdateCategoria(id: string, data: Partial<Categoria>): Promise<{ id: string }> {
  const state = loadState();
  const index = state.categorias.findIndex((categoria) => categoria.id === id);

  if (index === -1) {
    throw new Error('Categoria não encontrada.');
  }

  state.categorias[index] = { ...state.categorias[index], ...data, id };
  saveState(state);

  return delay({ id });
}

export async function demoDeleteCategoria(id: string): Promise<{ id: string }> {
  const state = loadState();
  state.categorias = state.categorias.filter((categoria) => categoria.id !== id);
  saveState(state);

  return delay({ id });
}

// --- Configurações do site ---

export async function demoGetConfiguracoes(): Promise<ConfiguracoesSite> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return delay(JSON.parse(raw) as ConfiguracoesSite);
  } catch {
    // segue com o padrão
  }

  return delay(DEFAULT_SITE_SETTINGS);
}

export async function demoSaveConfiguracoes(data: ConfiguracoesSiteUpdate): Promise<ConfiguracoesSite> {
  const current = await demoGetConfiguracoes();
  const next: ConfiguracoesSite = { ...current, ...data, updated_at: nowIso() };

  try {
    window.localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(next));
  } catch {
    // segue apenas em memória para esta sessão
  }

  return delay(next);
}

export async function demoGetPublicCatalog() {
  const state = loadState();

  return {
    categorias: state.categorias.map(({ id, nome, ordem }) => ({ id, nome, ordem })),
    marmitas: state.marmitas,
  };
}

export async function demoGetSitePublicStatus() {
  const settings = await demoGetConfiguracoes();
  const entregasAbertasAgora = !isDeliveryClosed(settings);

  return {
    whatsapp_numero: settings.whatsapp_numero,
    mensagem_fechado: settings.mensagem_fechado || SITE_CLOSED_MESSAGE,
    mostrar_aviso_fechado: true,
    entregas_abertas_agora: entregasAbertasAgora,
    retirada_aberta_agora: !isRetiradaClosed(settings),
  };
}
