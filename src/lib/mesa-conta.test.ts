import { describe, expect, it } from 'vitest';
import type { ItemPedidoMesa } from '@/features/integrations/mesas-contracts';
import { agruparPorPessoa, resumirConta } from './mesa-conta';

const item = (produto_id: string, nome: string, preco: number, quantidade: number, tamanho_codigo: string | null = null): ItemPedidoMesa => ({
  produto_id,
  nome,
  tamanho_codigo,
  tamanho_nome: tamanho_codigo,
  tamanho_serve: null,
  preco,
  quantidade,
});

const pedidos = [
  { status: 'entregue' as const, nome_cliente: 'Ana', created_at: '2026-10-05T12:00:00Z', itens: [item('cafe', 'Café', 5, 2), item('bolo', 'Bolo', 10, 1)] },
  { status: 'novo' as const, nome_cliente: null, created_at: '2026-10-05T12:05:00Z', itens: [item('cafe', 'Café', 5, 1)] },
  { status: 'novo' as const, nome_cliente: ' ana ', created_at: '2026-10-05T12:10:00Z', itens: [item('cafe', 'Café', 5, 1)] },
  { status: 'cancelado' as const, nome_cliente: 'Beto', created_at: '2026-10-05T12:15:00Z', itens: [item('bolo', 'Bolo', 10, 9)] },
];

describe('resumirConta', () => {
  it('soma itens iguais e ignora cancelados', () => {
    const resumo = resumirConta(pedidos);
    expect(resumo.itens).toEqual([
      { nome: 'Café', opcao: null, preco: 5, quantidade: 4, total: 20 },
      { nome: 'Bolo', opcao: null, preco: 10, quantidade: 1, total: 10 },
    ]);
    expect(resumo.total).toBe(30);
  });

  it('separa opções diferentes do mesmo produto', () => {
    const resumo = resumirConta([
      { status: 'novo', nome_cliente: null, created_at: '', itens: [item('suco', 'Suco', 6, 1, 'p'), item('suco', 'Suco', 9, 1, 'g')] },
    ]);
    expect(resumo.itens).toHaveLength(2);
  });
});

describe('agruparPorPessoa', () => {
  const grupos = agruparPorPessoa(pedidos);

  it('une nomes iguais (sem diferenciar caixa/espaços) e deixa "Sem nome" por último', () => {
    expect(grupos.map((g) => g.nome)).toEqual(['Ana', 'Sem nome']);
    expect(grupos[0]).toMatchObject({ pedidos: 2, total: 25 });
    expect(grupos[1]).toMatchObject({ pedidos: 1, total: 5 });
  });

  it('o total das pessoas bate com o total da mesa e cancelados ficam de fora', () => {
    expect(grupos.reduce((soma, g) => soma + g.total, 0)).toBe(resumirConta(pedidos).total);
    expect(grupos.some((g) => g.nome === 'Beto')).toBe(false);
  });
});
