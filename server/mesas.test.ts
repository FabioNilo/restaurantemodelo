// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, getSql: vi.fn() }));

import { app } from './app.js';
import { signSession } from './auth.js';
import { precificarItens } from './mesas.js';

const TOKEN = 'token-da-mesa-5-abc';
const MESA = { id: 5, numero: 5, nome: 'Mesa 5', token: TOKEN, ativa: true, created_at: '2026-09-30T12:00:00Z' };
const PRODUTOS = [
  { id: 'cappuccino', nome: 'Cappuccino', preco: '11.00', estoque: 99, disponivel: true, tamanhos: [] },
  {
    id: 'picole',
    nome: 'Picolé',
    preco: '8.00',
    estoque: 99,
    disponivel: true,
    tamanhos: [
      { codigo: 'opcao_morango', nome: 'Morango', serve: '', preco: 8 },
      { codigo: 'opcao_pistache', nome: 'Pistache', serve: '', preco: 13.9 },
    ],
  },
  { id: 'bolo-cenoura', nome: 'Cenoura', preco: '0', estoque: 0, disponivel: false, tamanhos: [] },
];

interface Cenario {
  mesa?: typeof MESA | null;
  recentes?: number;
}

// Simula o banco pelas consultas que server/mesas.ts faz, na ordem em que faz.
function simularBanco({ mesa = MESA, recentes = 0 }: Cenario = {}) {
  const inserts: unknown[][] = [];

  queryMock.mockImplementation(async (text: string, params: unknown[] = []) => {
    if (text.includes('from mesas where token')) return mesa ? [mesa] : [];
    if (text.includes('as recentes')) return [{ recentes }];
    if (text.includes('from produtos where id = any')) return PRODUTOS.filter((p) => (params[0] as string[]).includes(p.id));
    if (text.includes('insert into pedidos_mesa')) {
      inserts.push(params);
      return [{ numero: '12', status: 'pendente', valor_total: String(params[4]) }];
    }
    if (text.includes('from usuarios_admin where id')) {
      return [
        { id: 'u-admin', username: 'admin', name: null, role: 'admin', password_hash: 'x', token_version: 0 },
        { id: 'u-gestor', username: 'caixa', name: null, role: 'gestor', password_hash: 'x', token_version: 0 },
      ].filter((user) => user.id === params[0]);
    }
    return [];
  });

  return inserts;
}

const CONTATO = { nome_cliente: 'Maria', telefone_cliente: '(73) 99999-1234' };

