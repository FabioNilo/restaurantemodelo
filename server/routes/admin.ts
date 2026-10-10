import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AdminRole, type AdminUser, type AuthEnv } from '../auth.js';
import {
  categoriaCreateSchema,
  categoriaUpdateSchema,
  configuracoesSaveSchema,
  createCategoria,
  createProduto,
  deleteCategoria,
  deleteProduto,
  getConfiguracoes,
  getProduto,
  listCategorias,
  listProdutos,
  produtoFiltrosSchema,
  produtosLoteSchema,
  produtosMassaSchema,
  updateProdutosLote,
  updateProdutosMassa,
  produtoCreateSchema,
  produtoUpdateSchema,
  saveConfiguracoes,
  updateCategoria,
  updateProduto,
  updateProdutoEstoque,
} from '../catalog.js';
import {
  atualizarBairro,
  atualizarBairroSchema,
  criarBairro,
  criarBairroSchema,
  excluirBairro,
  excluirBairroSchema,
  listarBairros,
} from '../bairros.js';
import { ApiError, noStore, ok } from '../http.js';
import { chavePublicaPush, enviarTeste, inscricaoSchema, removerInscricao, removerInscricaoSchema, salvarInscricao } from '../push.js';
import {
  atualizarStatusDelivery,
  entregarDelivery,
  entregarSchema,
  listarDelivery,
  statusDeliverySchema,
} from '../delivery.js';
import { assertPeriodo, desempenhoSchema, getDesempenho, getMetricas, getMovimentosCaixa, metricasSchema } from '../relatorios.js';
import {
  atualizarMesa,
  criarPedidoMesa,
  pedidoAtendenteSchema,
  atualizarStatusPedido,
  cancelarConta,
  criarMesa,
  excluirMesa,
  fecharConta,
  fecharContaSchema,
  getDetalheMesa,
  getPainel,
  listarMesas,
  mesaCreateSchema,
  mesaUpdateSchema,
  regenerarTokenMesa,
  statusPedidoSchema,
} from '../mesas.js';

export const adminRoutes = new Hono<AuthEnv>();

adminRoutes.use('*', async (c, next) => {
  noStore(c);
  await next();
});

const idSchema = z.object({ id: z.string().trim().min(1) });
const mesaIdSchema = z.object({ id: z.coerce.number().int().positive() });
const contaIdSchema = z.object({ id: z.string().uuid() });
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

interface ActionDefinition {
  roles: AdminRole[];
  run: (payload: Record<string, unknown>, user: AdminUser) => Promise<unknown>;
}

