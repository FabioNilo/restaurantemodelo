import type { MovimentoCaixa } from '@/features/integrations/painel-contracts';
import { FORMA_PAGAMENTO_CAIXA_LABELS, FORMAS_PAGAMENTO_CAIXA, fromCents, toCents, type FormaPagamentoCaixa } from '@/lib/pagamentos';

// Fluxo de caixa (só entradas): resumo da tela do Caixa e linhas do Excel.

export interface ResumoCaixa {
  total: number;
  /** total sem as taxas de entrega */
  itens: number;
  /** taxas de entrega recebidas (já incluídas no total) */
  taxaEntrega: number;
  quantidade: number;
  porForma: Record<FormaPagamentoCaixa, number>;
  porCanal: { mesa: number; delivery: number; retirada: number; balcao: number };
  /** troco devolvido em dinheiro (não é receita: o caixa conta só o valor da venda) */
  troco: number;
  porDia: Array<{ dia: string } & Record<FormaPagamentoCaixa, number> & { total: number; taxaEntrega: number }>;
}

export function resumirCaixa(movimentos: MovimentoCaixa[]): ResumoCaixa {
  const porForma = Object.fromEntries(FORMAS_PAGAMENTO_CAIXA.map((f) => [f, 0])) as Record<FormaPagamentoCaixa, number>;
  const porCanal = { mesa: 0, delivery: 0, retirada: 0, balcao: 0 };
  let troco = 0;
  const dias = new Map<string, Record<FormaPagamentoCaixa, number>>();
  const taxasDia = new Map<string, number>();
  let total = 0;
  let taxaEntrega = 0;

  for (const mov of movimentos) {
    const cents = toCents(mov.valor);
    total += cents;
    porForma[mov.metodo] += cents;
    porCanal[mov.canal] += cents;
    troco += toCents(mov.troco ?? 0);
    const dia = mov.data.slice(0, 10);
    const linha = dias.get(dia) ?? (Object.fromEntries(FORMAS_PAGAMENTO_CAIXA.map((f) => [f, 0])) as Record<FormaPagamentoCaixa, number>);
    linha[mov.metodo] += cents;
    dias.set(dia, linha);
    const taxa = toCents(mov.taxa_entrega ?? 0);
    taxaEntrega += taxa;
    taxasDia.set(dia, (taxasDia.get(dia) ?? 0) + taxa);
  }

  return {
    total: fromCents(total),
    itens: fromCents(total - taxaEntrega),
    taxaEntrega: fromCents(taxaEntrega),
    quantidade: movimentos.length,
    porForma: Object.fromEntries(FORMAS_PAGAMENTO_CAIXA.map((f) => [f, fromCents(porForma[f])])) as Record<FormaPagamentoCaixa, number>,
    porCanal: {
      mesa: fromCents(porCanal.mesa),
      delivery: fromCents(porCanal.delivery),
      retirada: fromCents(porCanal.retirada),
      balcao: fromCents(porCanal.balcao),
    },
    troco: fromCents(troco),
    porDia: [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, valores]) => ({
        dia,
        ...(Object.fromEntries(FORMAS_PAGAMENTO_CAIXA.map((f) => [f, fromCents(valores[f])])) as Record<FormaPagamentoCaixa, number>),
        total: fromCents(FORMAS_PAGAMENTO_CAIXA.reduce((s, f) => s + valores[f], 0)),
        taxaEntrega: fromCents(taxasDia.get(dia) ?? 0),
      })),
  };
}

export const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

// Planilhas do arquivo .xlsx, já como linhas (testável sem o exceljs).
export function planilhasFluxoCaixa(movimentos: MovimentoCaixa[], periodo: { de: string; ate: string }) {
  const resumo = resumirCaixa(movimentos);

  return {
    resumo: [
      ['Fluxo de caixa — entradas'],
      ['Período', `${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`],
      ['Recebimentos', resumo.quantidade],
      ['Total recebido', resumo.total],
      ['Vendas (itens)', resumo.itens],
      ['Taxas de entrega', resumo.taxaEntrega],
      [],
      ['Por forma de pagamento', 'Valor'],
      ...FORMAS_PAGAMENTO_CAIXA.map((f) => [FORMA_PAGAMENTO_CAIXA_LABELS[f], resumo.porForma[f]]),
      [],
      ['Por canal', 'Valor'],
      ['Mesas', resumo.porCanal.mesa],
      ['Delivery', resumo.porCanal.delivery],
      ['Retirada no balcão', resumo.porCanal.retirada],
      ['Venda no balcão', resumo.porCanal.balcao],
    ] as Array<Array<string | number>>,
    movimentacoes: {
      cabecalho: ['Data', 'Hora', 'Canal', 'Referência', 'Cliente', 'Forma de pagamento', 'Itens', 'Taxa de entrega', 'Valor', 'Valor recebido (dinheiro)', 'Troco (dinheiro)'],
      linhas: movimentos.map((m) => [
        dataBR(m.data),
        m.data.slice(11, 16),
        m.canal === 'mesa' ? 'Mesa' : m.canal === 'retirada' ? 'Retirada' : m.canal === 'balcao' ? 'Balcão' : 'Delivery',
        m.referencia,
        m.cliente ?? '',
        FORMA_PAGAMENTO_CAIXA_LABELS[m.metodo],
        fromCents(toCents(m.valor) - toCents(m.taxa_entrega ?? 0)),
        m.taxa_entrega ?? 0,
        m.valor,
        m.valor_recebido ?? '',
        m.troco ?? '',
      ]),
      itens: resumo.itens,
      taxaEntrega: resumo.taxaEntrega,
      total: resumo.total,
      troco: resumo.troco,
    },
    porDia: {
      cabecalho: ['Data', ...FORMAS_PAGAMENTO_CAIXA.map((f) => FORMA_PAGAMENTO_CAIXA_LABELS[f]), 'Total', 'Taxas de entrega (incluídas)'],
      linhas: resumo.porDia.map((d) => [dataBR(d.dia), ...FORMAS_PAGAMENTO_CAIXA.map((f) => d[f]), d.total, d.taxaEntrega]),
    },
  };
}

export const nomeArquivoFluxoCaixa = (periodo: { de: string; ate: string }) => `fluxo-de-caixa_${periodo.de}_a_${periodo.ate}.xlsx`;
