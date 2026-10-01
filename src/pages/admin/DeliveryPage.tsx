import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, CheckCircle2, ChefHat, Clock, Loader2, MapPin, Phone, Printer, Send, Volume2, VolumeX, XCircle } from 'lucide-react';
import { DecimalInput } from '@/components/admin/DecimalInput';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { entregarDelivery, fetchDeliveryAdmin, updateStatusDelivery } from '@/features/integrations/marmitas-api';
import { STATUS_DELIVERY_LABELS, type PedidoDelivery, type StatusDelivery } from '@/features/integrations/painel-contracts';
import { useAlertaNovosPedidos } from '@/hooks/useAlertaNovosPedidos';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { FORMA_PAGAMENTO_LABELS, FORMAS_PAGAMENTO, formatBRL, fromCents, toCents, type FormaPagamento } from '@/lib/pagamentos';
import { downloadPedidoThermalLabelPdf } from '@/lib/thermal-label-pdf';
import { cn } from '@/lib/utils';

const CHAVE = ['admin', 'delivery'] as const;
const ABERTOS: StatusDelivery[] = ['recebido', 'em_preparo', 'saiu_entrega'];

const PROXIMO: Partial<Record<StatusDelivery, { status: 'em_preparo' | 'saiu_entrega'; label: string; icon: typeof ChefHat }>> = {
  recebido: { status: 'em_preparo', label: 'Preparar', icon: ChefHat },
  em_preparo: { status: 'saiu_entrega', label: 'Saiu para entrega', icon: Send },
};

const STATUS_STYLE: Record<StatusDelivery, string> = {
  recebido: 'bg-primary/25 text-gold-ink',
  em_preparo: 'bg-orange-500/15 text-orange-800',
  saiu_entrega: 'bg-sky-500/15 text-sky-800',
  entregue: 'bg-secondary/15 text-secondary',
  cancelado: 'bg-muted text-muted-foreground',
};

const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const telefoneBR = (t: string) => (t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t);

