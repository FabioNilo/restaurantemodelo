import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Bike, CreditCard, FileSpreadsheet, Landmark, Loader2, QrCode, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchMovimentosCaixa } from '@/features/integrations/marmitas-api';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { gerarExcelFluxoCaixa } from '@/lib/exportar-excel';
import { dataBR, resumirCaixa } from '@/lib/fluxo-caixa';
import { FORMA_PAGAMENTO_LABELS, FORMAS_PAGAMENTO, formatBRL, fromCents, toCents, type FormaPagamento } from '@/lib/pagamentos';
import { ATALHOS_PERIODO, periodoDoAtalho, type AtalhoPeriodo } from '@/lib/periodos';
import { cn } from '@/lib/utils';

const ICONES: Record<FormaPagamento, typeof QrCode> = { pix: QrCode, cartao_debito: Landmark, cartao_credito: CreditCard };

// Caixa por período (só entradas): contas de mesa fechadas e deliveries entregues,
// por forma de pagamento e por canal, com exportação do fluxo de caixa em Excel.
export default function CaixaPage() {
  const [atalho, setAtalho] = useState<AtalhoPeriodo | null>('hoje');
  const [periodo, setPeriodo] = useState(() => periodoDoAtalho('hoje'));
  const [exportando, setExportando] = useState(false);

  const movimentos = useQuery({
    queryKey: ['admin', 'caixa', periodo.de, periodo.ate],
    queryFn: () => fetchMovimentosCaixa(periodo.de, periodo.ate),
    enabled: periodo.de <= periodo.ate,
  });

  const resumo = resumirCaixa(movimentos.data ?? []);
  const periodoInvalido = periodo.de > periodo.ate;

  const escolherAtalho = (id: AtalhoPeriodo) => {
    setAtalho(id);
    setPeriodo(periodoDoAtalho(id));
  };

  const exportar = async () => {
    if (!movimentos.data) return;
    setExportando(true);
    try {
      await gerarExcelFluxoCaixa(movimentos.data, periodo);
    } catch (error) {
      toast({ title: 'Não foi possível gerar o Excel', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  const titulo = periodo.de === periodo.ate ? dataBR(periodo.de) : `${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary">Caixa</h1>
          <p className="text-sm text-muted-foreground">Recebimentos de {titulo}: contas de mesa fechadas e deliveries entregues.</p>
        </div>
        <Button onClick={exportar} disabled={!movimentos.data || exportando || periodoInvalido} className="h-11 w-full sm:h-10 sm:w-auto">
          {exportando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Exportar Excel
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:flex-row sm:flex-wrap sm:items-end">
        <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 scrollbar-none sm:mx-0 sm:flex-wrap" role="group" aria-label="Atalhos de período">
          {ATALHOS_PERIODO.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => escolherAtalho(a.id)}
              aria-pressed={atalho === a.id}
              className={cn('shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition', atalho === a.id ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="caixa-de" className="text-xs">
              De
            </Label>
            <Input
              id="caixa-de"
              type="date"
              value={periodo.de}
              max={periodo.ate}
              onChange={(e) => {
                setAtalho(null);
                setPeriodo((p) => ({ ...p, de: e.target.value }));
              }}
              className="h-11 w-full sm:h-9 sm:w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="caixa-ate" className="text-xs">
              Até
            </Label>
            <Input
              id="caixa-ate"
              type="date"
              value={periodo.ate}
              min={periodo.de}
              onChange={(e) => {
                setAtalho(null);
                setPeriodo((p) => ({ ...p, ate: e.target.value }));
              }}
              className="h-11 w-full sm:h-9 sm:w-40"
            />
          </div>
        </div>
        {periodoInvalido && <p className="text-sm text-destructive">A data inicial deve ser antes da final.</p>}
      </div>

      {movimentos.error && <p className="text-destructive">{getApiErrorMessage(movimentos.error)}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-2xl bg-secondary p-5 text-secondary-foreground lg:col-span-1">
          <p className="flex items-center gap-2 text-sm text-secondary-foreground/75">
            <Wallet className="h-4 w-4" /> Total recebido
          </p>
          <p className="mt-1 font-display text-4xl font-bold text-primary">{movimentos.isLoading ? '…' : formatBRL(resumo.total)}</p>
          <p className="text-xs text-secondary-foreground/60">{resumo.quantidade} recebimento(s)</p>
          {resumo.taxaEntrega > 0 && (
            <p className="mt-2 border-t border-secondary-foreground/15 pt-2 text-xs text-secondary-foreground/75">
              Itens {formatBRL(resumo.itens)} · Taxas de entrega {formatBRL(resumo.taxaEntrega)}
            </p>
          )}
        </div>
        {FORMAS_PAGAMENTO.map((forma) => {
          const Icone = ICONES[forma];
          return (
            <div key={forma} className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icone className="h-4 w-4 text-gold-ink" /> {FORMA_PAGAMENTO_LABELS[forma]}
              </p>
              <p className="mt-1 text-xl font-semibold sm:text-2xl">{formatBRL(resumo.porForma[forma])}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(['mesa', 'delivery'] as const).map((canal) => {
          const lista = (movimentos.data ?? []).filter((m) => m.canal === canal);
          const Icone = canal === 'mesa' ? Armchair : Bike;
          return (
            <section key={canal} className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <h2 className="mb-3 flex items-center justify-between font-display text-2xl font-bold text-secondary">
                <span className="flex items-center gap-2">
                  <Icone className="h-5 w-5 text-gold-ink" /> {canal === 'mesa' ? 'Mesas' : 'Delivery'}
                </span>
                <span className="font-sans text-base">{formatBRL(resumo.porCanal[canal])}</span>
              </h2>
              {canal === 'delivery' && resumo.taxaEntrega > 0 && (
                <p className="-mt-2 mb-3 text-sm text-muted-foreground">
                  Itens {formatBRL(fromCents(toCents(resumo.porCanal.delivery) - toCents(resumo.taxaEntrega)))} + taxas de entrega{' '}
                  {formatBRL(resumo.taxaEntrega)}
                </p>
              )}
              {movimentos.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gold-ink" />
              ) : lista.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum recebimento no período.</p>
              ) : (
                // No celular, sem rolagem dentro da página (rolagem aninhada atrapalha o polegar).
                <ul className="divide-y text-sm lg:max-h-96 lg:overflow-y-auto">
                  {lista.map((m) => (
                    <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-3 sm:flex sm:flex-wrap sm:py-2">
                      <span className="order-3 text-xs text-muted-foreground sm:order-none sm:w-28 sm:text-sm">
                        {periodo.de === periodo.ate ? '' : `${dataBR(m.data).slice(0, 5)} `}
                        {m.data.slice(11, 16)}
                        <span className="sm:hidden"> · {FORMA_PAGAMENTO_LABELS[m.metodo]}</span>
                      </span>
                      <span className="order-1 min-w-0 truncate font-medium sm:order-none sm:flex-1">
                        {m.referencia}
                        {m.cliente ? <span className="font-normal text-muted-foreground"> · {m.cliente}</span> : null}
                      </span>
                      <span className="hidden text-muted-foreground sm:inline">{FORMA_PAGAMENTO_LABELS[m.metodo]}</span>
                      <span className="order-2 row-span-2 flex flex-col items-end sm:order-none sm:row-span-1">
                        <strong className="tabular-nums">{formatBRL(m.valor)}</strong>
                        {m.taxa_entrega > 0 && (
                          <span className="text-xs text-muted-foreground">entrega {formatBRL(m.taxa_entrega)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
