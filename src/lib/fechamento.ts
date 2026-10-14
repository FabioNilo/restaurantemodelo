import { FORMA_PAGAMENTO_CAIXA_LABELS, formatBRL, fromCents, toCents, type FormaPagamentoCaixa } from '@/lib/pagamentos';

// Estado do fechamento da conta no formulário: quanto foi informado, quanto
// falta ou passa, e o erro que bloqueia o botão (mesma regra de server/pagamentos.ts).
export function estadoFechamento(input: { total: number; valores: number[]; pedidosEmAndamento: number }) {
  const totalCents = toCents(input.total);
  const pagoCents = input.valores.reduce((soma, valor) => soma + toCents(valor || 0), 0);
  const faltaCents = Math.max(totalCents - pagoCents, 0);
  const sobraCents = Math.max(pagoCents - totalCents, 0);

  let erro: string | null = null;
  if (input.pedidosEmAndamento > 0) erro = 'Ainda há pedidos em andamento. Marque como entregues ou cancele antes de fechar.';
  else if (input.valores.some((valor) => !(valor > 0))) erro = 'Informe valores maiores que zero em todos os pagamentos.';
  else if (faltaCents > 0) erro = `Ainda faltam ${formatBRL(fromCents(faltaCents))}.`;
  else if (sobraCents > 0) erro = `Os pagamentos passam do total em ${formatBRL(fromCents(sobraCents))}.`;

  return { pago: fromCents(pagoCents), falta: fromCents(faltaCents), sobra: fromCents(sobraCents), erro };
}

// Divide o total em n partes em centavos (a última leva o resto), para "Dividir pagamento".
export function dividirIgual(total: number, partes: number) {
  const totalCents = toCents(total);
  const base = Math.floor(totalCents / partes);
  return Array.from({ length: partes }, (_, i) => fromCents(i === partes - 1 ? totalCents - base * (partes - 1) : base));
}

// --- Dinheiro: valor recebido e troco ---

export interface LinhaCaixa {
  metodo: FormaPagamentoCaixa;
  /** parte da conta quitada nesta forma (é o que conta como receita) */
  valor: number;
  /** só em dinheiro: o que o cliente entregou (vazio = valor exato) */
  recebido?: number | null;
}

const recebidoDe = (linha: LinhaCaixa) => (linha.recebido && linha.recebido > 0 ? linha.recebido : linha.valor);

// Troco devolvido nesta linha (só em dinheiro e só quando o recebido cobre o valor).
export function trocoDaLinha(linha: LinhaCaixa) {
  if (linha.metodo !== 'dinheiro') return 0;
  return fromCents(Math.max(toCents(recebidoDe(linha)) - toCents(linha.valor), 0));
}

export function trocoTotal(linhas: LinhaCaixa[]) {
  return fromCents(linhas.reduce((soma, linha) => soma + toCents(trocoDaLinha(linha)), 0));
}

// Quanto ainda falta o cliente entregar em dinheiro (recebido menor que o valor da linha).
export function faltaReceber(linha: LinhaCaixa) {
  if (linha.metodo !== 'dinheiro') return 0;
  return fromCents(Math.max(toCents(linha.valor) - toCents(recebidoDe(linha)), 0));
}

export function erroDinheiro(linhas: LinhaCaixa[]) {
  const linha = linhas.find((l) => faltaReceber(l) > 0);
  return linha ? `O valor recebido em dinheiro é menor que o valor a pagar (faltam ${formatBRL(faltaReceber(linha))}).` : null;
}

// Texto de confirmação da forma escolhida, mostrado ao atendente antes de fechar e no aviso depois.
export function descricaoPagamento(linha: LinhaCaixa) {
  const rotulo = FORMA_PAGAMENTO_CAIXA_LABELS[linha.metodo];

  if (linha.metodo !== 'dinheiro') return `${rotulo}: ${formatBRL(linha.valor)}`;

  const troco = trocoDaLinha(linha);
  return troco > 0
    ? `${rotulo}: ${formatBRL(linha.valor)} · recebido ${formatBRL(recebidoDe(linha))} · troco ${formatBRL(troco)}`
    : `${rotulo}: ${formatBRL(linha.valor)} · valor exato, sem troco`;
}
