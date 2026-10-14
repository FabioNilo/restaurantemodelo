import { z } from 'zod';

// Formas de pagamento do SITE (carrinho do delivery/retirada e baixa dos pedidos): sem dinheiro.
export const FORMAS_PAGAMENTO = ['pix', 'cartao_debito', 'cartao_credito'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const formaPagamentoSchema = z.enum(FORMAS_PAGAMENTO, {
  errorMap: () => ({ message: 'Escolha Pix, Débito ou Crédito.' }),
});

// Formas do CAIXA (fechar conta da mesa e venda no balcão): as do site + dinheiro.
export const FORMAS_PAGAMENTO_CAIXA = [...FORMAS_PAGAMENTO, 'dinheiro'] as const;
export type FormaPagamentoCaixa = (typeof FORMAS_PAGAMENTO_CAIXA)[number];

export const toCents = (value: number) => Math.round(Number(value) * 100);
export const fromCents = (cents: number) => cents / 100;

// Um pagamento do caixa. `valor` é a parte da conta quitada nesta forma (o que entra na receita).
// Em dinheiro, `valor_recebido` é o que o cliente entregou (se vier vazio, assume que foi o valor
// exato) e o troco é a diferença. Nas outras formas não existe recebido nem troco.
export const pagamentoSchema = z
  .object({
    metodo: z.enum(FORMAS_PAGAMENTO_CAIXA, { errorMap: () => ({ message: 'Escolha Pix, Débito, Crédito ou Dinheiro.' }) }),
    valor: z.coerce.number().positive('Informe valores de pagamento maiores que zero.').max(100000),
    valor_recebido: z.coerce.number().positive('Informe o valor recebido em dinheiro.').max(1000000).nullish(),
  })
  .superRefine((pagamento, ctx) => {
    if (pagamento.metodo === 'dinheiro' && pagamento.valor_recebido != null && toCents(pagamento.valor_recebido) < toCents(pagamento.valor)) {
      ctx.addIssue({
        code: 'custom',
        path: ['valor_recebido'],
        message: 'O valor recebido em dinheiro é menor que o valor a pagar em dinheiro.',
      });
    }
  })
  .transform((pagamento) => {
    if (pagamento.metodo !== 'dinheiro') {
      return { metodo: pagamento.metodo, valor: pagamento.valor, valor_recebido: null, troco: null };
    }

    const recebido = pagamento.valor_recebido ?? pagamento.valor;
    return {
      metodo: pagamento.metodo,
      valor: pagamento.valor,
      valor_recebido: fromCents(toCents(recebido)),
      troco: fromCents(toCents(recebido) - toCents(pagamento.valor)),
    };
  });

export type PagamentoCaixa = z.infer<typeof pagamentoSchema>;

// Troco total devolvido ao cliente nesta conta/venda.
export const trocoTotal = (pagamentos: Array<{ troco: number | null }>) =>
  fromCents(pagamentos.reduce((soma, p) => soma + toCents(p.troco ?? 0), 0));

const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

// Erro que impede fechar a conta, ou null. Regra pura (testada) usada pelo servidor.
export function erroFechamento(input: {
  total: number;
  pagamentos: Array<{ valor: number }>;
  pedidosEmAndamento: number;
}) {
  if (input.pedidosEmAndamento > 0) {
    return 'Ainda há pedidos desta mesa em andamento. Marque como entregues ou cancele antes de fechar.';
  }

  if (input.pagamentos.length === 0) {
    return 'Informe a forma de pagamento.';
  }

  if (input.pagamentos.some((pagamento) => !(pagamento.valor > 0))) {
    return 'Informe valores de pagamento maiores que zero.';
  }

  const totalCents = toCents(input.total);
  const pagoCents = input.pagamentos.reduce((soma, pagamento) => soma + toCents(pagamento.valor), 0);

  if (pagoCents < totalCents) {
    return `Ainda faltam ${brl(fromCents(totalCents - pagoCents))} para fechar a conta.`;
  }

  if (pagoCents > totalCents) {
    // O troco do dinheiro não conta aqui: cada linha leva só a parte da conta que quita.
    return `Os pagamentos passam do total em ${brl(fromCents(pagoCents - totalCents))}. Ajuste os valores (o troco do dinheiro vai no campo "valor recebido").`;
  }

  return null;
}
