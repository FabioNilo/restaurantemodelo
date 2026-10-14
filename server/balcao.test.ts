// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, getSql: vi.fn() }));

import { app } from './app.js';
import { signSession } from './auth.js';
import { pagamentoSchema, trocoTotal } from './pagamentos.js';

const PRODUTOS = [
  { id: 'cappuccino', nome: 'Cappuccino', preco: '11.00', estoque: 99, disponivel: true, tamanhos: [] },
  { id: 'bolo', nome: 'Bolo de cenoura', preco: '20.00', estoque: 99, disponivel: true, tamanhos: [] },
  { id: 'esgotado', nome: 'Esgotado', preco: '5.00', estoque: 0, disponivel: true, tamanhos: [] },
];
const USERS = [
  { id: 'u-admin', username: 'admin', name: null, role: 'admin', password_hash: 'x', token_version: 0 },
  { id: 'u-gestor', username: 'caixa', name: null, role: 'gestor', password_hash: 'x', token_version: 0 },
];
const VENDA_ID = '8a1b2c3d-1111-4c4c-9d9d-0000000000bb';

function simularBanco() {
  const chamadas: Array<{ sql: string; params: unknown[] }> = [];

  queryMock.mockImplementation(async (sql: string, params: unknown[] = []) => {
    chamadas.push({ sql, params });
    if (sql.includes('from usuarios_admin where id')) return USERS.filter((u) => u.id === params[0]);
    if (sql.includes('from produtos where id = any')) return PRODUTOS.filter((p) => (params[0] as string[]).includes(p.id));
    if (sql.includes('insert into vendas_balcao')) return [{ id: VENDA_ID, numero: '7', valor_total: String(params[3]), created_at: '2026-10-14T15:00:00Z' }];
    if (sql.includes("update vendas_balcao set status = 'cancelada'")) return params[0] === VENDA_ID ? [{ id: VENDA_ID }] : [];
    if (sql.includes('from vendas_balcao v')) {
      return [
        {
          id: VENDA_ID,
          numero: '7',
          nome: 'Dona Rita',
          observacoes: null,
          itens: [],
          valor_total: '42.00',
          status: 'paga',
          created_at: '2026-10-14T15:00:00Z',
          pagamentos: [{ metodo: 'dinheiro', valor: '42.00', valor_recebido: '50.00', troco: '8.00' }],
        },
      ];
    }
    return [];
  });

  return chamadas;
}

async function postAdmin(user: 'u-admin' | 'u-gestor' | null, body: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (user) {
    const { token } = await signSession({ id: user, role: user === 'u-admin' ? 'admin' : 'gestor', token_version: 0 });
    headers.Authorization = `Bearer ${token}`;
  }

  return app.request('/api/massas/admin/api', { method: 'POST', headers, body: JSON.stringify(body) });
}

const itens = [
  { produto_id: 'cappuccino', quantidade: 2, preco: 0.01 },
  { produto_id: 'bolo', quantidade: 1 },
];

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
  queryMock.mockReset();
});

describe('pagamentoSchema (caixa)', () => {
  it('dinheiro: recebido vira troco; sem recebido assume o valor exato', () => {
    expect(pagamentoSchema.parse({ metodo: 'dinheiro', valor: 42, valor_recebido: 50 })).toEqual({ metodo: 'dinheiro', valor: 42, valor_recebido: 50, troco: 8 });
    expect(pagamentoSchema.parse({ metodo: 'dinheiro', valor: 42 })).toEqual({ metodo: 'dinheiro', valor: 42, valor_recebido: 42, troco: 0 });
    expect(pagamentoSchema.parse({ metodo: 'dinheiro', valor: 7.8, valor_recebido: 10 }).troco).toBe(2.2);
  });

  it('outras formas nunca têm recebido nem troco', () => {
    expect(pagamentoSchema.parse({ metodo: 'pix', valor: 10, valor_recebido: 100 })).toEqual({ metodo: 'pix', valor: 10, valor_recebido: null, troco: null });
  });

  it('recusa recebido menor que o valor e forma desconhecida', () => {
    expect(pagamentoSchema.safeParse({ metodo: 'dinheiro', valor: 42, valor_recebido: 41.99 }).success).toBe(false);
    expect(pagamentoSchema.safeParse({ metodo: 'cheque', valor: 42 }).success).toBe(false);
  });

  it('soma o troco devolvido', () => {
    expect(trocoTotal([{ troco: 2.2 }, { troco: null }, { troco: 0.1 }])).toBe(2.3);
  });
});

