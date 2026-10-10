// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, enviarMock, vapidMock } = vi.hoisted(() => ({ queryMock: vi.fn(), enviarMock: vi.fn(), vapidMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, getSql: vi.fn() }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vapidMock, sendNotification: enviarMock } }));

import { app } from './app.js';
import { signSession } from './auth.js';
import { avisarPedidoNovo, enviarTeste } from './push.js';

const AVISO = { titulo: 'Novo pedido de delivery', corpo: 'Pedido nº 7 · R$ 24,00', url: '/admin/delivery', tag: 'delivery-7' };
const INSCRICOES = [
  { id: 'i1', endpoint: 'https://push.example/a', p256dh: 'p256dh-a', auth: 'auth-a' },
  { id: 'i2', endpoint: 'https://push.example/b', p256dh: 'p256dh-b', auth: 'auth-b' },
  { id: 'i3', endpoint: 'https://push.example/c', p256dh: 'p256dh-c', auth: 'auth-c' },
];
const USERS = [
  { id: 'u-admin', username: 'admin', name: null, role: 'admin', password_hash: 'x', token_version: 0 },
  { id: 'u-gestor', username: 'caixa', name: null, role: 'gestor', password_hash: 'x', token_version: 0 },
];

const comChaves = () => {
  process.env.VAPID_PUBLIC_KEY = 'chave-publica-de-teste';
  process.env.VAPID_PRIVATE_KEY = 'chave-privada-de-teste';
};

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  queryMock.mockReset();
  enviarMock.mockReset();
  vapidMock.mockReset();
  queryMock.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('from usuarios_admin where id')) return USERS.filter((u) => u.id === params[0]);
    if (sql.includes('from push_subscriptions')) return INSCRICOES;
    return [];
  });
});

afterEach(() => vi.useRealTimers());

describe('avisarPedidoNovo', () => {
  it('sem chaves VAPID não consulta o banco nem envia nada', async () => {
    await avisarPedidoNovo(AVISO);
    expect(queryMock).not.toHaveBeenCalled();
    expect(enviarMock).not.toHaveBeenCalled();
  });

  it('envia o aviso (sem dados do cliente) para todos os aparelhos inscritos', async () => {
    comChaves();
    enviarMock.mockResolvedValue({ statusCode: 201 });
    await avisarPedidoNovo(AVISO);

    expect(enviarMock).toHaveBeenCalledTimes(3);
    const [inscricao, corpo, opcoes] = enviarMock.mock.calls[0];
    expect(inscricao).toEqual({ endpoint: 'https://push.example/a', keys: { p256dh: 'p256dh-a', auth: 'auth-a' } });
    expect(JSON.parse(corpo)).toEqual({ title: AVISO.titulo, body: AVISO.corpo, url: AVISO.url, tag: AVISO.tag });
    expect(opcoes).toMatchObject({ urgency: 'high' });
    expect(vapidMock).toHaveBeenCalledWith(expect.stringMatching(/^https:/), 'chave-publica-de-teste', 'chave-privada-de-teste');
  });

  it('apaga inscrições que o aparelho cancelou (404/410) e mantém as que só falharam', async () => {
    comChaves();
    enviarMock
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('erro do servidor'), { statusCode: 500 }))
      .mockResolvedValueOnce({ statusCode: 201 });
    await avisarPedidoNovo(AVISO);

    const apagar = queryMock.mock.calls.find(([sql]) => String(sql).includes('delete from push_subscriptions where id = any'));
    expect(apagar?.[1]).toEqual([['i1']]);
  });

  it('nunca lança erro: o pedido do cliente não pode falhar por causa do push', async () => {
    comChaves();
    queryMock.mockRejectedValue(new Error('banco fora do ar'));
    await expect(avisarPedidoNovo(AVISO)).resolves.toBeUndefined();
  });

  it('não espera mais que o limite quando o serviço de push trava', async () => {
    comChaves();
    vi.useFakeTimers();
    enviarMock.mockReturnValue(new Promise(() => undefined));

    let terminou = false;
    const espera = avisarPedidoNovo(AVISO).then(() => (terminou = true));
    await vi.advanceTimersByTimeAsync(2000);
    expect(terminou).toBe(false);
    await vi.advanceTimersByTimeAsync(700);
    await espera;
    expect(terminou).toBe(true);
  });
});

describe('enviarTeste', () => {
  it('manda só para os aparelhos do próprio usuário', async () => {
    comChaves();
    enviarMock.mockResolvedValue({ statusCode: 201 });
    const r = await enviarTeste('u-gestor');

    expect(r).toEqual({ enviados: 3, removidos: 0 });
    const consulta = queryMock.mock.calls.find(([sql]) => String(sql).includes('where usuario_id = $1'));
    expect(consulta?.[1]).toEqual(['u-gestor']);
  });
});

describe('ações push do painel', () => {
  async function postAdmin(user: 'u-admin' | 'u-gestor' | null, body: unknown) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };

    if (user) {
      const { token } = await signSession({ id: user, role: user === 'u-admin' ? 'admin' : 'gestor', token_version: 0 });
      headers.Authorization = `Bearer ${token}`;
    }

    return app.request('/api/massas/admin/api', { method: 'POST', headers, body: JSON.stringify(body) });
  }

  const inscricao = { endpoint: 'https://push.example/novo', keys: { p256dh: 'p256dh-chave-longa', auth: 'auth-chave-longa' }, user_agent: 'Chrome' };

  it('devolve a chave pública, ou null quando o servidor não tem chaves', async () => {
    expect((await (await postAdmin('u-gestor', { action: 'push.config' })).json()).data).toEqual({ publicKey: null });
    comChaves();
    expect((await (await postAdmin('u-gestor', { action: 'push.config' })).json()).data).toEqual({ publicKey: 'chave-publica-de-teste' });
  });

  it('admin e gestor ativam no próprio aparelho; o aparelho fica ligado ao usuário logado', async () => {
    for (const user of ['u-admin', 'u-gestor'] as const) {
      queryMock.mockClear();
      const r = await postAdmin(user, { action: 'push.subscribe', ...inscricao });
      expect(r.status).toBe(200);

      const gravou = queryMock.mock.calls.find(([sql]) => String(sql).includes('insert into push_subscriptions'));
      expect(gravou?.[1]).toEqual([user, inscricao.endpoint, 'p256dh-chave-longa', 'auth-chave-longa', 'Chrome']);
    }
  });

  it('recusa endpoint sem https e pede login', async () => {
    expect((await postAdmin('u-admin', { action: 'push.subscribe', ...inscricao, endpoint: 'http://inseguro.example/x' })).status).toBe(400);
    expect((await postAdmin('u-admin', { action: 'push.subscribe', endpoint: inscricao.endpoint })).status).toBe(400);
    expect((await postAdmin(null, { action: 'push.subscribe', ...inscricao })).status).toBe(401);
  });

  it('desativar só apaga o aparelho do próprio usuário', async () => {
    const r = await postAdmin('u-gestor', { action: 'push.unsubscribe', endpoint: inscricao.endpoint });
    expect(r.status).toBe(200);
    const apagou = queryMock.mock.calls.find(([sql]) => String(sql).includes('delete from push_subscriptions where endpoint'));
    expect(apagou?.[1]).toEqual([inscricao.endpoint, 'u-gestor']);
  });

  it('teste de notificação funciona para o gestor', async () => {
    comChaves();
    enviarMock.mockResolvedValue({ statusCode: 201 });
    const r = await postAdmin('u-gestor', { action: 'push.testar' });
    expect(r.status).toBe(200);
    expect((await r.json()).data.enviados).toBe(3);
  });
});
