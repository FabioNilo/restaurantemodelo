import { formatBRL, fromCents, toCents } from '@/lib/pagamentos';

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
