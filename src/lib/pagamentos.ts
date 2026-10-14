// Formas de pagamento do SITE: carrinho do delivery/retirada e baixa desses pedidos (espelho de server/pagamentos.ts).
export const FORMAS_PAGAMENTO = ['pix', 'cartao_debito', 'cartao_credito'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: 'Pix',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
};

// Formas do CAIXA (fechar conta da mesa e venda no balcão): as do site + dinheiro.
export const FORMAS_PAGAMENTO_CAIXA = [...FORMAS_PAGAMENTO, 'dinheiro'] as const;
export type FormaPagamentoCaixa = (typeof FORMAS_PAGAMENTO_CAIXA)[number];

export const FORMA_PAGAMENTO_CAIXA_LABELS: Record<FormaPagamentoCaixa, string> = {
  ...FORMA_PAGAMENTO_LABELS,
  dinheiro: 'Dinheiro',
};

export function formaPagamentoLabel(value: string | null | undefined) {
  return value && value in FORMA_PAGAMENTO_CAIXA_LABELS
    ? FORMA_PAGAMENTO_CAIXA_LABELS[value as FormaPagamentoCaixa]
    : value === 'dividido'
      ? 'Dividido'
      : value ?? '—';
}

export const formatBRL = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const toCents = (value: number) => Math.round(Number(value) * 100);
export const fromCents = (cents: number) => cents / 100;
