import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer, ReceiptText, ShoppingBag, ShoppingCart, X, XCircle } from 'lucide-react';
import { CartItemsList } from '@/components/CartItemsList';
import { FecharContaForm } from '@/components/admin/mesas/FecharContaForm';
import { ProductsSection } from '@/components/ProductsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { CartProvider, useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { cancelarVendaBalcao, fetchVendasBalcao, registrarVendaBalcao, type PagamentoCaixaEnvio } from '@/features/integrations/marmitas-api';
import type { VendaBalcao } from '@/features/integrations/painel-contracts';
import { toast } from '@/hooks/use-toast';
import { useConfirmar } from '@/hooks/useConfirmar';
import { getApiErrorMessage } from '@/lib/api';
import { toPedidoMesaItens } from '@/lib/mesa';
import { FORMA_PAGAMENTO_CAIXA_LABELS, formatBRL, toCents, fromCents } from '@/lib/pagamentos';
import { downloadVendaBalcaoThermalPdf } from '@/lib/thermal-label-pdf';
import { cn } from '@/lib/utils';

const CHAVE = ['admin', 'balcao'] as const;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

type VendaRegistrada = Awaited<ReturnType<typeof registrarVendaBalcao>> & { nome: string | null; observacoes: string | null };

const resumoPagamentos = (pagamentos: VendaBalcao['pagamentos']) =>
  pagamentos
    .map((p) => {
      const base = FORMA_PAGAMENTO_CAIXA_LABELS[p.metodo];
      return p.metodo === 'dinheiro' && (p.troco ?? 0) > 0 ? `${base} (troco ${formatBRL(p.troco ?? 0)})` : base;
    })
    .join(' + ');

