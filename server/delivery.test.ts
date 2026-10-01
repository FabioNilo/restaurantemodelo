// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, getSql: vi.fn() }));

import { app } from './app.js';
import { signSession } from './auth.js';

const PRODUTOS = [
  { id: 'cappuccino', nome: 'Cappuccino', preco: '11.00', estoque: 99, disponivel: true, tamanhos: [] },
  {
    id: 'picole',
    nome: 'Picolé',
    preco: '8.00',
    estoque: 99,
    disponivel: true,
    tamanhos: [{ codigo: 'opcao_pistache', nome: 'Pistache', serve: '', preco: 13.9 }],
  },
];

const USERS = [
  { id: 'u-admin', username: 'admin', name: null, role: 'admin', password_hash: 'x', token_version: 0 },
  { id: 'u-gestor', username: 'caixa', name: null, role: 'gestor', password_hash: 'x', token_version: 0 },
];

function simularBanco({ recentes = 0 } = {}) {
  const chamadas: Array<{ sql: string; params: unknown[] }> = [];

  queryMock.mockImplementation(async (sql: string, params: unknown[] = []) => {
    chamadas.push({ sql, params });
    if (sql.includes('from usuarios_admin where id')) return USERS.filter((u) => u.id === params[0]);
    if (sql.includes('from pedidos_delivery where telefone')) return [{ recentes }];
    if (sql.includes('from produtos where id = any')) return PRODUTOS.filter((p) => (params[0] as string[]).includes(p.id));
    if (sql.includes('insert into pedidos_delivery')) {
      return [{ id: 'f1b8a0c2-1111-4c4c-9d9d-000000000001', status: 'recebido', valor_total: params[8], created_at: '2026-09-30T15:00:00Z' }];
    }
    if (sql.includes('select subtotal, taxa_entrega from pedidos_delivery')) return [{ subtotal: '35.90', taxa_entrega: null }];
    if (sql.includes('insert into pagamentos')) return [{ id: params[0], valor_total: String(params[3]) }];
    return [];
  });

  return chamadas;
}

const pedido = {
  itens: [
    { id: 'picole:opcao_pistache', tamanho_codigo: 'opcao_pistache', quantidade: 1, preco: 0.01 },
    { id: 'cappuccino', quantidade: 2, preco: 0.01 },
  ],
  valor_total: 0.03,
  nome_cliente: 'Carla',
  telefone_cliente: '(73) 98888-7777',
  endereco_cliente: 'Rua A, 10',
  bairro_cliente: 'Centro',
  forma_pagamento: 'cartao_debito',
  tracking_base_url: 'https://nossobistro.vercel.app/pedido',
};

const postPedido = (body: unknown) =>
  app.request('/api/massas/pedidos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function postAdmin(user: 'u-admin' | 'u-gestor', body: unknown) {
  const { token } = await signSession({ id: user, role: user === 'u-admin' ? 'admin' : 'gestor', token_version: 0 });
  return app.request('/api/massas/admin/api', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
  queryMock.mockReset();
});

describe('POST /api/massas/pedidos (delivery)', () => {
  it('registra com preços do cardápio, ignorando os do navegador, e devolve o link de acompanhamento', async () => {
    const chamadas = simularBanco();
    const response = await postPedido(pedido);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.valor_total).toBe(35.9); // 13,90 + 2 × 11,00
    expect(body.data.tracking_url).toMatch(/^https:\/\/nossobistro\.vercel\.app\/pedido\/f1b8a0c2-.*\?token=/);

    const insert = chamadas.find((c) => c.sql.includes('insert into pedidos_delivery'))!;
    expect(insert.params[2]).toBe('73988887777'); // telefone só com dígitos
    expect(JSON.parse(String(insert.params[7])).map((i: { preco: number }) => i.preco)).toEqual([13.9, 11]);
    expect(insert.params[9]).toBe('cartao_debito');
  });

  it('recusa dinheiro e aplica o limite por telefone', async () => {
    simularBanco();
    expect((await postPedido({ ...pedido, forma_pagamento: 'dinheiro' })).status).toBe(400);

    simularBanco({ recentes: 5 });
    expect((await postPedido(pedido)).status).toBe(429);
  });
});

describe('painel', () => {
  it('ao entregar, grava o total com a taxa e lança o pagamento no caixa', async () => {
    const chamadas = simularBanco();
    const response = await postAdmin('u-gestor', {
      action: 'delivery.entregar',
      id: 'f1b8a0c2-1111-4c4c-9d9d-000000000001',
      metodo: 'pix',
      taxa_entrega: 5,
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data.valor_total).toBe(40.9);
    const baixa = chamadas.find((c) => c.sql.includes('insert into pagamentos'))!;
    expect(baixa.params).toEqual(['f1b8a0c2-1111-4c4c-9d9d-000000000001', 'pix', 5, 40.9, 'u-gestor']);
  });

  it('gestor não vê métricas, desempenho nem cadastra mesas; caixa valida o período', async () => {
    simularBanco();
    expect((await postAdmin('u-gestor', { action: 'metricas', dias: 7 })).status).toBe(403);
    expect((await postAdmin('u-gestor', { action: 'desempenho', dias: 30 })).status).toBe(403);
    expect((await postAdmin('u-gestor', { action: 'mesas.create', data: { numero: 9 } })).status).toBe(403);

    const invertido = await postAdmin('u-gestor', { action: 'caixa.movimentos', de: '2026-09-30', ate: '2026-09-01' });
    expect(invertido.status).toBe(400);
    expect((await invertido.json()).error).toBe('A data inicial deve ser antes da final.');
    expect((await postAdmin('u-gestor', { action: 'caixa.movimentos', de: '2026-09-01', ate: '2026-09-30' })).status).toBe(200);
  });
});
