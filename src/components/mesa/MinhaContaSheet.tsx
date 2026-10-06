import { useEffect } from 'react';
import { Loader2, ReceiptText } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { STATUS_PEDIDO_MESA_LABELS, type StatusPedidoMesa } from '@/features/integrations/mesas-contracts';
import { useMesaQuery } from '@/hooks/useMesaQuery';
import { cn } from '@/lib/utils';

interface MinhaContaSheetProps {
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_STYLE: Record<StatusPedidoMesa, string> = {
  pendente: 'bg-orange-500/15 text-orange-800',
  novo: 'bg-primary/20 text-gold-ink',
  em_preparo: 'bg-primary/20 text-gold-ink',
  entregue: 'bg-secondary/15 text-secondary',
  cancelado: 'bg-destructive/10 text-destructive line-through',
};

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Pedidos da conta aberta da mesa, com status. Atualiza sozinho só enquanto aberto.
export function MinhaContaSheet({ token, open, onOpenChange }: MinhaContaSheetProps) {
  const { data, isLoading, refetch } = useMesaQuery(token, open);
  const conta = data?.conta;

  // Ao abrir, busca na hora: o status pode ter mudado no caixa desde a última consulta.
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[1.75rem]">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-3xl text-secondary">
            <ReceiptText className="h-6 w-6 text-gold-ink" aria-hidden="true" />
            Minha conta
          </SheetTitle>
          <SheetDescription>{data?.mesa.nome} · O pagamento é feito no caixa ao final.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold-ink" />}

          {!isLoading && !conta && <p className="py-6 text-center text-muted-foreground">Nenhum pedido nesta mesa ainda.</p>}

          {conta?.pedidos.map((pedido) => (
            <div key={pedido.numero} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">
                  Pedido nº {pedido.numero}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>
                <span className={cn('rounded-full px-3 py-1 text-xs font-bold', STATUS_STYLE[pedido.status])}>
                  {STATUS_PEDIDO_MESA_LABELS[pedido.status]}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {pedido.itens.map((item, index) => (
                  <li key={`${item.produto_id}-${index}`} className="flex justify-between gap-3">
                    <span>
                      {item.quantidade}x {item.nome}
                      {item.tamanho_nome ? ` · ${item.tamanho_nome}` : ''}
                    </span>
                    <span className="shrink-0">{formatCurrency(item.preco * item.quantidade)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {conta && (
            <div className="flex items-center justify-between rounded-2xl bg-secondary p-4 text-secondary-foreground">
              <span className="font-bold">Total da mesa</span>
              <span className="font-display text-3xl font-bold text-primary">{formatCurrency(conta.total)}</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
