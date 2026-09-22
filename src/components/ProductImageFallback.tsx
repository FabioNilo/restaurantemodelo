import { PackageCheck, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageFallbackProps {
  name: string;
  categoryName?: string;
  price?: number;
  compact?: boolean;
  className?: string;
}

export function ProductImageFallback({
  name,
  categoryName,
  price,
  compact = false,
  className
}: ProductImageFallbackProps) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-primary/15 bg-accent/70 text-primary',
          className
        )}
        aria-label={`Imagem de ${name} em breve`}
      >
        <PackageCheck className="h-7 w-7" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-accent via-background to-secondary/15 p-5 text-foreground',
        className
      )}
      aria-label={`Imagem de ${name} em breve`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-full bg-card/85 p-3 text-primary shadow-soft">
          <Utensils className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className="rounded-full bg-card/90 px-3 py-1 text-[11px] font-semibold text-primary shadow-soft">
          Foto em breve
        </span>
      </div>

      <div className="space-y-2">
        {categoryName && (
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {categoryName}
          </p>
        )}
        <p className="line-clamp-2 font-display text-xl font-bold leading-tight text-foreground">
          {name}
        </p>
        {price !== undefined && (
          <p className="text-sm font-semibold text-primary">
            Disponivel por R$ {price.toFixed(2).replace('.', ',')}
          </p>
        )}
      </div>
    </div>
  );
}
