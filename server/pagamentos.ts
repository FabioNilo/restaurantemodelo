import { z } from 'zod';

// Formas de pagamento aceitas em todo o site (delivery e mesas). Sem dinheiro,
// portanto sem troco: o pagamento precisa bater exatamente com o total.
export const FORMAS_PAGAMENTO = ['pix', 'cartao_debito', 'cartao_credito'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const formaPagamentoSchema = z.enum(FORMAS_PAGAMENTO, {
  errorMap: () => ({ message: 'Escolha Pix, Débito ou Crédito.' }),
});

export const pagamentoSchema = z.object({
  metodo: formaPagamentoSchema,
  valor: z.coerce.number().positive('Informe valores de pagamento maiores que zero.').max(100000),
});

export const toCents = (value: number) => Math.round(Number(value) * 100);
export const fromCents = (cents: number) => cents / 100;

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
    return `Os pagamentos passam do total em ${brl(fromCents(pagoCents - totalCents))}. Sem dinheiro não há troco: ajuste os valores.`;
  }

  return null;
}
