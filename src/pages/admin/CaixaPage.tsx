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
import { FORMA_PAGAMENTO_LABELS, FORMAS_PAGAMENTO, formatBRL, type FormaPagamento } from '@/lib/pagamentos';
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
        <Button onClick={exportar} disabled={!movimentos.data || exportando || periodoInvalido}>
          {exportando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Exportar Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Atalhos de período">
          {ATALHOS_PERIODO.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => escolherAtalho(a.id)}
              aria-pressed={atalho === a.id}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition', atalho === a.id ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
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
              className="h-9 w-40"
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
              className="h-9 w-40"
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
        </div>
        {FORMAS_PAGAMENTO.map((forma) => {
          const Icone = ICONES[forma];
          return (
            <div key={forma} className="rounded-2xl border bg-card p-5 shadow-soft">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icone className="h-4 w-4 text-gold-ink" /> {FORMA_PAGAMENTO_LABELS[forma]}
              </p>
              <p className="mt-1 text-2xl font-semibold">{formatBRL(resumo.porForma[forma])}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(['mesa', 'delivery'] as const).map((canal) => {
          const lista = (movimentos.data ?? []).filter((m) => m.canal === canal);
          const Icone = canal === 'mesa' ? Armchair : Bike;
          return (
            <section key={canal} className="rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="mb-3 flex items-center justify-between font-display text-2xl font-bold text-secondary">
                <span className="flex items-center gap-2">
                  <Icone className="h-5 w-5 text-gold-ink" /> {canal === 'mesa' ? 'Mesas' : 'Delivery'}
                </span>
                <span className="font-sans text-base">{formatBRL(resumo.porCanal[canal])}</span>
              </h2>
              {movimentos.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gold-ink" />
              ) : lista.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum recebimento no período.</p>
              ) : (
                <ul className="max-h-96 divide-y overflow-y-auto text-sm">
                  {lista.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                      <span className="w-28 text-muted-foreground">
                        {periodo.de === periodo.ate ? '' : `${dataBR(m.data).slice(0, 5)} `}
                        {m.data.slice(11, 16)}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {m.referencia}
                        {m.cliente ? <span className="font-normal text-muted-foreground"> · {m.cliente}</span> : null}
                      </span>
                      <span className="text-muted-foreground">{FORMA_PAGAMENTO_LABELS[m.metodo]}</span>
                      <strong className="tabular-nums">{formatBRL(m.valor)}</strong>
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