// Pedidos de delivery registrados pelo site: a equipe avança o status e, ao
// entregar, confirma a forma de pagamento (Pix/Débito/Crédito) — aí entra no caixa.
export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const [entregando, setEntregando] = useState<PedidoDelivery | null>(null);
  const [metodo, setMetodo] = useState<FormaPagamento>('pix');
  const [taxa, setTaxa] = useState(0);

  const pedidos = useQuery({ queryKey: CHAVE, queryFn: fetchDeliveryAdmin, refetchInterval: 15 * 1000, refetchIntervalInBackground: false });
  const lista = pedidos.data ?? [];
  const abertos = lista.filter((p) => ABERTOS.includes(p.status)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const finalizados = lista.filter((p) => !ABERTOS.includes(p.status));

  const { somAtivo, alternarSom } = useAlertaNovosPedidos(
    pedidos.data ? lista.filter((p) => p.status === 'recebido').map((p) => p.id) : undefined,
    (n) => (n === 1 ? 'Novo pedido de delivery' : `${n} novos pedidos de delivery`)
  );

  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVE });
  const onError = (titulo: string) => (error: unknown) => toast({ title: titulo, description: getApiErrorMessage(error), variant: 'destructive' });

  const status = useMutation({
    mutationFn: ({ id, novo }: { id: string; novo: 'em_preparo' | 'saiu_entrega' | 'cancelado' }) => updateStatusDelivery(id, novo),
    onSuccess: atualizar,
    onError: onError('Não foi possível mudar o status'),
  });

  const entregar = useMutation({
    mutationFn: () => entregarDelivery(entregando!.id, metodo, taxa),
    onSuccess: (r) => {
      toast({ title: 'Entregue e lançado no caixa', description: formatBRL(r.valor_total) });
      setEntregando(null);
      atualizar();
    },
    onError: onError('Não foi possível dar baixa'),
  });

  const abrirEntrega = (pedido: PedidoDelivery) => {
    setMetodo(pedido.forma_pagamento);
    setTaxa(pedido.taxa_entrega ?? 0);
    setEntregando(pedido);
  };

  const imprimir = (p: PedidoDelivery) =>
    downloadPedidoThermalLabelPdf(
      {
        id: String(p.numero),
        nome_cliente: p.nome,
        telefone_cliente: telefoneBR(p.telefone),
        endereco_cliente: p.endereco,
        bairro_cliente: p.bairro,
        complemento_cliente: p.complemento,
        observacoes_cliente: p.observacoes,
        forma_pagamento: p.forma_pagamento,
        tipo_entrega: 'delivery',
        subtotal: p.subtotal,
        taxa_entrega: p.taxa_entrega,
        valor_total: p.valor_total,
        created_at: p.created_at,
      },
      p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco, tamanho_nome: i.tamanho_nome ?? undefined, tamanho_serve: i.tamanho_serve ?? undefined }))
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary">Delivery</h1>
          <p className="text-sm text-muted-foreground">
            {abertos.length} em andamento. Pedidos feitos pelo site (também enviados no WhatsApp). Atualiza a cada 15 segundos.
          </p>
        </div>
        <Button variant={somAtivo ? 'secondary' : 'outline'} size="sm" onClick={alternarSom} className={cn(somAtivo && 'text-primary')}>
          {somAtivo ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
          {somAtivo ? 'Som ativado' : 'Ativar som'}
        </Button>
      </div>

      {pedidos.isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-ink" />}
      {pedidos.error && <p className="text-destructive">{getApiErrorMessage(pedidos.error)}</p>}

      {!pedidos.isLoading && abertos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          <Bike className="h-10 w-10 text-muted-foreground/50" /> Nenhum delivery em andamento.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {abertos.map((p) => {
          const proximo = PROXIMO[p.status];
          const espera = minutosDesde(p.created_at);
          return (
            <article key={p.id} className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-soft', p.status === 'recebido' && 'ring-2 ring-primary')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-2xl font-bold leading-none text-secondary">Nº {p.numero}</p>
                  <p className="mt-1 font-semibold">{p.nome}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', STATUS_STYLE[p.status])}>{STATUS_DELIVERY_LABELS[p.status]}</span>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', espera >= 45 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground')} title={`Pedido às ${hora(p.created_at)}`}>
                    <Clock className="h-3 w-3" /> {espera < 1 ? 'agora' : `${espera} min`}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <a href={`tel:${p.telefone}`} className="flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="h-3.5 w-3.5" /> {telefoneBR(p.telefone)}
                </a>
                <p className="flex gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {p.endereco} · <strong className="text-foreground">{p.bairro}</strong>
                    {p.complemento && <span className="block">{p.complemento}</span>}
                  </span>
                </p>
              </div>

              <ul className="space-y-0.5 rounded-xl bg-muted/60 px-3 py-2">
                {p.itens.map((item, i) => (
                  <li key={`${item.produto_id}-${i}`} className="flex justify-between gap-3">
                    <span>
                      <strong>{item.quantidade}×</strong> {item.nome}
                      {item.tamanho_nome && <span className="text-muted-foreground"> · {item.tamanho_nome}</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatBRL(item.preco * item.quantidade)}</span>
                  </li>
                ))}
              </ul>
              {p.observacoes && (
                <p>
                  <strong>Obs:</strong> {p.observacoes}
                </p>
              )}

              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">{FORMA_PAGAMENTO_LABELS[p.forma_pagamento]} · entrega a combinar</span>
                <strong className="font-display text-xl text-gold-ink">{formatBRL(p.subtotal)}</strong>
              </div>

              <div className="flex flex-wrap gap-2">
                {proximo && (
                  <Button size="sm" variant="secondary" className="text-primary" disabled={status.isPending} onClick={() => status.mutate({ id: p.id, novo: proximo.status })}>
                    <proximo.icon className="mr-1 h-4 w-4" /> {proximo.label}
                  </Button>
                )}
                <Button size="sm" variant="hero" onClick={() => abrirEntrega(p)}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar entregue
                </Button>
                <Button size="sm" variant="outline" onClick={() => imprimir(p)}>
                  <Printer className="mr-1 h-4 w-4" /> Imprimir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => window.confirm(`Cancelar o pedido nº ${p.numero}?`) && status.mutate({ id: p.id, novo: 'cancelado' })}
                >
                  <XCircle className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {finalizados.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 font-display text-2xl font-bold text-secondary">Finalizados hoje</h2>
          <ul className="divide-y text-sm">
            {finalizados.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-14 font-semibold">Nº {p.numero}</span>
                <span className="flex-1 truncate">{p.nome}</span>
                <span className="text-muted-foreground">{p.status === 'entregue' ? FORMA_PAGAMENTO_LABELS[p.forma_pagamento] : ''}</span>
                <span className="tabular-nums">{formatBRL(p.valor_total)}</span>
                <span className={cn('w-24 rounded-full px-2 py-0.5 text-center text-xs font-semibold', STATUS_STYLE[p.status])}>{STATUS_DELIVERY_LABELS[p.status]}</span>
                <span className="w-12 text-right text-muted-foreground">{hora(p.entregue_em ?? p.updated_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={entregando !== null} onOpenChange={(open) => !open && setEntregando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entregar pedido nº {entregando?.numero}</DialogTitle>
            <DialogDescription>Confirme como o cliente pagou. O valor entra no caixa de hoje.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pagamento">
              {FORMAS_PAGAMENTO.map((forma) => (
                <button
                  key={forma}
                  type="button"
                  role="radio"
                  aria-checked={metodo === forma}
                  onClick={() => setMetodo(forma)}
                  className={cn('rounded-xl border p-3 font-bold transition-colors', metodo === forma ? 'border-primary bg-primary/15' : 'border-border hover:border-primary/50')}
                >
                  {FORMA_PAGAMENTO_LABELS[forma]}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="taxa-entrega">Taxa de entrega</Label>
              <DecimalInput id="taxa-entrega" value={taxa} onValueChange={setTaxa} className="h-10 w-28 text-right" />
            </div>
            {entregando && (
              <div className="flex items-baseline justify-between rounded-xl bg-muted/60 p-3">
                <span className="text-muted-foreground">Itens {formatBRL(entregando.subtotal)} + entrega {formatBRL(taxa)}</span>
                <strong className="font-display text-2xl text-gold-ink">{formatBRL(fromCents(toCents(entregando.subtotal) + toCents(taxa)))}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="hero" disabled={entregar.isPending} onClick={() => entregar.mutate()}>
              {entregar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
