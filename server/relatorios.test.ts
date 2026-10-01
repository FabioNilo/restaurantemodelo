// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({ query: vi.fn(), getSql: vi.fn() }));

import { erroFechamento } from './pagamentos.js';
import { addDias, calcularMetricas, diasEntre, periodoSchema, productRanking, topMovers, variacao } from './relatorios.js';

const item = (produto_id: string, nome: string, preco: number, quantidade: number) => ({
  produto_id,
  nome,
  preco,
  quantidade,
  tamanho_codigo: null,
  tamanho_nome: null,
  tamanho_serve: null,
});

describe('fechamento da conta (sem dinheiro, sem troco)', () => {
  it('aceita pagamento único ou dividido que soma exatamente o total', () => {
    expect(erroFechamento({ total: 24.9, pagamentos: [{ valor: 24.9 }], pedidosEmAndamento: 0 })).toBeNull();
    expect(erroFechamento({ total: 24.9, pagamentos: [{ valor: 10.1 }, { valor: 14.8 }], pedidosEmAndamento: 0 })).toBeNull();
  });

  it('recusa falta, sobra, valor zerado e pedido em andamento', () => {
    expect(erroFechamento({ total: 24.9, pagamentos: [{ valor: 20 }], pedidosEmAndamento: 0 })).toBe('Ainda faltam R$ 4,90 para fechar a conta.');
    expect(erroFechamento({ total: 24.9, pagamentos: [{ valor: 25 }], pedidosEmAndamento: 0 })).toMatch(/passam do total em R\$ 0,10/);
    expect(erroFechamento({ total: 24.9, pagamentos: [{ valor: 24.9 }, { valor: 0 }], pedidosEmAndamento: 0 })).toMatch(/maiores que zero/);
    expect(erroFechamento({ total: 24.9, pagamentos: [{ valor: 24.9 }], pedidosEmAndamento: 1 })).toMatch(/em andamento/);
  });

  it('soma em centavos (0,1 + 0,2 fecha 0,30)', () => {
    expect(erroFechamento({ total: 0.3, pagamentos: [{ valor: 0.1 }, { valor: 0.2 }], pedidosEmAndamento: 0 })).toBeNull();
  });
});

describe('período do caixa', () => {
  it('conta os dias incluindo as pontas e valida a ordem e o limite de 1 ano', () => {
    expect(diasEntre('2026-09-01', '2026-09-30')).toBe(30);
    expect(periodoSchema.safeParse({ de: '2026-09-01', ate: '2026-09-30' }).success).toBe(true);
    expect(periodoSchema.safeParse({ de: '2026-09-30', ate: '2026-09-01' }).success).toBe(false);
    expect(periodoSchema.safeParse({ de: '2024-01-01', ate: '2026-09-30' }).success).toBe(false);
    expect(periodoSchema.safeParse({ de: '30/09/2026', ate: '2026-09-30' }).success).toBe(false);
  });

  it('soma dias atravessando o mês', () => {
    expect(addDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('métricas', () => {
  const vendas = [
    { canal: 'mesa' as const, dia: '2026-09-30', status: 'entregue', valor: 30, itens: [item('picole', 'Picolé', 10, 3)] },
    { canal: 'delivery' as const, dia: '2026-09-29', status: 'entregue', valor: 20, itens: [item('pudim', 'Pudim', 10, 2)] },
    { canal: 'mesa' as const, dia: '2026-09-29', status: 'cancelado', valor: 99, itens: [item('pudim', 'Pudim', 99, 1)] },
    // período anterior (7 dias antes)
    { canal: 'mesa' as const, dia: '2026-09-20', status: 'entregue', valor: 25, itens: [item('picole', 'Picolé', 12.5, 2)] },
  ];

  it('soma vendas, pedidos e ticket sem cancelados, com variação e por canal', () => {
    const m = calcularMetricas(vendas, '2026-09-30', 7);
    expect(m.periodo).toEqual({ inicio: '2026-09-24', fim: '2026-09-30', dias: 7 });
    expect(m.vendas).toEqual({ valor: 50, variacao: 100 });
    expect(m.pedidos).toEqual({ valor: 2, variacao: 100 });
    expect(m.ticket_medio.valor).toBe(25);
    expect(m.cancelados).toBe(1);
    expect(m.por_canal).toEqual({ mesa: 30, delivery: 20 });
    expect(m.por_dia).toHaveLength(7);
    expect(m.por_dia.at(-1)).toEqual({ dia: '2026-09-30', vendas: 30, pedidos: 1 });
    expect(m.top_produtos).toEqual([
      { nome: 'Picolé', quantidade: 3 },
      { nome: 'Pudim', quantidade: 2 },
    ]);
  });

  it('variação é nula sem base anterior', () => {
    expect(variacao(10, 0)).toBeNull();
    expect(variacao(15, 10)).toBe(50);
  });
});

describe('ranking de produtos (porta do plataforma-restaurantes)', () => {
  const sold = (productId: string, name: string, quantity: number, unitPrice: number) => ({ productId, name, quantity, unitPrice });

  it('ordena por faturamento, calcula participação, variação e inclui parados do cardápio', () => {
    const rows = productRanking(
      [sold('a', 'Cappuccino', 4, 11), sold('b', 'Pudim', 2, 8), sold('a', 'Cappuccino', 1, 11)],
      [sold('a', 'Cappuccino', 2, 11), sold('b', 'Pudim', 4, 8)],
      [
        { id: 'a', name: 'Cappuccino' },
        { id: 'b', name: 'Pudim' },
        { id: 'c', name: 'Bolo de aipim' },
      ]
    );

    expect(rows.map((r) => [r.name, r.quantity, r.revenue, r.share, r.revenueChange])).toEqual([
      ['Cappuccino', 5, 55, 77.5, 150],
      ['Pudim', 2, 16, 22.5, -50],
      ['Bolo de aipim', 0, 0, 0, null],
    ]);

    const movers = topMovers(rows);
    expect(movers.up.map((r) => r.name)).toEqual(['Cappuccino']);
    expect(movers.down.map((r) => r.name)).toEqual(['Pudim']);
  });
});
