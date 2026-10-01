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

const BAIRROS = [
  { id: 3, nome: 'Centro', taxa: '6.50', ativo: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  { id: 4, nome: 'Pontal', taxa: '0.00', ativo: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
  { id: 5, nome: 'Malhado', taxa: '9.00', ativo: false, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
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
    if (sql.includes('from bairros where lower(nome) = lower($1) and ativo')) {
      return BAIRROS.filter((b) => b.ativo && b.nome.toLowerCase() === String(params[0]).toLowerCase());
    }
    if (sql.includes('from bairros where ativo')) return BAIRROS.filter((b) => b.ativo);
    if (sql.includes('insert into bairros')) {
      if (BAIRROS.some((b) => b.nome.toLowerCase() === String(params[0]).toLowerCase())) throw Object.assign(new Error('dup'), { code: '23505' });
      return [{ id: 9, nome: params[0], taxa: String(params[1]), ativo: params[2], created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z' }];
    }
    if (sql.includes('from produtos where id = any')) return PRODUTOS.filter((p) => (params[0] as string[]).includes(p.id));
    if (sql.includes('insert into pedidos_delivery')) {
      return [
        { id: 'f1b8a0c2-1111-4c4c-9d9d-000000000001', status: 'recebido', subtotal: params[9], valor_total: params[11], created_at: '2026-09-30T15:00:00Z' },
      ];
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
  bairro_cliente: ' centro ',
  taxa_entrega: 0.01,
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
    expect(body.data.subtotal).toBe(35.9); // 13,90 + 2 × 11,00
    expect(body.data.taxa_entrega).toBe(6.5); // taxa do cadastro, não a do navegador
    expect(body.data.valor_total).toBe(42.4);
    expect(body.data.tracking_url).toMatch(/^https:\/\/nossobistro\.vercel\.app\/pedido\/f1b8a0c2-.*\?token=/);

    const insert = chamadas.find((c) => c.sql.includes('insert into pedidos_delivery'))!;
    expect(insert.params[2]).toBe('73988887777'); // telefone só com dígitos
    expect(insert.params[4]).toBe('Centro'); // nome do cadastro
    expect(insert.params[5]).toBe(3); // bairro_id
    expect(JSON.parse(String(insert.params[8])).map((i: { preco: number }) => i.preco)).toEqual([13.9, 11]);
    expect(insert.params.slice(9)).toEqual([35.9, 6.5, 42.4, 'cartao_debito']);
  });

  it('recusa bairro fora da lista ou pausado, sem gravar', async () => {
    for (const bairro_cliente of ['Bairro Novo', 'Malhado']) {
      const chamadas = simularBanco();
      const response = await postPedido({ ...pedido, bairro_cliente });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/Ainda não entregamos neste bairro/);
      expect(chamadas.some((c) => c.sql.includes('insert into pedidos_delivery'))).toBe(false);
    }
  });

  it('recusa dinheiro e aplica o limite por telefone', async () => {
    simularBanco();
    expect((await postPedido({ ...pedido, forma_pagamento: 'dinheiro' })).status).toBe(400);

    simularBanco({ recentes: 5 });
    expect((await postPedido(pedido)).status).toBe(429);
  });
});

describe('bairros e taxas de entrega', () => {
  it('o carrinho recebe só os bairros ativos, com a taxa', async () => {
    simularBanco();
    const zonas = await (await app.request('/api/massas/delivery-zones')).json();
    expect(zonas.data).toEqual([
      { id: 3, bairro: 'Centro', taxa: 6.5, taxa_quinta_sexta: 6.5, taxa_sab_dom_feriado: 6.5, ativo: true },
      { id: 4, bairro: 'Pontal', taxa: 0, taxa_quinta_sexta: 0, taxa_sab_dom_feriado: 0, ativo: true },
    ]);

    const fee = (bairro: string) =>
      app.request('/api/massas/delivery-fee', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bairro }) });
    expect((await (await fee('centro')).json()).data).toMatchObject({ bairro: 'Centro', taxa: 6.5, entrega_disponivel: true });
    expect((await (await fee('Malhado')).json()).data).toMatchObject({ taxa: null, encontrado: false, entrega_disponivel: false });
  });

  it('só o admin cadastra; nome repetido dá 409', async () => {
    simularBanco();
    expect((await postAdmin('u-gestor', { action: 'bairros.create', nome: 'Banco da Vitória', taxa: 7 })).status).toBe(403);

    const criado = await postAdmin('u-admin', { action: 'bairros.create', nome: '  Banco   da Vitória ', taxa: '7,5'.replace(',', '.') });
    expect(criado.status).toBe(200);
    expect((await criado.json()).data).toMatchObject({ nome: 'Banco da Vitória', taxa: 7.5, ativo: true });

    const repetido = await postAdmin('u-admin', { action: 'bairros.create', nome: 'CENTRO', taxa: 5 });
    expect(repetido.status).toBe(409);
    expect((await postAdmin('u-admin', { action: 'bairros.create', nome: 'X', taxa: -1 })).status).toBe(400);
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
