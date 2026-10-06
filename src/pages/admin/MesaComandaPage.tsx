import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Armchair, CheckCircle2, ChefHat, ChevronDown, Loader2, Plus, Printer, Wallet, XCircle } from 'lucide-react';
import { FecharContaForm } from '@/components/admin/mesas/FecharContaForm';
import { TelaCheia, TelaCheiaFrame } from '@/components/admin/TelaCheia';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { cancelarContaMesa, fecharContaMesaPagamentos, fetchMesaDetalhe, updateStatusPedidoMesa } from '@/features/integrations/marmitas-api';
import { STATUS_PEDIDO_MESA_LABELS, type PedidoMesaPainel, type StatusPedidoMesa } from '@/features/integrations/mesas-contracts';
import { toast } from '@/hooks/use-toast';
import { useConfirmar } from '@/hooks/useConfirmar';
import { getApiErrorMessage } from '@/lib/api';
import { buildMesaUrl } from '@/lib/mesa';
import { formatBRL } from '@/lib/pagamentos';
import { queryKeys } from '@/lib/query-keys';
import { resumirConta, SEM_NOME } from '@/lib/mesa-conta';
import { downloadMesaContaThermalPdf, downloadMesaPedidoThermalPdf, type ModoContaMesa } from '@/lib/thermal-label-pdf';
import { cn } from '@/lib/utils';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const STATUS_STYLE: Record<StatusPedidoMesa, string> = {
  pendente: 'bg-orange-500/15 text-orange-800',
  novo: 'bg-primary/25 text-gold-ink',
  em_preparo: 'bg-primary/25 text-gold-ink',
  entregue: 'bg-secondary/15 text-secondary',
  cancelado: 'bg-muted text-muted-foreground',
};

// Sem cozinha: o atendente confirma o pedido e depois marca como entregue.
const PROXIMO: Partial<Record<StatusPedidoMesa, { status: StatusPedidoMesa; label: string }>> = {
  pendente: { status: 'novo', label: 'Confirmar pedido' },
  novo: { status: 'entregue', label: 'Entregue' },
  em_preparo: { status: 'entregue', label: 'Entregue' },
};