function postPedido(body: Record<string, unknown>) {
  return app.request(`/api/mesas/${TOKEN}/pedidos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...CONTATO, ...body }),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
  queryMock.mockReset();
});

describe('precificarItens', () => {
  it('usa o preço da opção escolhida, ou o do produto quando não há opções', () => {
    const { itens, total } = precificarItens(
      [
        { produto_id: 'picole', tamanho_codigo: 'opcao_pistache', quantidade: 2 },
        { produto_id: 'cappuccino', quantidade: 1 },
      ],
      PRODUTOS
    );

    expect(itens.map((item) => [item.nome, item.tamanho_nome, item.preco])).toEqual([
      ['Picolé', 'Pistache', 13.9],
      ['Cappuccino', null, 11],
    ]);
    expect(total).toBe(38.8);
  });

  it('recusa produto indisponível e opção inexistente', () => {
    expect(() => precificarItens([{ produto_id: 'bolo-cenoura', quantidade: 1 }], PRODUTOS)).toThrow('não está disponível');
    expect(() => precificarItens([{ produto_id: 'picole', tamanho_codigo: 'opcao_x', quantidade: 1 }], PRODUTOS)).toThrow('não existe mais');
    expect(() => precificarItens([{ produto_id: 'nao-existe', quantidade: 1 }], PRODUTOS)).toThrow('não está disponível');
  });
});

describe('POST /api/mesas/:token/pedidos', () => {
  it('grava o pedido com preços do cardápio, ignorando preço enviado pelo navegador', async () => {
    const inserts = simularBanco();
    const response = await postPedido({ itens: [{ produto_id: 'picole', tamanho_codigo: 'opcao_pistache', quantidade: 2, preco: 0.01 }] });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: { numero: 12, status: 'pendente', valor_total: 27.8 } });
    expect(JSON.parse(String(inserts[0][3]))[0]).toMatchObject({ produto_id: 'picole', preco: 13.9, quantidade: 2 });
    expect(inserts[0][4]).toBe(27.8);
    // Nome e telefone (só dígitos) vão junto, para o atendente confirmar com a pessoa.
    expect(inserts[0][1]).toBe('Maria');
    expect(inserts[0][5]).toBe('73999991234');
  });

  it('exige nome e telefone válidos', async () => {
    simularBanco();
    const itens = [{ produto_id: 'cappuccino', quantidade: 1 }];
    expect((await postPedido({ itens, nome_cliente: '' })).status).toBe(400);
    expect((await postPedido({ itens, nome_cliente: 'A' })).status).toBe(400);
    expect((await postPedido({ itens, telefone_cliente: '' })).status).toBe(400);
    expect((await postPedido({ itens, telefone_cliente: '12345' })).status).toBe(400);
    expect((await postPedido({ itens, telefone_cliente: undefined as unknown as string })).status).toBe(400);
  });

  it('responde 404 para token inválido e 409 para mesa desativada', async () => {
    simularBanco({ mesa: null });
    expect((await postPedido({ itens: [{ produto_id: 'cappuccino', quantidade: 1 }] })).status).toBe(404);

    simularBanco({ mesa: { ...MESA, ativa: false } });
    expect((await postPedido({ itens: [{ produto_id: 'cappuccino', quantidade: 1 }] })).status).toBe(409);
  });

  it('bloqueia pedidos em excesso na mesma mesa (antispam)', async () => {
    simularBanco({ recentes: 6 });
    expect((await postPedido({ itens: [{ produto_id: 'cappuccino', quantidade: 1 }] })).status).toBe(429);
  });

  it('valida quantidade e pedido vazio', async () => {
    simularBanco();
    expect((await postPedido({ itens: [] })).status).toBe(400);
    expect((await postPedido({ itens: [{ produto_id: 'cappuccino', quantidade: 0 }] })).status).toBe(400);
    expect((await postPedido({ itens: [{ produto_id: 'cappuccino', quantidade: 51 }] })).status).toBe(400);
  });
});

describe('permissões do caixa', () => {
  async function postAdmin(userId: 'u-admin' | 'u-gestor', role: 'admin' | 'gestor', body: unknown) {
    const { token } = await signSession({ id: userId, role, token_version: 0 });
    return app.request('/api/massas/admin/api', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('gestor opera o caixa mas não cadastra mesas', async () => {
    simularBanco();
    expect((await postAdmin('u-gestor', 'gestor', { action: 'mesas.create', data: { numero: 7 } })).status).toBe(403);
    expect((await postAdmin('u-gestor', 'gestor', { action: 'mesas.regenerarToken', id: 1 })).status).toBe(403);
    expect((await postAdmin('u-gestor', 'gestor', { action: 'contas.cancelar', id: crypto.randomUUID() })).status).toBe(403);
    expect((await postAdmin('u-gestor', 'gestor', { action: 'mesas.painel' })).status).toBe(200);
  });

  it('só aceita Pix, Débito ou Crédito para fechar a conta', async () => {
    simularBanco();
    const response = await postAdmin('u-gestor', 'gestor', {
      action: 'contas.fechar',
      id: crypto.randomUUID(),
      pagamentos: [{ metodo: 'dinheiro', valor: 10 }],
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Escolha Pix, Débito ou Crédito.');
  });
});
