import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, HandCoins, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { DecimalInput } from '@/components/admin/DecimalInput';
import { Button } from '@/components/ui/button';
import type { PagamentoCaixaEnvio } from '@/features/integrations/marmitas-api';
import { descricaoPagamento, dividirIgual, erroDinheiro, estadoFechamento, faltaReceber, trocoDaLinha, trocoTotal, type LinhaCaixa } from '@/lib/fechamento';
import { FORMA_PAGAMENTO_CAIXA_LABELS, FORMAS_PAGAMENTO_CAIXA, formatBRL, type FormaPagamentoCaixa } from '@/lib/pagamentos';
import { cn } from '@/lib/utils';

interface Linha extends LinhaCaixa {
  id: number;
}

interface FecharContaFormProps {
  total: number;
  pedidosEmAndamento?: number;
  enviando: boolean;
  onFechar: (pagamentos: PagamentoCaixaEnvio[]) => void;
  /** título do quadro (padrão: Fechar conta) */
  titulo?: string;
  /** texto do botão final (padrão: Fechar conta e liberar mesa) */
  rotuloBotao?: string;
  /** mensagem que bloqueia o botão por motivo de fora (ex.: venda sem itens) */
  bloqueio?: string | null;
}

// Cédulas sugeridas como atalho para "o cliente entregou".
const CEDULAS = [10, 20, 50, 100, 200];

