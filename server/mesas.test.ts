// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, avisarMock } = vi.hoisted(() => ({ queryMock: vi.fn(), avisarMock: vi.fn() }));
vi.mock('./db.js', () => ({ query: queryMock, getSql: vi.fn() }));
vi.mock('./push.js', async (original) => ({ ...(await original<typeof import('./push.js')>()), avisarPedidoNovo: avisarMock }));

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
      return [{ numero: '12', status: String(params[6]), valor_total: String(params[4]) }];
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
  avisarMock.mockReset();
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
    expect(inserts[0][6]).toBe('pendente');
  });

  it('avisa a equipe por push quando o cliente pede pelo QR', async () => {
    simularBanco();
    await postPedido({ itens: [{ produto_id: 'cappuccino', quantidade: 1 }] });

    expect(avisarMock).toHaveBeenCalledTimes(1);
    expect(avisarMock).toHaveBeenCalledWith({
      titulo: 'Novo pedido de mesa',
      corpo: 'Mesa 5 aguarda confirmação · R$ 11,00',
      url: '/admin/mesas/5',
      tag: 'mesa-5',
    });
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

  it('pedido lançado pelo atendente entra confirmado, sem telefone e com nome opcional', async () => {
    const inserts = simularBanco();
    const itens = [{ produto_id: 'cappuccino', quantidade: 1 }];

    const response = await postAdmin('u-gestor', 'gestor', { action: 'pedidosMesa.lancar', token: TOKEN, itens });

    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe('novo');
    expect(inserts[0][1]).toBeNull();
    expect(inserts[0][5]).toBeNull();
    expect(inserts[0][6]).toBe('novo');
    // Quem lança é a própria equipe: não precisa de aviso.
    expect(avisarMock).not.toHaveBeenCalled();
  });

  it('sem login ninguém lança pedido confirmado', async () => {
    simularBanco();
    const response = await app.request('/api/massas/admin/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'pedidosMesa.lancar', token: TOKEN, itens: [{ produto_id: 'cappuccino', quantidade: 1 }] }),
    });
    expect(response.status).toBe(401);
  });

  it('só aceita Pix, Débito, Crédito ou Dinheiro para fechar a conta', async () => {
    simularBanco();
    const response = await postAdmin('u-gestor', 'gestor', {
      action: 'contas.fechar',
      id: crypto.randomUUID(),
      pagamentos: [{ metodo: 'cheque', valor: 10 }],
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Escolha Pix, Débito, Crédito ou Dinheiro.');
  });
});

describe('fechar conta com dinheiro (valor recebido e troco)', () => {
  const CONTA = '3f1c2b1a-1111-4c4c-9d9d-0000000000aa';

  // Conta aberta de R$ 27,80 (2 picolés de pistache), tudo entregue.
  function simularConta() {
    const chamadas: Array<{ text: string; params: unknown[] }> = [];

    queryMock.mockImplementation(async (text: string, params: unknown[] = []) => {
      chamadas.push({ text, params });
      if (text.includes('from usuarios_admin where id')) {
        return [{ id: 'u-gestor', username: 'caixa', name: null, role: 'gestor', password_hash: 'x', token_version: 0 }].filter((u) => u.id === params[0]);
      }
      if (text.includes("from contas_mesa where id = $1 and status = 'aberta'")) return [{ id: CONTA }];
      if (text.includes('select status, valor_total from pedidos_mesa')) return [{ status: 'entregue', valor_total: '27.80' }];
      if (text.includes('update contas_mesa c')) return [{ id: CONTA, valor_total: '27.80' }];
      return [];
    });

    return chamadas;
  }

  const fechar = async (pagamentos: unknown[]) => {
    const { token } = await signSession({ id: 'u-gestor', role: 'gestor', token_version: 0 });
    return app.request('/api/massas/admin/api', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'contas.fechar', id: CONTA, pagamentos }),
    });
  };

  const gravado = (chamadas: Array<{ text: string; params: unknown[] }>) =>
    JSON.parse(String(chamadas.find((c) => c.text.includes('update contas_mesa c'))!.params[4]));

  it('dinheiro com troco: grava o valor da conta, o recebido e o troco', async () => {
    const chamadas = simularConta();
    const response = await fechar([{ metodo: 'dinheiro', valor: 27.8, valor_recebido: 50 }]);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ valor_total: 27.8, troco: 22.2 });
    expect(gravado(chamadas)).toEqual([{ metodo: 'dinheiro', valor: 27.8, valor_recebido: 50, troco: 22.2 }]);
  });

  it('dinheiro sem informar o recebido assume o valor exato, sem troco', async () => {
    const chamadas = simularConta();
    const response = await fechar([{ metodo: 'dinheiro', valor: 27.8 }]);

    expect((await response.json()).data.troco).toBe(0);
    expect(gravado(chamadas)).toEqual([{ metodo: 'dinheiro', valor: 27.8, valor_recebido: 27.8, troco: 0 }]);
  });

  it('pagamento dividido: Pix + dinheiro com troco só na parte em dinheiro', async () => {
    const chamadas = simularConta();
    const response = await fechar([
      { metodo: 'pix', valor: 20, valor_recebido: 999 },
      { metodo: 'dinheiro', valor: 7.8, valor_recebido: 10 },
    ]);

    expect(response.status).toBe(200);
    expect((await response.json()).data.troco).toBe(2.2);
    // Pix nunca guarda recebido nem troco, mesmo que o navegador mande.
    expect(gravado(chamadas)).toEqual([
      { metodo: 'pix', valor: 20, valor_recebido: null, troco: null },
      { metodo: 'dinheiro', valor: 7.8, valor_recebido: 10, troco: 2.2 },
    ]);
  });

  it('recusa recebido menor que o valor em dinheiro e soma diferente do total', async () => {
    simularConta();
    const menor = await fechar([{ metodo: 'dinheiro', valor: 27.8, valor_recebido: 20 }]);
    expect(menor.status).toBe(400);
    expect((await menor.json()).error).toBe('O valor recebido em dinheiro é menor que o valor a pagar em dinheiro.');

    const falta = await fechar([{ metodo: 'dinheiro', valor: 20, valor_recebido: 20 }]);
    expect(falta.status).toBe(400);
    expect((await falta.json()).error).toMatch(/Ainda faltam R\$ 7,80/);

    // O troco não "paga" a conta: valor da linha passando do total continua sendo erro.
    const passa = await fechar([{ metodo: 'dinheiro', valor: 30, valor_recebido: 50 }]);
    expect(passa.status).toBe(400);
    expect((await passa.json()).error).toMatch(/passam do total em R\$ 2,20/);
  });
});
