import { CheckCircle2, EyeOff, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEM_CATEGORIA, type Categoria } from '@/types/product';

interface BarraSelecaoProps {
  quantidade: number;
  categorias: Pick<Categoria, 'id' | 'nome'>[];
  enviando: boolean;
  onDisponivel: (disponivel: boolean) => void;
  onMoverCategoria: (categoriaId: string) => void;
  onLimpar: () => void;
}

// Ações em massa nos produtos marcados. No celular fica acima da barra de navegação.
export function BarraSelecao({ quantidade, categorias, enviando, onDisponivel, onMoverCategoria, onLimpar }: BarraSelecaoProps) {
  if (quantidade === 0) return null;

  return (
    <div
      role="region"
      aria-label="Ações nos produtos selecionados"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-card px-3 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:bottom-4 lg:left-auto lg:right-8 lg:w-auto lg:rounded-2xl lg:border"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto flex items-center gap-1 text-sm font-semibold" aria-live="polite">
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {quantidade} selecionado(s)
        </p>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onLimpar} aria-label="Limpar seleção" disabled={enviando}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button variant="secondary" className="h-11 text-primary sm:h-9" onClick={() => onDisponivel(true)} disabled={enviando}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Disponibilizar
        </Button>
        <Button variant="outline" className="h-11 sm:h-9" onClick={() => onDisponivel(false)} disabled={enviando}>
          <EyeOff className="mr-1 h-4 w-4" /> Indisponibilizar
        </Button>
        {/* value vazio: o Select volta ao placeholder depois de cada uso. */}
        <Select value="" onValueChange={onMoverCategoria} disabled={enviando}>
          <SelectTrigger className="col-span-2 h-11 sm:h-9 sm:w-52" aria-label="Mover para a categoria">
            <SelectValue placeholder="Mover para categoria…" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </SelectItem>
            ))}
            <SelectItem value={SEM_CATEGORIA}>Sem categoria</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
