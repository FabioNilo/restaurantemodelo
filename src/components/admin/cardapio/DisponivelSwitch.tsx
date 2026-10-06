import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface DisponivelSwitchProps {
  nome: string;
  disponivel: boolean;
  estoque: number;
  carregando?: boolean;
  onChange: (disponivel: boolean) => void;
  compacto?: boolean;
}

// Liga/desliga a venda do produto direto da lista. Ligado mas sem estoque ainda não
// aparece no site, então o texto avisa.
export function DisponivelSwitch({ nome, disponivel, estoque, carregando = false, onChange, compacto = false }: DisponivelSwitchProps) {
  const semEstoque = disponivel && estoque <= 0;
  const texto = !disponivel ? 'Oculto' : semEstoque ? 'Sem estoque' : 'À venda';

  return (
    <label className={cn('flex shrink-0 cursor-pointer items-center gap-2', compacto ? 'flex-col gap-1' : '')}>
      <Switch
        checked={disponivel}
        disabled={carregando}
        onCheckedChange={onChange}
        aria-label={`${nome}: ${disponivel ? 'disponível para venda' : 'indisponível'}`}
      />
      <span className={cn('text-xs font-medium', !disponivel ? 'text-muted-foreground' : semEstoque ? 'text-orange-700' : 'text-secondary')}>{texto}</span>
    </label>
  );
}