describe('venda no balcão', () => {
  it('registra com preços do cardápio (ignora o do navegador) e devolve o troco', async () => {
    const chamadas = simularBanco();
    const response = await postAdmin('u-gestor', {
      action: 'balcao.registrar',
      itens,
      nome: '  Dona Rita ',
      pagamentos: [{ metodo: 'dinheiro', valor: 42, valor_recebido: 50 }],
    });
    const corpo = await response.json();

    expect(response.status).toBe(200);
    expect(corpo.data).toMatchObject({ numero: 7, valor_total: 42, troco: 8 });
    expect(corpo.data.itens.map((i: { preco: number }) => i.preco)).toEqual([11, 20]); // 2 × 11 + 20 = 42

    const insert = chamadas.find((c) => c.sql.includes('insert into vendas_balcao'))!;
    expect(insert.params[0]).toBe('Dona Rita');
    expect(insert.params[3]).toBe(42);
    expect(insert.params[4]).toBe('u-gestor');
    expect(JSON.parse(String(insert.params[5]))).toEqual([{ metodo: 'dinheiro', valor: 42, valor_recebido: 50, troco: 8 }]);
    // Venda e pagamentos num comando só: ou entram os dois ou nenhum.
    expect(insert.sql).toContain('insert into pagamentos');
    expect(insert.sql).toContain("'balcao'");
  });

  it('pagamento dividido (Pix + dinheiro com troco) que soma o total', async () => {
    const chamadas = simularBanco();
    const response = await postAdmin('u-admin', {
      action: 'balcao.registrar',
      itens,
      pagamentos: [
        { metodo: 'pix', valor: 30 },
        { metodo: 'dinheiro', valor: 12, valor_recebido: 20 },
      ],
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data.troco).toBe(8);
    const gravados = JSON.parse(String(chamadas.find((c) => c.sql.includes('insert into vendas_balcao'))!.params[5]));
    expect(gravados).toHaveLength(2);
  });

  it('recusa soma diferente do total, produto esgotado, venda vazia e sem pagamento — sem gravar', async () => {
    const chamadas = simularBanco();
    const gravou = () => chamadas.some((c) => c.sql.includes('insert into vendas_balcao'));

    const falta = await postAdmin('u-gestor', { action: 'balcao.registrar', itens, pagamentos: [{ metodo: 'pix', valor: 40 }] });
    expect(falta.status).toBe(400);
    expect((await falta.json()).error).toMatch(/Ainda faltam R\$ 2,00/);

    const esgotado = await postAdmin('u-gestor', { action: 'balcao.registrar', itens: [{ produto_id: 'esgotado', quantidade: 1 }], pagamentos: [{ metodo: 'pix', valor: 5 }] });
    expect(esgotado.status).toBe(400);

    expect((await postAdmin('u-gestor', { action: 'balcao.registrar', itens: [], pagamentos: [{ metodo: 'pix', valor: 1 }] })).status).toBe(400);
    expect((await postAdmin('u-gestor', { action: 'balcao.registrar', itens, pagamentos: [] })).status).toBe(400);
    expect(gravou()).toBe(false);
  });

  it('exige login', async () => {
    simularBanco();
    expect((await postAdmin(null, { action: 'balcao.registrar', itens, pagamentos: [{ metodo: 'pix', valor: 42 }] })).status).toBe(401);
  });

  it('lista as vendas de hoje com os pagamentos', async () => {
    simularBanco();
    const response = await postAdmin('u-gestor', { action: 'balcao.list' });
    const [venda] = (await response.json()).data;

    expect(venda).toMatchObject({ numero: 7, valor_total: 42, status: 'paga' });
    expect(venda.pagamentos).toEqual([{ metodo: 'dinheiro', valor: 42, valor_recebido: 50, troco: 8 }]);
  });

  it('só o admin cancela; o cancelamento só muda o status', async () => {
    const chamadas = simularBanco();
    expect((await postAdmin('u-gestor', { action: 'balcao.cancelar', id: VENDA_ID })).status).toBe(403);

    expect((await postAdmin('u-admin', { action: 'balcao.cancelar', id: VENDA_ID })).status).toBe(200);
    expect(chamadas.some((c) => /delete/i.test(c.sql))).toBe(false);

    expect((await postAdmin('u-admin', { action: 'balcao.cancelar', id: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });
});
