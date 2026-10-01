import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Armchair, CheckCircle2, ChefHat, ExternalLink, Loader2, Printer, XCircle } from 'lucide-react';
import { FecharContaForm } from '@/components/admin/mesas/FecharContaForm';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { cancelarContaMesa, fecharContaMesaPagamentos, fetchMesaDetalhe, updateStatusPedidoMesa } from '@/features/integrations/marmitas-api';
import { STATUS_PEDIDO_MESA_LABELS, type PedidoMesaPainel, type StatusPedidoMesa } from '@/features/integrations/mesas-contracts';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { buildMesaUrl } from '@/lib/mesa';
import { formaPagamentoLabel, formatBRL } from '@/lib/pagamentos';
import { queryKeys } from '@/lib/query-keys';
import { downloadMesaPedidoThermalPdf } from '@/lib/thermal-label-pdf';
import { cn } from '@/lib/utils';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const STATUS_STYLE: Record<StatusPedidoMesa, string> = {
  novo: 'bg-primary/25 text-gold-ink',
  em_preparo: 'bg-orange-500/15 text-orange-800',
  entregue: 'bg-secondary/15 text-secondary',
  cancelado: 'bg-muted text-muted-foreground',
};

const PROXIMO: Partial<Record<StatusPedidoMesa, { status: StatusPedidoMesa; label: string }>> = {
  novo: { status: 'em_preparo', label: 'Preparar' },
  em_preparo: { status: 'entregue', label: 'Entregue' },
};

