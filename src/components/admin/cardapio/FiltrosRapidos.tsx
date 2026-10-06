import { cn } from '@/lib/utils';
import { ESTOQUE_BAIXO } from '@/types/product';

// Parâmetros da URL usados pelos filtros rápidos da lista de produtos.
export type FiltroRapidoParam = 'foto' | 'disp' | 'custo' | 'estoque';
export type FiltrosRapidosValores = Partial<Record<FiltroRapidoParam, string>>;

// Chips do mesmo parâmetro se excluem (ex.: "Com foto" e "Sem foto").
const CHIPS: Array<{ param: FiltroRapidoParam; valor: string; label: string }> = [
  { param: 'foto', valor: 'com', label: 'Com foto' },
  { param: 'foto', valor: 'sem', label: 'Sem foto' },
  { param: 'disp', valor: 'disponivel', label: 'Disponíveis' },
  { param: 'disp', valor: 'indisponivel', label: 'Indisponíveis' },
  { param: 'custo', valor: 'sem', label: 'Sem custo' },
  { param: 'estoque', valor: 'baixo', label: `Estoque baixo (até ${ESTOQUE_BAIXO})` },
  { param: 'estoque', valor: 'zerado', label: 'Sem estoque' },
];

interface FiltrosRapidosProps {
  valores: FiltrosRapidosValores;
  onChange: (param: FiltroRapidoParam, valor: string | null) => void;
}

export function FiltrosRapidos({ valores, onChange }: FiltrosRapidosProps) {
  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtros rápidos">
      {CHIPS.map(({ param, valor, label }) => {
        const ativo = valores[param] === valor;
        return (
          <button
            key={`${param}-${valor}`}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(param, ativo ? null : valor)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
              ativo ? 'border-primary bg-primary/20 text-gold-ink' : 'border-dashed bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
