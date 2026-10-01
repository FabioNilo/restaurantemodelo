import { describe, expect, it } from 'vitest';
import type { MovimentoCaixa } from '@/features/integrations/painel-contracts';
import { dividirIgual, estadoFechamento } from './fechamento';
import { nomeArquivoFluxoCaixa, planilhasFluxoCaixa, resumirCaixa } from './fluxo-caixa';
import { periodoDoAtalho } from './periodos';

const movimentos: MovimentoCaixa[] = [
  { id: '1', data: '2026-09-29T19:10:00', canal: 'mesa', referencia: 'Mesa 2', cliente: null, metodo: 'pix', valor: 12, taxa_entrega: 0 },
  { id: '2', data: '2026-09-29T19:10:00', canal: 'mesa', referencia: 'Mesa 2', cliente: null, metodo: 'cartao_credito', valor: 12, taxa_entrega: 0 },
  { id: '3', data: '2026-09-30T12:05:00', canal: 'delivery', referencia: 'Delivery nº 1', cliente: 'Carla', metodo: 'cartao_debito', valor: 40.9, taxa_entrega: 6.5 },
  { id: '4', data: '2026-09-30T13:00:00', canal: 'mesa', referencia: 'Mesa 1', cliente: null, metodo: 'pix', valor: 0.1, taxa_entrega: 0 },
];

describe('resumo do caixa', () => {
  it('soma por forma, canal e dia em centavos', () => {
    const r = resumirCaixa(movimentos);
    expect(r.total).toBe(65);
    expect(r.taxaEntrega).toBe(6.5);
    expect(r.itens).toBe(58.5);
    expect(r.quantidade).toBe(4);
    expect(r.porForma).toEqual({ pix: 12.1, cartao_debito: 40.9, cartao_credito: 12 });
    expect(r.porCanal).toEqual({ mesa: 24.1, delivery: 40.9 });
    expect(r.porDia).toEqual([
      { dia: '2026-09-29', pix: 12, cartao_debito: 0, cartao_credito: 12, total: 24, taxaEntrega: 0 },
      { dia: '2026-09-30', pix: 0.1, cartao_debito: 40.9, cartao_credito: 0, total: 41, taxaEntrega: 6.5 },
    ]);
  });
});

describe('planilhas do Excel', () => {
  it('monta Resumo, Movimentações (com total) e Por dia', () => {
    const p = planilhasFluxoCaixa(movimentos, { de: '2026-09-29', ate: '2026-09-30' });

    expect(p.resumo).toContainEqual(['Período', '29/09/2026 a 30/09/2026']);
    expect(p.resumo).toContainEqual(['Total recebido', 65]);
    expect(p.resumo).toContainEqual(['Vendas (itens)', 58.5]);
    expect(p.resumo).toContainEqual(['Taxas de entrega', 6.5]);
    expect(p.resumo).toContainEqual(['Débito', 40.9]);
    expect(p.resumo).toContainEqual(['Delivery', 40.9]);

    expect(p.movimentacoes.cabecalho).toEqual(['Data', 'Hora', 'Canal', 'Referência', 'Cliente', 'Forma de pagamento', 'Itens', 'Taxa de entrega', 'Valor']);
    expect(p.movimentacoes.linhas[2]).toEqual(['30/09/2026', '12:05', 'Delivery', 'Delivery nº 1', 'Carla', 'Débito', 34.4, 6.5, 40.9]);
    expect(p.movimentacoes.total).toBe(65);
    expect(p.movimentacoes.taxaEntrega).toBe(6.5);

    expect(p.porDia.cabecalho).toEqual(['Data', 'Pix', 'Débito', 'Crédito', 'Total', 'Taxas de entrega (incluídas)']);
    expect(p.porDia.linhas[1]).toEqual(['30/09/2026', 0.1, 40.9, 0, 41, 6.5]);
  });

  it('nomeia o arquivo com o período', () => {
    expect(nomeArquivoFluxoCaixa({ de: '2026-09-01', ate: '2026-09-30' })).toBe('fluxo-de-caixa_2026-09-01_a_2026-09-30.xlsx');
  });
});

describe('atalhos de período', () => {
  it('calcula hoje, ontem, 7 dias, este mês e mês passado', () => {
    expect(periodoDoAtalho('hoje', '2026-09-30')).toEqual({ de: '2026-09-30', ate: '2026-09-30' });
    expect(periodoDoAtalho('ontem', '2026-10-01')).toEqual({ de: '2026-09-30', ate: '2026-09-30' });
    expect(periodoDoAtalho('7dias', '2026-09-30')).toEqual({ de: '2026-09-24', ate: '2026-09-30' });
    expect(periodoDoAtalho('mes', '2026-09-30')).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(periodoDoAtalho('mes_passado', '2026-03-15')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
  });
});

describe('fechamento no formulário', () => {
  it('mostra falta/sobra e libera só com a soma exata', () => {
    // formatBRL usa espaço não separável depois do "R$".
    expect(estadoFechamento({ total: 24, valores: [12, 10], pedidosEmAndamento: 0 })).toMatchObject({ falta: 2, erro: expect.stringMatching(/^Ainda faltam R\$\s2,00\.$/) });
    expect(estadoFechamento({ total: 24, valores: [12, 13], pedidosEmAndamento: 0 }).sobra).toBe(1);
    expect(estadoFechamento({ total: 24, valores: [12, 12], pedidosEmAndamento: 0 }).erro).toBeNull();
    expect(estadoFechamento({ total: 24, valores: [24], pedidosEmAndamento: 2 }).erro).toMatch(/em andamento/);
  });

  it('divide o total em partes iguais em centavos', () => {
    expect(dividirIgual(10, 3)).toEqual([3.33, 3.33, 3.34]);
    expect(dividirIgual(24.9, 2)).toEqual([12.45, 12.45]);
  });
});
