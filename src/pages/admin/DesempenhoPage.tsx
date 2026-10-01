import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchDesempenho } from '@/features/integrations/marmitas-api';
import type { RankingRow } from '@/features/integrations/painel-contracts';
import { getApiErrorMessage } from '@/lib/api';
import { formatBRL } from '@/lib/pagamentos';
import { cn } from '@/lib/utils';

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
] as const;

function Movers({ titulo, linhas, alta }: { titulo: string; linhas: RankingRow[]; alta?: boolean }) {
  const Icone = alta ? TrendingUp : TrendingDown;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className={cn('mb-3 flex items-center gap-2 font-display text-2xl font-bold', alta ? 'text-secondary' : 'text-destructive')}>
        <Icone className="h-5 w-5" /> {titulo}
      </h2>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada a destacar.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {linhas.map((r) => (
            <li key={r.key} className="flex justify-between gap-3">
              <span className="truncate">{r.name}</span>
              <strong className={alta ? 'text-secondary' : 'text-destructive'}>
                {r.revenueChange! > 0 ? '+' : ''}
                {r.revenueChange!.toLocaleString('pt-BR')}%
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Desempenho dos produtos (como plataforma-restaurantes/app/painel/desempenho).
export default function DesempenhoPage() {
  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const [soParados, setSoParados] = useState(false);
  const desempenho = useQuery({ queryKey: ['admin', 'desempenho', dias], queryFn: () => fetchDesempenho(dias) });
  const d = desempenho.data;
  const linhas = d ? (soParados ? d.ranking.filter((r) => r.quantity === 0) : d.ranking) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary">Desempenho dos produtos</h1>
          <p className="text-sm text-muted-foreground">Delivery e mesas, sem pedidos cancelados. Comparado com os {dias} dias anteriores.</p>
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

      {desempenho.isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-ink" />}
      {desempenho.error && <p className="text-destructive">{getApiErrorMessage(desempenho.error)}</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Faturamento em produtos', valor: formatBRL(d.faturamento) },
              { label: 'Itens vendidos', valor: d.itens_vendidos.toLocaleString('pt-BR') },
              { label: 'Produtos com venda', valor: String(d.com_venda) },
              { label: 'Produtos parados', valor: String(d.parados) },
            ].map((b) => (
              <div key={b.label} className="rounded-2xl border bg-card p-4 shadow-soft">
                <p className="text-sm text-muted-foreground">{b.label}</p>
                <p className="mt-1 text-2xl font-semibold">{b.valor}</p>
              </div>
            ))}
          </div>

          {(d.movers.up.length > 0 || d.movers.down.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Movers titulo="Em alta" linhas={d.movers.up} alta />
              <Movers titulo="Em queda" linhas={d.movers.down} />
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
              <h2 className="font-display text-2xl font-bold text-secondary">Ranking</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={soParados} onChange={(e) => setSoParados(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--secondary))]" />
                Só parados
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2 text-right">Qtd.</th>
                    <th className="px-4 py-2 text-right">Faturamento</th>
                    <th className="px-4 py-2 text-right">Participação</th>
                    <th className="px-4 py-2 text-right">Preço médio</th>
                    <th className="px-4 py-2 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((r, i) => (
                    <tr key={r.key} className={cn(r.quantity === 0 && 'text-muted-foreground')}>
                      <td className="px-4 py-2 tabular-nums">{r.quantity > 0 ? i + 1 : '—'}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.quantity}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatBRL(r.revenue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.share.toLocaleString('pt-BR')}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.quantity ? formatBRL(r.avgPrice) : '—'}</td>
                      <td
                        className={cn(
                          'px-4 py-2 text-right tabular-nums',
                          r.revenueChange !== null && (r.revenueChange >= 0 ? 'text-secondary' : 'text-destructive')
                        )}
                      >
                        {r.revenueChange === null ? (r.quantity > 0 ? 'novo' : '—') : `${r.revenueChange > 0 ? '+' : ''}${r.revenueChange.toLocaleString('pt-BR')}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
