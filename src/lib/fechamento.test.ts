import { describe, expect, it } from 'vitest';
import { descricaoPagamento, erroDinheiro, faltaReceber, trocoDaLinha, trocoTotal } from './fechamento';

describe('dinheiro: valor recebido e troco', () => {
  it('troco = recebido - valor, e só existe em dinheiro', () => {
    expect(trocoDaLinha({ metodo: 'dinheiro', valor: 27.8, recebido: 50 })).toBe(22.2);
    expect(trocoDaLinha({ metodo: 'dinheiro', valor: 7.8, recebido: 10 })).toBe(2.2);
    // Sem informar quanto o cliente entregou, vale o valor exato.
    expect(trocoDaLinha({ metodo: 'dinheiro', valor: 27.8 })).toBe(0);
    expect(trocoDaLinha({ metodo: 'dinheiro', valor: 27.8, recebido: null })).toBe(0);
    // Outras formas nunca têm troco, mesmo que sobre um "recebido" esquecido na linha.
    expect(trocoDaLinha({ metodo: 'pix', valor: 27.8, recebido: 100 })).toBe(0);
  });

  it('soma o troco das linhas em centavos', () => {
    expect(
      trocoTotal([
        { metodo: 'dinheiro', valor: 7.8, recebido: 10 },
        { metodo: 'pix', valor: 20 },
        { metodo: 'dinheiro', valor: 0.1, recebido: 0.3 },
      ])
    ).toBe(2.4);
  });

  it('avisa quando o cliente entregou menos que o valor em dinheiro', () => {
    expect(faltaReceber({ metodo: 'dinheiro', valor: 27.8, recebido: 20 })).toBe(7.8);
    expect(erroDinheiro([{ metodo: 'dinheiro', valor: 27.8, recebido: 20 }])).toMatch(/menor que o valor a pagar.*7,80/);
    expect(erroDinheiro([{ metodo: 'dinheiro', valor: 27.8, recebido: 27.8 }, { metodo: 'pix', valor: 5 }])).toBeNull();
    expect(erroDinheiro([{ metodo: 'dinheiro', valor: 27.8 }])).toBeNull();
  });

  it('descreve a forma escolhida em texto', () => {
    const t = (linha: Parameters<typeof descricaoPagamento>[0]) => descricaoPagamento(linha).replace(/\s/g, ' ');
    expect(t({ metodo: 'pix', valor: 62 })).toBe('Pix: R$ 62,00');
    expect(t({ metodo: 'dinheiro', valor: 27.8, recebido: 50 })).toBe('Dinheiro: R$ 27,80 · recebido R$ 50,00 · troco R$ 22,20');
    expect(t({ metodo: 'dinheiro', valor: 27.8 })).toBe('Dinheiro: R$ 27,80 · valor exato, sem troco');
  });
});