// Mesmas "actions" que o front envia em POST /massas/admin/api (marmitas-api.ts).
const actions: Record<string, ActionDefinition> = {
  'marmitas.list': {
    roles: ['admin', 'gestor'],
    run: async (payload) => {
      const { page, pageSize } = pageSchema.parse(payload);
      return listProdutos(page, pageSize, produtoFiltrosSchema.parse(payload));
    },
  },
  'marmitas.detail': {
    roles: ['admin', 'gestor'],
    run: async (payload) => getProduto(idSchema.parse(payload).id),
  },
  'marmitas.create': {
    roles: ['admin'],
    run: async (payload) => createProduto(produtoCreateSchema.parse(payload.data)),
  },
  'marmitas.update': {
    roles: ['admin'],
    run: async (payload) => updateProduto(idSchema.parse(payload).id, produtoUpdateSchema.parse(payload.data)),
  },
  'marmitas.lote': {
    roles: ['admin'],
    run: async (payload) => updateProdutosLote(produtosLoteSchema.parse(payload)),
  },
  'marmitas.massa': {
    roles: ['admin'],
    run: async (payload) => updateProdutosMassa(produtosMassaSchema.parse(payload)),
  },
  'marmitas.delete': {
    roles: ['admin'],
    run: async (payload) => deleteProduto(idSchema.parse(payload).id),
  },
  'categorias.list': {
    roles: ['admin', 'gestor'],
    run: async () => listCategorias(),
  },
  'categorias.create': {
    roles: ['admin'],
    run: async (payload) => createCategoria(categoriaCreateSchema.parse(payload.data)),
  },
  'categorias.update': {
    roles: ['admin'],
    run: async (payload) => updateCategoria(idSchema.parse(payload).id, categoriaUpdateSchema.parse(payload.data)),
  },
  'categorias.delete': {
    roles: ['admin'],
    run: async (payload) => deleteCategoria(idSchema.parse(payload).id),
  },
  'configuracoes.get': {
    roles: ['admin'],
    run: async () => getConfiguracoes(),
  },
  'configuracoes.save': {
    roles: ['admin'],
    run: async (payload) => saveConfiguracoes(configuracoesSaveSchema.parse(payload.data)),
  },
  // --- Mesas (QR code) e caixa ---
  'mesas.list': {
    roles: ['admin', 'gestor'],
    run: async () => listarMesas(),
  },
  'mesas.create': {
    roles: ['admin'],
    run: async (payload) => criarMesa(mesaCreateSchema.parse(payload.data)),
  },
  'mesas.update': {
    roles: ['admin'],
    run: async (payload) => atualizarMesa(mesaIdSchema.parse(payload).id, mesaUpdateSchema.parse(payload.data)),
  },
  'mesas.delete': {
    roles: ['admin'],
    run: async (payload) => excluirMesa(mesaIdSchema.parse(payload).id),
  },
  'mesas.regenerarToken': {
    roles: ['admin'],
    run: async (payload) => regenerarTokenMesa(mesaIdSchema.parse(payload).id),
  },
  'mesas.detalhe': {
    roles: ['admin', 'gestor'],
    run: async (payload) => getDetalheMesa(mesaIdSchema.parse(payload).id),
  },
  'mesas.painel': {
    roles: ['admin', 'gestor'],
    run: async () => getPainel(),
  },
  // Pedido lançado pela equipe: sem telefone, nome opcional e já confirmado.
  'pedidosMesa.lancar': {
    roles: ['admin', 'gestor'],
    run: async (payload) => {
      const { token, ...pedido } = pedidoAtendenteSchema.parse(payload);
      return criarPedidoMesa(token, pedido, 'atendente');
    },
  },
  'pedidosMesa.status': {
    roles: ['admin', 'gestor'],
    run: async (payload) => atualizarStatusPedido(statusPedidoSchema.parse(payload)),
  },
  'contas.fechar': {
    roles: ['admin', 'gestor'],
    run: async (payload, user) => fecharConta(fecharContaSchema.parse(payload), user.id),
  },
  'contas.cancelar': {
    roles: ['admin'],
    run: async (payload) => cancelarConta(contaIdSchema.parse(payload).id),
  },
  // --- Delivery ---
  // --- Notificações push (PWA do painel): cada pessoa ativa no próprio aparelho ---
  'push.config': {
    roles: ['admin', 'gestor'],
    run: async () => ({ publicKey: chavePublicaPush() }),
  },
  'push.subscribe': {
    roles: ['admin', 'gestor'],
    run: async (payload, user) => salvarInscricao(user.id, inscricaoSchema.parse(payload)),
  },
  'push.unsubscribe': {
    roles: ['admin', 'gestor'],
    run: async (payload, user) => removerInscricao(user.id, removerInscricaoSchema.parse(payload).endpoint),
  },
  'push.testar': {
    roles: ['admin', 'gestor'],
    run: async (_payload, user) => enviarTeste(user.id),
  },
  // --- Bairros e taxas de entrega (Configurações) ---
  'bairros.list': {
    roles: ['admin'],
    run: async () => listarBairros(),
  },
  'bairros.create': {
    roles: ['admin'],
    run: async (payload) => criarBairro(criarBairroSchema.parse(payload)),
  },
  'bairros.update': {
    roles: ['admin'],
    run: async (payload) => atualizarBairro(atualizarBairroSchema.parse(payload)),
  },
  'bairros.delete': {
    roles: ['admin'],
    run: async (payload) => excluirBairro(excluirBairroSchema.parse(payload)),
  },
  'delivery.list': {
    roles: ['admin', 'gestor'],
    run: async () => listarDelivery(),
  },
  'delivery.status': {
    roles: ['admin', 'gestor'],
    run: async (payload) => atualizarStatusDelivery(statusDeliverySchema.parse(payload)),
  },
  'delivery.entregar': {
    roles: ['admin', 'gestor'],
    run: async (payload, user) => entregarDelivery(entregarSchema.parse(payload), user.id),
  },
  // --- Caixa e relatórios ---
  'caixa.movimentos': {
    roles: ['admin', 'gestor'],
    run: async (payload) => getMovimentosCaixa(assertPeriodo(payload)),
  },
  metricas: {
    roles: ['admin'],
    run: async (payload) => getMetricas(metricasSchema.parse(payload).dias),
  },
  desempenho: {
    roles: ['admin'],
    run: async (payload) => getDesempenho(desempenhoSchema.parse(payload).dias),
  },
};

export function getAdminAction(name: string) {
  return Object.hasOwn(actions, name) ? actions[name] : undefined;
}

adminRoutes.post('/api', requireRole('admin', 'gestor'), async (c) => {
  const payload = await c.req.json<Record<string, unknown>>().catch(() => {
    throw new ApiError(400, 'Corpo da requisição inválido.');
  });
  const action = typeof payload.action === 'string' ? getAdminAction(payload.action) : undefined;

  if (!action) {
    // Pedidos, Caixa, Taxas de entrega e Gestores ainda não existem nesta versão.
    throw new ApiError(501, 'Módulo não habilitado nesta versão.');
  }

  const user = c.get('user');

  if (!action.roles.includes(user.role)) {
    throw new ApiError(403, 'Você não tem permissão para esta ação.');
  }

  return ok(c, await action.run(payload, user));
});

const estoqueSchema = z.object({
  id: z.string().trim().min(1),
  estoque: z.coerce.number().int().min(0),
});

adminRoutes.post('/estoque', requireRole('admin', 'gestor'), async (c) => {
  const { id, estoque } = estoqueSchema.parse(await c.req.json());
  return ok(c, await updateProdutoEstoque(id, estoque));
});

// Rotas dos módulos futuros respondem de forma explícita em vez de 404.
for (const path of ['/pedidos/status', '/caixa', '/gestores']) {
  adminRoutes.post(path, requireRole('admin', 'gestor'), () => {
    throw new ApiError(501, 'Módulo não habilitado nesta versão.');
  });
}
