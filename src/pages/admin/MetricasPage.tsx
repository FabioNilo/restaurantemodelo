import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { fetchMetricas } from '@/features/integrations/marmitas-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatBRL } from '@/lib/pagamentos';
import { cn } from '@/lib/utils';

const PERIODOS = [
  { dias: 1, label: 'Hoje', anterior: 'ontem' },
  { dias: 7, label: '7 dias', anterior: '7 dias anteriores' },
  { dias: 30, label: '30 dias', anterior: '30 dias anteriores' },
] as const;

const chartConfig = { vendas: { label: 'Vendas', color: 'hsl(var(--secondary))' } } satisfies ChartConfig;

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <p className="mt-1 text-xs text-muted-foreground">sem base anterior</p>;
  const sobe = valor >= 0;
  const Icone = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={cn('mt-1 inline-flex items-center gap-0.5 text-xs font-semibold', sobe ? 'text-secondary' : 'text-destructive')}>
      <Icone className="h-3.5 w-3.5" /> {Math.abs(valor).toLocaleString('pt-BR')}%
    </p>
  );
}

// Métricas de vendas (como plataforma-restaurantes/app/painel/metricas): mesas
// e delivery, sem cancelados, comparadas ao período anterior.
export default function MetricasPage() {
  const [dias, setDias] = useState<1 | 7 | 30>(7);
  const metricas = useQuery({ queryKey: ['admin', 'metricas', dias], queryFn: () => fetchMetricas(dias) });
  const m = metricas.data;
  const periodo = PERIODOS.find((p) => p.dias === dias)!;

  const blocos = m
    ? [
        { label: 'Vendas', valor: formatBRL(m.vendas.valor), variacao: m.vendas.variacao },
        { label: 'Pedidos', valor: String(m.pedidos.valor), variacao: m.pedidos.variacao },
        { label: 'Ticket médio', valor: formatBRL(m.ticket_medio.valor), variacao: m.ticket_medio.variacao },
        { label: 'Mesas', valor: formatBRL(m.por_canal.mesa) },
        { label: 'Delivery', valor: formatBRL(m.por_canal.delivery) },
        { label: 'Cancelados', valor: String(m.cancelados) },
      ]
    : [];

  const maxTop = Math.max(1, ...(m?.top_produtos.map((p) => p.quantidade) ?? [1]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary">Métricas</h1>
          <p className="text-sm text-muted-foreground">Mesas e delivery, sem pedidos cancelados. Comparado com {periodo.anterior}.</p>
        </div>
        <nav className="flex rounded-xl bg-muted p-1 text-sm" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              aria-pressed={dias === p.dias}
              className={cn('rounded-lg px-4 py-1.5 font-medium transition', dias === p.dias ? 'bg-secondary text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>

      {metricas.isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-ink" />}
      {metricas.error && <p className="text-destructive">{getApiErrorMessage(metricas.error)}</p>}

      {m && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {blocos.map((b) => (
              <div key={b.label} className="rounded-2xl border bg-card p-4 shadow-soft">
                <p className="text-sm text-muted-foreground">{b.label}</p>
                <p className="mt-1 text-2xl font-semibold">{b.valor}</p>
                {'variacao' in b && <Variacao valor={b.variacao ?? null} />}
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="mb-4 font-display text-2xl font-bold text-secondary">Vendas por dia</h2>
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <BarChart data={m.por_dia.map((d) => ({ ...d, label: `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}` }))}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => `R$ ${v.toLocaleString('pt-BR')}`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(valor) => formatBRL(Number(valor))} />} />
                  <Bar dataKey="vendas" fill="var(--color-vendas)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ChartContainer>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <h2 className="mb-4 font-display text-2xl font-bold text-secondary">Mais vendidos</h2>
              {m.top_produtos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {m.top_produtos.map((p) => (
                    <li key={p.nome}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{p.nome}</span>
                        <strong className="tabular-nums">{p.quantidade}</strong>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(p.quantidade / maxTop) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