function BalcaoConteudo() {
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const { permissions } = useAuth();
  const queryClient = useQueryClient();
  const { confirmar, dialogo } = useConfirmar();
  const [nome, setNome] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const [ultima, setUltima] = useState<VendaRegistrada | null>(null);
  // Remonta o formulário de pagamento a cada venda registrada (volta para Pix, sem sobras da anterior).
  const [sessao, setSessao] = useState(0);

  const total = fromCents(toCents(totalPrice));
  const vendas = useQuery({ queryKey: CHAVE, queryFn: fetchVendasBalcao, refetchInterval: 30 * 1000, refetchIntervalInBackground: false });
  const lista = vendas.data ?? [];
  const pagas = lista.filter((v) => v.status === 'paga');
  const totalHoje = fromCents(pagas.reduce((soma, v) => soma + toCents(v.valor_total), 0));

  const registrar = useMutation({
    mutationFn: (pagamentos: PagamentoCaixaEnvio[]) =>
      registrarVendaBalcao({ itens: toPedidoMesaItens(items), nome: nome.trim() || null, observacoes: observacoes.trim() || null, pagamentos }),
    onSuccess: (r) => {
      toast({
        title: `Venda nº ${r.numero} registrada`,
        description: r.troco > 0 ? `Total ${formatBRL(r.valor_total)} · devolva ${formatBRL(r.troco)} de troco` : `Total ${formatBRL(r.valor_total)}`,
      });
      setUltima({ ...r, nome: nome.trim() || null, observacoes: observacoes.trim() || null });
      clearCart();
      setNome('');
      setObservacoes('');
      setSessao((n) => n + 1);
      setPainelAberto(false);
      void queryClient.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (error) => toast({ title: 'Não foi possível registrar a venda', description: getApiErrorMessage(error), variant: 'destructive' }),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarVendaBalcao(id),
    onSuccess: () => {
      toast({ title: 'Venda cancelada', description: 'Ela saiu do Caixa e das métricas.' });
      void queryClient.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (error) => toast({ title: 'Não foi possível cancelar', description: getApiErrorMessage(error), variant: 'destructive' }),
  });

  const pedirCancelar = async (venda: VendaBalcao) => {
    if (
      await confirmar({
        titulo: `Cancelar a venda nº ${venda.numero}?`,
        descricao: `${formatBRL(venda.valor_total)} deixam de contar no Caixa. A venda continua no histórico, marcada como cancelada.`,
        confirmar: 'Cancelar venda',
        perigo: true,
      })
    ) {
      cancelar.mutate(venda.id);
    }
  };

  const imprimir = (venda: Pick<VendaBalcao, 'numero' | 'nome' | 'observacoes' | 'valor_total' | 'created_at' | 'itens' | 'pagamentos'>) => downloadVendaBalcaoThermalPdf(venda);

  const painel = (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border bg-card p-4 shadow-soft">
        <h2 className="mb-3 flex items-center gap-2 font-display text-2xl font-bold text-secondary">
          <ShoppingBag className="h-5 w-5 text-gold-ink" /> Itens da venda
        </h2>
        {totalItems === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Toque em "Adicionar" nos produtos do cardápio para montar a venda.</p>
        ) : (
          <CartItemsList />
        )}
        <div className="mt-4 grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="balcao-nome">Nome do cliente (opcional)</Label>
            <Input id="balcao-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Para o cupom" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="balcao-obs">Observações (opcional)</Label>
            <Textarea id="balcao-obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={300} rows={2} />
          </div>
        </div>
      </section>

      <FecharContaForm
        key={sessao}
        titulo="Receber pagamento"
        rotuloBotao="Registrar venda"
        total={total}
        enviando={registrar.isPending}
        bloqueio={totalItems === 0 ? 'Adicione ao menos um item à venda.' : null}
        onFechar={(pagamentos) => registrar.mutate(pagamentos)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-16 lg:pb-0">
      <div>
        <h1 className="font-display text-4xl font-bold text-secondary">Balcão</h1>
        <p className="text-sm text-muted-foreground">
          Venda direta, sem mesa e sem cadastro: escolha os itens, receba (Pix, Débito, Crédito ou Dinheiro) e a venda entra no Caixa.
        </p>
      </div>

      {ultima && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-4" role="status">
          <ReceiptText className="h-5 w-5 text-secondary" />
          <p className="min-w-0 flex-1 text-sm">
            <strong>Venda nº {ultima.numero} registrada</strong> · {formatBRL(ultima.valor_total)}
            {ultima.troco > 0 && (
              <>
                {' '}
                · <strong className="text-secondary">devolva {formatBRL(ultima.troco)} de troco</strong>
              </>
            )}
          </p>
          <Button size="sm" variant="outline" onClick={() => imprimir(ultima)}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir cupom
          </Button>
          <button type="button" onClick={() => setUltima(null)} aria-label="Fechar aviso" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <ProductsSection modoBalcao />
        <aside className="hidden lg:sticky lg:top-6 lg:block" aria-label="Venda atual">
          {painel}
        </aside>
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="mb-1 flex items-center justify-between font-display text-2xl font-bold text-secondary">
          <span>Vendas de hoje</span>
          <span className="font-sans text-base">{formatBRL(totalHoje)}</span>
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{pagas.length} venda(s) paga(s) no balcão hoje.</p>
        {vendas.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gold-ink" />
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda no balcão hoje.</p>
        ) : (
          <ul className="divide-y text-sm">
            {lista.map((venda) => (
              <li key={venda.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-3', venda.status === 'cancelada' && 'opacity-60')}>
                <span className="w-14 font-semibold">Nº {venda.numero}</span>
                <span className="w-12 text-muted-foreground">{hora(venda.created_at)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {venda.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}
                  {venda.nome ? <span className="text-muted-foreground"> · {venda.nome}</span> : null}
                </span>
                <span className="text-muted-foreground">{resumoPagamentos(venda.pagamentos)}</span>
                <strong className={cn('tabular-nums', venda.status === 'cancelada' && 'line-through')}>{formatBRL(venda.valor_total)}</strong>
                {venda.status === 'cancelada' ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Cancelada</span>
                ) : (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => imprimir(venda)} aria-label={`Imprimir venda ${venda.numero}`}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    {permissions.role === 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={cancelar.isPending}
                        onClick={() => void pedirCancelar(venda)}
                        aria-label={`Cancelar venda ${venda.numero}`}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Celular: a venda atual abre numa folha, acima da barra de navegação. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-primary/30 bg-brand-deep/95 p-3 backdrop-blur lg:hidden">
        <Button variant="hero" className="w-full rounded-full font-bold" onClick={() => setPainelAberto(true)}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          {totalItems > 0 ? `Venda (${totalItems}) · ${formatBRL(total)}` : 'Venda atual (vazia)'}
        </Button>
      </div>
      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-[1.5rem] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6">
          <SheetTitle className="sr-only">Venda atual</SheetTitle>
          <SheetDescription className="sr-only">Itens da venda e pagamento</SheetDescription>
          {painel}
        </SheetContent>
      </Sheet>
      {dialogo}
    </div>
  );
}

// Carrinho próprio da tela: não mistura com o carrinho do site nem da mesa.
export default function BalcaoPage() {
  return (
    <CartProvider>
      <BalcaoConteudo />
    </CartProvider>
  );
}