// Comanda da mesa (como plataforma-restaurantes/app/painel/mesas/[id]/page.tsx).
export default function MesaComandaPage() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const chave = ['admin', 'mesas', 'detalhe', id] as const;
  const [visao, setVisao] = useState<'resumo' | 'detalhado'>('detalhado');
  const [lancando, setLancando] = useState(false);
  const [fechandoMobile, setFechandoMobile] = useState(false);
  const { confirmar, dialogo } = useConfirmar();

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
      setFechandoMobile(false);
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

  const { mesa, conta } = detalhe.data;

  // Cancelados somem da comanda. Pendentes aparecem (precisam de confirmação), mas só entram
  // no resumo e na conta impressa depois de confirmados.
  const pedidosAtivos = conta?.pedidos.filter((pedido) => pedido.status !== 'cancelado') ?? [];
  const pedidosNaConta = pedidosAtivos.filter((pedido) => pedido.status !== 'pendente');
  const pendentes = pedidosAtivos.length - pedidosNaConta.length;
  const resumo = resumirConta(pedidosNaConta);
  const imprimirConta = (modo: ModoContaMesa) => downloadMesaContaThermalPdf(pedidosNaConta, mesa.nome, modo);

  const pedirCancelarPedido = async (pedido: PedidoMesaPainel) => {
    if (await confirmar({ titulo: `Cancelar o pedido nº ${pedido.numero}?`, descricao: 'Ele sai da conta da mesa.', confirmar: 'Cancelar pedido', perigo: true })) {
      status.mutate({ pedidoId: pedido.id, novo: 'cancelado' });
    }
  };

  const pedirCancelarConta = async () => {
    if (
      await confirmar({
        titulo: `Cancelar a conta inteira da ${mesa.nome}?`,
        descricao: 'Use só se a conta foi aberta por engano. Todos os pedidos dela saem.',
        confirmar: 'Cancelar conta',
        perigo: true,
      })
    ) {
      setFechandoMobile(false);
      cancelarConta.mutate();
    }
  };

  // Lançar pedido abre o cardápio da mesa por cima do painel (sem aba nova); ao voltar, atualiza a comanda.
  const alternarLancamento = (aberto: boolean) => {
    setLancando(aberto);
    if (!aberto) atualizar();
  };

  const fecharConta = conta && (
    <>
      <FecharContaForm total={conta.total} pedidosEmAndamento={conta.em_andamento} enviando={fechar.isPending} onFechar={(p) => fechar.mutate(p)} />
      {permissions.role === 'admin' && (
        <button className="self-end py-2 text-xs text-muted-foreground hover:text-destructive" onClick={pedirCancelarConta}>
          Cancelar conta aberta por engano
        </button>
      )}
    </>
  );

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
          <Button variant="outline" onClick={() => setLancando(true)} className="h-11 w-full sm:h-10 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Lançar pedido
          </Button>
        )}
      </div>

      {conta && (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="group" aria-label="Visualização do pedido" className="grid w-full grid-cols-2 rounded-full border bg-card p-1 sm:inline-grid sm:w-auto">
                {(['resumo', 'detalhado'] as const).map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    aria-pressed={visao === opcao}
                    onClick={() => setVisao(opcao)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                      visao === opcao ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opcao === 'resumo' ? 'Resumo do pedido' : 'Pedido detalhado'}
                  </button>
                ))}
              </div>
              {pedidosNaConta.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 w-full sm:h-9 sm:w-auto">
                      <Printer className="mr-1 h-4 w-4" /> Imprimir conta <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="py-3" onSelect={() => imprimirConta('resumo')}>
                      Resumo da mesa
                    </DropdownMenuItem>
                    <DropdownMenuItem className="py-3" onSelect={() => imprimirConta('pessoas')}>
                      Detalhada por pessoa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {pedidosAtivos.length === 0 && <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Nenhum pedido ainda.</p>}

            {pendentes > 0 && (
              <p role="alert" className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm font-semibold text-orange-800">
                {pendentes} {pendentes === 1 ? 'pedido aguarda' : 'pedidos aguardam'} confirmação. Ligue para quem pediu ou confira na mesa e confirme.
              </p>
            )}

            {visao === 'resumo' && pedidosNaConta.length > 0 && (
              <article className="rounded-2xl border bg-card p-4 text-sm shadow-soft">
                <ul className="space-y-1">
                  {resumo.itens.map((item) => (
                    <li key={`${item.nome}-${item.opcao}-${item.preco}`} className="flex justify-between gap-3">
                      <span>
                        <strong>{item.quantidade}×</strong> {item.nome}
                        {item.opcao && <span className="block text-xs text-muted-foreground">{item.opcao}</span>}
                      </span>
                      <span className="tabular-nums">{formatBRL(item.total)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t pt-3 font-bold">
                  <span>Total ({pedidosNaConta.length} {pedidosNaConta.length === 1 ? 'pedido' : 'pedidos'})</span>
                  <span className="tabular-nums">{formatBRL(resumo.total)}</span>
                </p>
              </article>
            )}

            {visao === 'detalhado' && pedidosAtivos.map((pedido) => {
              const proximo = PROXIMO[pedido.status];
              return (
                <article key={pedido.id} className={cn('rounded-2xl border bg-card p-4 text-sm shadow-soft', pedido.status === 'cancelado' && 'opacity-50')}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-display text-xl font-bold">
                      Nº {pedido.numero}{' '}
                      <span className="font-sans text-sm font-normal text-muted-foreground">
                        · {hora(pedido.created_at)} · {pedido.nome_cliente || SEM_NOME}
                        {pedido.telefone_cliente ? ` · ${pedido.telefone_cliente}` : ''}
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
                        <Button size="sm" variant="secondary" className="h-11 flex-1 text-primary sm:h-9 sm:flex-none" disabled={status.isPending} onClick={() => status.mutate({ pedidoId: pedido.id, novo: proximo.status })}>
                          {proximo.status === 'novo' ? <ChefHat className="mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                          {proximo.label}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-11 sm:h-9" onClick={() => imprimir(pedido)} disabled={pedido.status === 'pendente'} title={pedido.status === 'pendente' ? 'Confirme o pedido antes de imprimir' : undefined}>
                        <Printer className="mr-1 h-4 w-4" /> Imprimir
                      </Button>
                      {pedido.status !== 'entregue' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-11 text-destructive hover:text-destructive sm:h-9"
                          disabled={status.isPending}
                          onClick={() => pedirCancelarPedido(pedido)}
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

          <div className="hidden flex-col gap-3 lg:flex">{fecharConta}</div>
        </div>
      )}

      {conta && (
        <>
          {/* Celular: total e "Fechar conta" sempre à mão, acima da barra de navegação. */}
          <div className="h-16 lg:hidden" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t bg-card px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:hidden">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Total da conta</p>
              <p className="font-display text-2xl font-bold leading-tight text-gold-ink">{formatBRL(conta.total)}</p>
            </div>
            <Button variant="secondary" className="h-12 px-5 font-bold text-primary" onClick={() => setFechandoMobile(true)}>
              <Wallet className="mr-2 h-5 w-5" /> Fechar conta
            </Button>
          </div>
          <Sheet open={fechandoMobile} onOpenChange={setFechandoMobile}>
            <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-[1.5rem] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-10">
              <SheetTitle className="sr-only">Fechar conta da {mesa.nome}</SheetTitle>
              <SheetDescription className="sr-only">Escolha a forma de pagamento e feche a conta.</SheetDescription>
              <div className="flex flex-col gap-3">{fecharConta}</div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <TelaCheia open={lancando} onOpenChange={alternarLancamento} titulo={`Lançar pedido · ${mesa.nome}`}>
        {lancando && <TelaCheiaFrame src={buildMesaUrl(mesa.token)} titulo={`Cardápio da ${mesa.nome}`} />}
      </TelaCheia>
      {dialogo}
    </div>
  );
}
