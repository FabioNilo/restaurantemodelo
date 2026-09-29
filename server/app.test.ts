// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, getSql: vi.fn() }));

import { restoreOriginalUrl } from '../api/index.js';
import { app } from './app.js';
import { signSession, verifySessionToken } from './auth.js';

const ADMIN = { id: 'u-admin', username: 'admin', name: 'Admin', role: 'admin' as const, password_hash: 'x', token_version: 3 };
const GESTOR = { ...ADMIN, id: 'u-gestor', username: 'gestor', role: 'gestor' as const, token_version: 0 };

function mockUsers(...users: Array<typeof ADMIN | typeof GESTOR>) {
  queryMock.mockImplementation(async (text: string, params: unknown[] = []) => {
    if (text.includes('from usuarios_admin where id')) {
      return users.filter((user) => user.id === params[0]);
    }
    return [];
  });
}

async function bearer(user: typeof ADMIN | typeof GESTOR, tokenVersion = user.token_version) {
  const { token } = await signSession({ ...user, token_version: tokenVersion });
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

function postAdmin(body: unknown, headers: Record<string, string>) {
  return app.request('/api/massas/admin/api', { method: 'POST', headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
  queryMock.mockReset();
});

describe('sessões', () => {
  it('assina e valida o token, e rejeita token adulterado', async () => {
    const { token } = await signSession(ADMIN);
    await expect(verifySessionToken(token)).resolves.toEqual({ sub: 'u-admin', role: 'admin', tv: 3 });
    await expect(verifySessionToken(`${token}x`)).rejects.toMatchObject({ status: 401 });
  });

  it('rejeita token emitido antes da troca de senha (token_version antigo)', async () => {
    mockUsers(ADMIN);
    const response = await postAdmin({ action: 'categorias.list' }, await bearer(ADMIN, 2));
    expect(response.status).toBe(401);
  });
});

describe('POST /api/massas/admin/api', () => {
  it('exige login', async () => {
    const response = await postAdmin({ action: 'categorias.list' }, { 'content-type': 'application/json' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it('responde 501 para módulos ainda não habilitados', async () => {
    mockUsers(ADMIN);
    const response = await postAdmin({ action: 'pedidos.list' }, await bearer(ADMIN));
    expect(response.status).toBe(501);
  });

  it('valida o payload antes de gravar', async () => {
    mockUsers(ADMIN);
    const response = await postAdmin({ action: 'marmitas.create', data: { nome: '', preco: 5 } }, await bearer(ADMIN));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'O nome é obrigatório.' });
  });

  it('não deixa o gestor alterar o cardápio', async () => {
    mockUsers(GESTOR);
    const response = await postAdmin({ action: 'marmitas.delete', id: 'x' }, await bearer(GESTOR));
    expect(response.status).toBe(403);
  });

  it('devolve o envelope { success, data } que o front espera', async () => {
    mockUsers(ADMIN);
    queryMock.mockImplementationOnce(async () => [ADMIN]).mockImplementationOnce(async () => [
      { id: 'cafes', nome: 'Cafés', ordem: 4, ativo: true, created_at: '2026-09-29T00:00:00Z' },
    ]);

    const response = await postAdmin({ action: 'categorias.list' }, await bearer(ADMIN));
    expect(await response.json()).toEqual({
      success: true,
      data: [{ id: 'cafes', nome: 'Cafés', ordem: 4, ativo: true, created_at: '2026-09-29T00:00:00.000Z' }],
    });
  });
});

describe('rotas públicas', () => {
  it('serve o catálogo com cache de CDN e sem produtos indisponíveis (filtro no SQL)', async () => {
    queryMock.mockResolvedValue([]);
    const response = await app.request('/api/massas/catalogo');

    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=30');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('where disponivel and estoque > 0'))).toBe(true);
  });

  it('responde 501 ao registro de pedidos, para o carrinho seguir pelo WhatsApp', async () => {
    const response = await app.request('/api/massas/pedidos', { method: 'POST', body: '{}' });
    expect(response.status).toBe(501);
  });
});

describe('api/index (Vercel)', () => {
  it('reconstrói a URL original a partir do rewrite do vercel.json', () => {
    const request = restoreOriginalUrl(new Request('https://site.test/api/index?__path=massas/catalogo&x=1'));
    expect(new URL(request.url).pathname).toBe('/api/massas/catalogo');
    expect(new URL(request.url).search).toBe('?x=1');
  });
});