// Pagamento do caixa (fechar conta da mesa e venda no balcão): Pix, Débito, Crédito ou
// Dinheiro, podendo dividir. Em dinheiro informa quanto o cliente entregou e mostra o troco;
// sempre mostra, em texto, a forma escolhida antes de confirmar. Sem taxa de serviço.
export function FecharContaForm({
  total,
  pedidosEmAndamento = 0,
  enviando,
  onFechar,
  titulo = 'Fechar conta',
  rotuloBotao = 'Fechar conta e liberar mesa',
  bloqueio = null,
}: FecharContaFormProps) {
  const proximoId = useRef(1);
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 0, metodo: 'pix', valor: total, recebido: null }]);

  // Se o total mudar (entrou/cancelou pedido) e só há uma linha, acompanha o total.
  useEffect(() => {
    setLinhas((atuais) => (atuais.length === 1 ? [{ ...atuais[0], valor: total }] : atuais));
  }, [total]);

  const estado = estadoFechamento({ total, valores: linhas.map((l) => l.valor), pedidosEmAndamento });
  const erro = bloqueio ?? estado.erro ?? erroDinheiro(linhas);
  const troco = trocoTotal(linhas);
  const atualizar = (id: number, patch: Partial<Linha>) => setLinhas((atuais) => atuais.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const dividir = () =>
    setLinhas((atuais) => {
      const metodos: FormaPagamentoCaixa[] = [
        ...atuais.map((l) => l.metodo),
        FORMAS_PAGAMENTO_CAIXA.find((f) => !atuais.some((l) => l.metodo === f)) ?? 'pix',
      ];
      const valores = dividirIgual(total, metodos.length);
      return metodos.map((metodo, i) => ({ id: atuais[i]?.id ?? proximoId.current++, metodo, valor: valores[i], recebido: atuais[i]?.recebido ?? null }));
    });

  const fechar = () =>
    onFechar(
      linhas.map((l) =>
        l.metodo === 'dinheiro'
          ? { metodo: l.metodo, valor: l.valor, valor_recebido: l.recebido && l.recebido > 0 ? l.recebido : l.valor }
          : { metodo: l.metodo, valor: l.valor }
      )
    );

  return (
    <section className="flex h-fit flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-secondary">
        <Wallet className="h-5 w-5 text-gold-ink" /> {titulo}
      </h2>

      <div className="flex items-baseline justify-between border-b pb-3">
        <span className="text-muted-foreground">Total</span>
        <span className="font-display text-3xl font-bold text-gold-ink">{formatBRL(total)}</span>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Pagamento</p>
        {linhas.map((linha, i) => {
          const dinheiro = linha.metodo === 'dinheiro';
          const falta = faltaReceber(linha);

          return (
            <div key={linha.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label={`Forma de pagamento ${i + 1}`}>
                  {FORMAS_PAGAMENTO_CAIXA.map((forma) => (
                    <button
                      key={forma}
                      type="button"
                      role="radio"
                      aria-checked={linha.metodo === forma}
                      onClick={() => atualizar(linha.id, { metodo: forma })}
                      className={`rounded-lg px-1 py-1.5 text-sm font-semibold transition ${
                        linha.metodo === forma ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {FORMA_PAGAMENTO_CAIXA_LABELS[forma]}
                    </button>
                  ))}
                </div>
                {linhas.length > 1 && (
                  <>
                    <DecimalInput
                      value={linha.valor}
                      onValueChange={(valor) => atualizar(linha.id, { valor })}
                      aria-label={`Valor do pagamento ${i + 1}`}
                      className="h-10 w-28 text-right tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setLinhas((atuais) => atuais.filter((l) => l.id !== linha.id))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remover pagamento ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {dinheiro && (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`recebido-${linha.id}`} className="flex items-center gap-2 text-sm font-medium">
                      <HandCoins className="h-4 w-4 text-gold-ink" /> Cliente entregou
                    </label>
                    <DecimalInput
                      id={`recebido-${linha.id}`}
                      value={linha.recebido ?? linha.valor}
                      onValueChange={(recebido) => atualizar(linha.id, { recebido: recebido > 0 ? recebido : null })}
                      aria-label={`Valor recebido em dinheiro ${i + 1}`}
                      // Já vem com o valor exato: ao tocar, seleciona tudo para digitar o valor entregue por cima.
                      onFocus={(event) => event.target.select()}
                      className="h-10 w-32 text-right tabular-nums"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => atualizar(linha.id, { recebido: null })}
                      className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold hover:border-primary"
                    >
                      Valor exato
                    </button>
                    {CEDULAS.filter((c) => c >= linha.valor).slice(0, 3).map((cedula) => (
                      <button
                        key={cedula}
                        type="button"
                        onClick={() => atualizar(linha.id, { recebido: cedula })}
                        className="rounded-full border bg-background px-2.5 py-1 text-xs font-semibold hover:border-primary"
                      >
                        {formatBRL(cedula)}
                      </button>
                    ))}
                  </div>
                  <p className={cn('text-sm font-semibold', falta > 0 ? 'text-destructive' : trocoDaLinha(linha) > 0 ? 'text-secondary' : 'text-muted-foreground')}>
                    {falta > 0
                      ? `Faltam ${formatBRL(falta)} para cobrir o valor em dinheiro`
                      : trocoDaLinha(linha) > 0
                        ? `Troco: ${formatBRL(trocoDaLinha(linha))}`
                        : 'Valor exato, sem troco'}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-3 text-sm">
          {linhas.length < 4 && (
            <button type="button" onClick={dividir} className="inline-flex items-center gap-1 font-medium text-gold-ink hover:underline">
              <Plus className="h-4 w-4" /> Dividir pagamento
            </button>
          )}
          {linhas.length > 1 && estado.falta > 0 && (
            <button
              type="button"
              onClick={() => {
                const ultima = linhas[linhas.length - 1];
                atualizar(ultima.id, { valor: Math.round((ultima.valor + estado.falta) * 100) / 100 });
              }}
              className="ml-auto font-medium text-muted-foreground hover:text-foreground"
            >
              Completar {formatBRL(estado.falta)}
            </button>
          )}
        </div>
      </div>

      {linhas.length > 1 && (
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Informado</span>
            <span className="tabular-nums">{formatBRL(estado.pago)}</span>
          </div>
          {estado.falta > 0 && (
            <div className="flex justify-between font-semibold text-destructive">
              <span>Falta</span>
              <span className="tabular-nums">{formatBRL(estado.falta)}</span>
            </div>
          )}
          {estado.sobra > 0 && (
            <div className="flex justify-between font-semibold text-destructive">
              <span>Passou do total</span>
              <span className="tabular-nums">{formatBRL(estado.sobra)}</span>
            </div>
          )}
        </div>
      )}

      {/* Confirmação, em texto, da forma escolhida (e do troco a devolver) antes de fechar. */}
      <div className="rounded-xl border bg-background p-3 text-sm" aria-live="polite" data-testid="resumo-pagamento">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forma de pagamento escolhida</p>
        <ul className="space-y-0.5">
          {linhas.map((linha) => (
            <li key={linha.id} className="flex items-start gap-1.5 font-medium">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <span>{descricaoPagamento(linha)}</span>
            </li>
          ))}
        </ul>
        {troco > 0 && (
          <p className="mt-2 flex items-baseline justify-between rounded-lg bg-secondary px-3 py-2 text-primary">
            <span className="text-sm font-semibold">Troco a devolver</span>
            <strong className="font-display text-2xl">{formatBRL(troco)}</strong>
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-muted-foreground">{erro}</p>}

      <Button variant="hero" size="lg" className="rounded-full font-bold" disabled={Boolean(erro) || enviando} onClick={fechar}>
        {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {rotuloBotao}
      </Button>
    </section>
  );
}
