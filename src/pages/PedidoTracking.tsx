import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock3, Loader2, MapPin, MessageCircle, PackageCheck, ReceiptText, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cancelPedidoN8n, fetchPedidoStatusN8n } from '@/features/integrations/marmitas-api';
import type { PedidoStatusItem, PedidoStatusResponse } from '@/features/integrations/n8n-contracts';

const STATUS_LABELS: Record<string, string> = {
  enviado_whatsapp: 'Pedido enviado',
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

function formatCurrency(value?: number | null) {
  return `R$ ${Number(value ?? 0).toFixed(2).replace('.', ',')}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRemainingMs(cancelUntil?: string | null) {
  if (!cancelUntil) return 0;
  return Math.max(0, new Date(cancelUntil).getTime() - Date.now());
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function isTerminalStatus(status: string) {
  return status === 'cancelado' || status === 'entregue';
}

function OrderItemLine({ item }: { item: PedidoStatusItem }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-black">{item.quantidade ?? 1}x {item.nome ?? 'Item do pedido'}</p>
          {(item.tamanho_nome || item.tamanho_serve) && (
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {[item.tamanho_nome, item.tamanho_serve].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>
        <p className="shrink-0 font-display text-lg font-black text-primary">
          {formatCurrency(Number(item.preco ?? 0) * Number(item.quantidade ?? 1))}
        </p>
      </div>
    </div>
  );
}

export default function PedidoTracking() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [remainingMs, setRemainingMs] = useState(0);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['pedido-status', pedidoId, token],
    queryFn: () => fetchPedidoStatusN8n(pedidoId!, token),
    enabled: Boolean(pedidoId && token),
    refetchInterval: (queryData) => {
      const pedido = queryData.state.data as PedidoStatusResponse | undefined;
      return pedido && !isTerminalStatus(pedido.status) ? 20000 : false;
    },
  });

  const pedido = query.data;
  const canCancel = useMemo(() => {
    if (!pedido) return false;
    return pedido.can_cancel && !isTerminalStatus(pedido.status) && remainingMs > 0;
  }, [pedido, remainingMs]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelPedidoN8n({ id: pedidoId!, token }),
    onSuccess: () => {
      toast({
        title: 'Pedido cancelado',
        description: 'O status foi atualizado para cancelado.',
      });
      void query.refetch();
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível cancelar',
        description: error instanceof Error ? error.message : 'Tente falar com a loja pelo WhatsApp.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    setWhatsappUrl(window.sessionStorage.getItem('pasta_last_whatsapp_url'));
  }, []);

  useEffect(() => {
    if (!pedido?.cancel_until) return undefined;

    const updateRemaining = () => setRemainingMs(getRemainingMs(pedido.cancel_until));
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [pedido?.cancel_until]);

  if (!pedidoId || !token) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 text-center shadow-card">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-black">Link de pedido inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">Confira se o link de acompanhamento foi copiado por completo.</p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/">Voltar ao cardápio</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 font-bold shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando pedido...
        </div>
      </main>
    );
  }

  if (query.isError || !pedido) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 text-center shadow-card">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-black">Pedido não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">O token pode ter expirado ou o pedido não está disponível.</p>
          <Button asChild className="mt-6 rounded-full">
            <Link to="/">Voltar ao cardápio</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Button asChild variant="ghost" className="mb-4 rounded-full">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cardápio
          </Link>
        </Button>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-card shadow-card">
          <div className="bg-gradient-to-br from-secondary via-[#4a0b10] to-[#2a1513] p-6 text-secondary-foreground sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Restaurante Modelo</p>
                <h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">Acompanhe seu pedido</h1>
                <p className="mt-2 text-sm text-secondary-foreground/80">Criado em {formatDateTime(pedido.created_at)}</p>
              </div>
              <Badge className="w-fit rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                {STATUS_LABELS[pedido.status] ?? pedido.status}
              </Badge>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2 font-display text-lg font-black">
                  <PackageCheck className="h-5 w-5 text-primary" />
                  Status
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {pedido.status === 'cancelado'
                    ? 'Pedido cancelado.'
                    : pedido.status === 'entregue'
                      ? 'Pedido entregue.'
                      : 'A loja atualizará o status conforme o preparo avançar.'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2 font-display text-lg font-black">
                  <Clock3 className="h-5 w-5 text-primary" />
                  Cancelamento
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {canCancel
                    ? `Você ainda pode cancelar por ${formatRemaining(remainingMs)}.`
                    : `Prazo encerrado em ${formatDateTime(pedido.cancel_until)}.`}
                </p>
                <Button
                  variant="destructive"
                  className="mt-4 w-full rounded-full font-black"
                  disabled={!canCancel || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cancelar pedido
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2 font-display text-lg font-black">
                <MapPin className="h-5 w-5 text-primary" />
                Entrega
              </div>
              <div className="mt-3 grid gap-1 text-sm">
                <p><span className="font-bold">Cliente:</span> {pedido.nome_cliente ?? '-'}</p>
                <p><span className="font-bold">Endereço:</span> {pedido.endereco_cliente ?? '-'}</p>
                <p><span className="font-bold">Bairro:</span> {pedido.bairro_cliente ?? '-'}</p>
                <p><span className="font-bold">Ponto de referência:</span> {pedido.complemento_cliente ?? '-'}</p>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 font-display text-lg font-black">
                <ReceiptText className="h-5 w-5 text-primary" />
                Itens do pedido
              </div>
              <div className="grid gap-3">
                {pedido.itens.map((item, index) => (
                  <OrderItemLine key={`${item.nome}-${index}`} item={item} />
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-end justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                <p>Pagamento: <span className="font-bold text-foreground">{pedido.forma_pagamento === 'cartao_credito' ? 'Cartão de crédito' : 'Pix'}</span></p>
                {pedido.observacoes_cliente ? <p>Observações: {pedido.observacoes_cliente}</p> : null}
              </div>
              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Total</p>
                <p className="font-display text-3xl font-black text-primary">{formatCurrency(pedido.valor_total)}</p>
              </div>
            </div>

            {whatsappUrl ? (
              <Button asChild variant="hero" size="lg" className="rounded-full font-black">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Enviar mensagem no WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