// Comanda da mesa (como plataforma-restaurantes/app/painel/mesas/[id]/page.tsx).
export default function MesaComandaPage() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const chave = ['admin', 'mesas', 'detalhe', id] as const;

  const detalhe = useQuery({
    queryKey: chave,
    queryFn: () => fetchMesaDetalhe(id),
    enabled: Number.isFinite(id),
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: false,
  });

  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: chave });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.mesas });
  };
  const onError = (titulo: string) => (error: unknown) => toast({ title: titulo, description: getApiErrorMessage(error), variant: 'destructive' });

  const status = useMutation({
    mutationFn: ({ pedidoId, novo }: { pedidoId: string; novo: StatusPedidoMesa }) => updateStatusPedidoMesa(pedidoId, novo),
    onSuccess: atualizar,
    onError: onError('Não foi possível mudar o status'),
  });

  const fechar = useMutation({
    mutationFn: (pagamentos: Parameters<typeof fecharContaMesaPagamentos>[1]) => fecharContaMesaPagamentos(detalhe.data!.conta!.id, pagamentos),
    onSuccess: (r) => {
      toast({ title: 'Conta fechada. Mesa liberada!', description: `Total ${formatBRL(r.valor_total)}` });
      atualizar();
    },
    onError: onError('Não foi possível fechar a conta'),
  });

  const cancelarConta = useMutation({
    mutationFn: () => cancelarContaMesa(detalhe.data!.conta!.id),
    onSuccess: () => {
      toast({ title: 'Conta cancelada' });
      atualizar();
    },
    onError: onError('Não foi possível cancelar'),
  });

  if (detalhe.isLoading) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-gold-ink" />;
  if (detalhe.error || !detalhe.data) return <p className="text-destructive">{getApiErrorMessage(detalhe.error, 'Mesa não encontrada.')}</p>;

  const { mesa, conta, fechadas } = detalhe.data;

  const imprimir = (pedido: PedidoMesaPainel) =>
    downloadMesaPedidoThermalPdf(
      { ...pedido, itens: pedido.itens.map((i) => ({ ...i, tamanho_nome: i.tamanho_nome ?? undefined, tamanho_serve: i.tamanho_serve ?? undefined })) },
      mesa.nome
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/admin/mesas" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Mesas
          </Link>
          <h1 className="flex items-center gap-2 font-display text-4xl font-bold text-secondary">
            <Armchair className="h-7 w-7 text-gold-ink" /> {mesa.nome}
          </h1>
          <p className="text-sm text-muted-foreground">{conta ? `Comanda aberta às ${hora(conta.aberta_em)}` : 'Mesa livre, sem comanda aberta.'}</p>
        </div>
        {mesa.ativa && (
          <Button variant="outline" asChild>
            <a href={buildMesaUrl(mesa.token)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Lançar pedido (cardápio da mesa)
            </a>
          </Button>
        )}
      </div>

      {conta && (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="flex flex-col gap-3">
            {conta.pedidos.length === 0 && <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>}
            {conta.pedidos.map((pedido) => {
              const proximo = PROXIMO[pedido.status];
              return (
                <article key={pedido.id} className={cn('rounded-2xl border bg-card p-4 text-sm shadow-soft', pedido.status === 'cancelado' && 'opacity-50')}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-display text-xl font-bold">
                      Nº {pedido.numero}{' '}
                      <span className="font-sans text-sm font-normal text-muted-foreground">
                        · {hora(pedido.created_at)}
                        {pedido.nome_cliente ? ` · ${pedido.nome_cliente}` : ''}
                      </span>
                    </p>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', STATUS_STYLE[pedido.status])}>{STATUS_PEDIDO_MESA_LABELS[pedido.status]}</span>
                  </div>
                  <ul className="space-y-1">
                    {pedido.itens.map((item, i) => (
                      <li key={`${item.produto_id}-${i}`} className="flex justify-between gap-3">
                        <span>
                          <strong>{item.quantidade}×</strong> {item.nome}
                          {item.tamanho_nome && <span className="block text-xs text-muted-foreground">{item.tamanho_nome}</span>}
                        </span>
                        <span className="tabular-nums">{formatBRL(item.preco * item.quantidade)}</span>
                      </li>
                    ))}
                  </ul>
                  {pedido.observacoes && (
                    <p className="mt-2 rounded-lg bg-muted/60 px-2 py-1">
                      <strong>Obs:</strong> {pedido.observacoes}
                    </p>
                  )}
                  {pedido.status !== 'cancelado' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {proximo && (
                        <Button size="sm" variant="secondary" className="text-primary" disabled={status.isPending} onClick={() => status.mutate({ pedidoId: pedido.id, novo: proximo.status })}>
                          {proximo.status === 'em_preparo' ? <ChefHat className="mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                          {proximo.label}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => imprimir(pedido)}>
                        <Printer className="mr-1 h-4 w-4" /> Imprimir
                      </Button>
                      {pedido.status !== 'entregue' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={status.isPending}
                          onClick={() => window.confirm(`Cancelar o pedido nº ${pedido.numero}?`) && status.mutate({ pedidoId: pedido.id, novo: 'cancelado' })}
                        >
                          <XCircle className="mr-1 h-4 w-4" /> Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <div className="flex flex-col gap-3">
            <FecharContaForm total={conta.total} pedidosEmAndamento={conta.em_andamento} enviando={fechar.isPending} onFechar={(p) => fechar.mutate(p)} />
            {permissions.role === 'admin' && (
              <button
                className="self-end text-xs text-muted-foreground hover:text-destructive"
                onClick={() => window.confirm(`Cancelar a conta inteira da ${mesa.nome}? Use só se foi aberta por engano.`) && cancelarConta.mutate()}
              >
                Cancelar conta aberta por engano
              </button>
            )}
          </div>
        </div>
      )}

      {fechadas.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 font-display text-2xl font-bold text-secondary">Últimas contas fechadas</h2>
          <ul className="divide-y text-sm">
            {fechadas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-32 text-muted-foreground">{dataHora(c.fechada_em)}</span>
                <span className="flex-1">{c.pagamentos.map((p) => `${formaPagamentoLabel(p.metodo)} ${formatBRL(p.valor)}`).join(' + ') || '—'}</span>
                <strong className="tabular-nums">{formatBRL(c.valor_total)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
