import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole, type AdminRole, type AuthEnv } from '../auth.js';
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
  produtoCreateSchema,
  produtoUpdateSchema,
  saveConfiguracoes,
  updateCategoria,
  updateProduto,
  updateProdutoEstoque,
} from '../catalog.js';
import { ApiError, noStore, ok } from '../http.js';

export const adminRoutes = new Hono<AuthEnv>();

adminRoutes.use('*', async (c, next) => {
  noStore(c);
  await next();
});

const idSchema = z.object({ id: z.string().trim().min(1) });
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

interface ActionDefinition {
  roles: AdminRole[];
  run: (payload: Record<string, unknown>) => Promise<unknown>;
}

// Mesmas "actions" que o front envia em POST /massas/admin/api (marmitas-api.ts).
const actions: Record<string, ActionDefinition> = {
  'marmitas.list': {
    roles: ['admin', 'gestor'],
    run: async (payload) => {
      const { page, pageSize } = pageSchema.parse(payload);
      return listProdutos(page, pageSize);
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

  if (!action.roles.includes(c.get('user').role)) {
    throw new ApiError(403, 'Você não tem permissão para esta ação.');
  }

  return ok(c, await action.run(payload));
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
