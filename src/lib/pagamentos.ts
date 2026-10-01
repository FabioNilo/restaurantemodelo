// Formas de pagamento aceitas em todo o site (espelho de server/pagamentos.ts).
export const FORMAS_PAGAMENTO = ['pix', 'cartao_debito', 'cartao_credito'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: 'Pix',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
};

export function formaPagamentoLabel(value: string | null | undefined) {
  return value && value in FORMA_PAGAMENTO_LABELS ? FORMA_PAGAMENTO_LABELS[value as FormaPagamento] : value === 'dividido' ? 'Dividido' : value ?? '—';
}

export const formatBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const toCents = (value: number) => Math.round(Number(value) * 100);
export const fromCents = (cents: number) => cents / 100;
