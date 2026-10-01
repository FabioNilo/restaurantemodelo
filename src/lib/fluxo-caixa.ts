import type { MovimentoCaixa } from '@/features/integrations/painel-contracts';
import { FORMA_PAGAMENTO_LABELS, FORMAS_PAGAMENTO, fromCents, toCents, type FormaPagamento } from '@/lib/pagamentos';

// Fluxo de caixa (só entradas): resumo da tela do Caixa e linhas do Excel.

export interface ResumoCaixa {
  total: number;
  quantidade: number;
  porForma: Record<FormaPagamento, number>;
  porCanal: { mesa: number; delivery: number };
  porDia: Array<{ dia: string } & Record<FormaPagamento, number> & { total: number }>;
}

export function resumirCaixa(movimentos: MovimentoCaixa[]): ResumoCaixa {
  const porForma = Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0])) as Record<FormaPagamento, number>;
  const porCanal = { mesa: 0, delivery: 0 };
  const dias = new Map<string, Record<FormaPagamento, number>>();
  let total = 0;

  for (const mov of movimentos) {
    const cents = toCents(mov.valor);
    total += cents;
    porForma[mov.metodo] += cents;
    porCanal[mov.canal] += cents;
    const dia = mov.data.slice(0, 10);
    const linha = dias.get(dia) ?? (Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0])) as Record<FormaPagamento, number>);
    linha[mov.metodo] += cents;
    dias.set(dia, linha);
  }

  return {
    total: fromCents(total),
    quantidade: movimentos.length,
    porForma: Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, fromCents(porForma[f])])) as Record<FormaPagamento, number>,
    porCanal: { mesa: fromCents(porCanal.mesa), delivery: fromCents(porCanal.delivery) },
    porDia: [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, valores]) => ({
        dia,
        ...(Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, fromCents(valores[f])])) as Record<FormaPagamento, number>),
        total: fromCents(FORMAS_PAGAMENTO.reduce((s, f) => s + valores[f], 0)),
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
      [],
      ['Por forma de pagamento', 'Valor'],
      ...FORMAS_PAGAMENTO.map((f) => [FORMA_PAGAMENTO_LABELS[f], resumo.porForma[f]]),
      [],
      ['Por canal', 'Valor'],
      ['Mesas', resumo.porCanal.mesa],
      ['Delivery', resumo.porCanal.delivery],
    ] as Array<Array<string | number>>,
    movimentacoes: {
      cabecalho: ['Data', 'Hora', 'Canal', 'Referência', 'Cliente', 'Forma de pagamento', 'Valor'],
      linhas: movimentos.map((m) => [
        dataBR(m.data),
        m.data.slice(11, 16),
        m.canal === 'mesa' ? 'Mesa' : 'Delivery',
        m.referencia,
        m.cliente ?? '',
        FORMA_PAGAMENTO_LABELS[m.metodo],
        m.valor,
      ]),
      total: resumo.total,
    },
    porDia: {
      cabecalho: ['Data', ...FORMAS_PAGAMENTO.map((f) => FORMA_PAGAMENTO_LABELS[f]), 'Total'],
      linhas: resumo.porDia.map((d) => [dataBR(d.dia), ...FORMAS_PAGAMENTO.map((f) => d[f]), d.total]),
    },
  };
}

export const nomeArquivoFluxoCaixa = (periodo: { de: string; ate: string }) => `fluxo-de-caixa_${periodo.de}_a_${periodo.ate}.xlsx`;
