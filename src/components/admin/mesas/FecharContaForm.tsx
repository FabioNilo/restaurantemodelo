import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { DecimalInput } from '@/components/admin/DecimalInput';
import { Button } from '@/components/ui/button';
import { dividirIgual, estadoFechamento } from '@/lib/fechamento';
import { FORMA_PAGAMENTO_LABELS, FORMAS_PAGAMENTO, formatBRL, type FormaPagamento } from '@/lib/pagamentos';

interface Linha {
  id: number;
  metodo: FormaPagamento;
  valor: number;
}

interface FecharContaFormProps {
  total: number;
  pedidosEmAndamento: number;
  enviando: boolean;
  onFechar: (pagamentos: Array<{ metodo: FormaPagamento; valor: number }>) => void;
}

// Fechamento da conta (como close-bill-form da referência), sem dinheiro/troco
// e sem taxa de serviço: escolhe Pix, Débito ou Crédito; pode dividir.
export function FecharContaForm({ total, pedidosEmAndamento, enviando, onFechar }: FecharContaFormProps) {
  const proximoId = useRef(1);
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 0, metodo: 'pix', valor: total }]);

  // Se o total mudar (entrou/cancelou pedido) e só há uma linha, acompanha o total.
  useEffect(() => {
    setLinhas((atuais) => (atuais.length === 1 ? [{ ...atuais[0], valor: total }] : atuais));
  }, [total]);

  const estado = estadoFechamento({ total, valores: linhas.map((l) => l.valor), pedidosEmAndamento });
  const atualizar = (id: number, patch: Partial<Linha>) => setLinhas((atuais) => atuais.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const dividir = () =>
    setLinhas((atuais) => {
      const metodos = [...atuais.map((l) => l.metodo), FORMAS_PAGAMENTO.find((f) => !atuais.some((l) => l.metodo === f)) ?? 'pix'];
      const valores = dividirIgual(total, metodos.length);
      return metodos.map((metodo, i) => ({ id: atuais[i]?.id ?? proximoId.current++, metodo, valor: valores[i] }));
    });

  return (
    <section className="flex h-fit flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-secondary">
        <Wallet className="h-5 w-5 text-gold-ink" /> Fechar conta
      </h2>

      <div className="flex items-baseline justify-between border-b pb-3">
        <span className="text-muted-foreground">Total da conta</span>
        <span className="font-display text-3xl font-bold text-gold-ink">{formatBRL(total)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Pagamento</p>
        {linhas.map((linha, i) => (
          <div key={linha.id} className="flex items-center gap-2">
            <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label={`Forma de pagamento ${i + 1}`}>
              {FORMAS_PAGAMENTO.map((forma) => (
                <button
                  key={forma}
                  type="button"
                  role="radio"
                  aria-checked={linha.metodo === forma}
                  onClick={() => atualizar(linha.id, { metodo: forma })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                    linha.metodo === forma ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {FORMA_PAGAMENTO_LABELS[forma]}
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
        ))}

        <div className="flex flex-wrap gap-3 text-sm">
          {linhas.length < 3 && (
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

      {estado.erro && <p className="text-sm text-muted-foreground">{estado.erro}</p>}

      <Button
        variant="hero"
        size="lg"
        className="rounded-full font-bold"
        disabled={Boolean(estado.erro) || enviando}
        onClick={() => onFechar(linhas.map(({ metodo, valor }) => ({ metodo, valor })))}
      >
        {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Fechar conta e liberar mesa
      </Button>
    </section>
  );
}
