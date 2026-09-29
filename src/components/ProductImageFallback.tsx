import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/lib/product-category';

interface ProductImageFallbackProps {
  name: string;
  categoryName?: string;
  categoryId?: string | null;
  compact?: boolean;
  className?: string;
}

// Ramo de louro em linha, no espírito dos louros dourados do logo.
function LaurelSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 120" fill="none" className={className} aria-hidden="true">
      <path d="M30 118C22 90 20 60 30 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {[18, 36, 54, 72, 90].map((y, i) => (
        <g key={y}>
          <path d={`M${29 - i * 0.6} ${y + 6}c-10-2-16-9-17-17 9 1 15 7 17 17Z`} fill="currentColor" />
          <path d={`M${30 - i * 0.4} ${y + 14}c9-3 14-10 14-18-8 2-13 8-14 18Z`} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export function ProductImageFallback({
  name,
  categoryName,
  categoryId,
  compact = false,
  className
}: ProductImageFallbackProps) {
  const Icon = getCategoryIcon({ id: categoryId ?? '', nome: categoryName ?? name });

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-primary/30 bg-secondary text-primary',
          className
        )}
        aria-label={`Imagem de ${name} em breve`}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,hsl(135_38%_20%)_0%,hsl(var(--secondary))_45%,hsl(var(--brand-deep))_100%)] text-primary',
        className
      )}
      aria-label={`Imagem de ${name} em breve`}
    >
      <LaurelSprig className="absolute left-[18%] top-1/2 h-28 -translate-y-1/2 -rotate-12 text-primary/35 sm:left-[22%]" />
      <LaurelSprig className="absolute right-[18%] top-1/2 h-28 -translate-y-1/2 rotate-12 -scale-x-100 text-primary/35 sm:right-[22%]" />
      <div className="relative flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/50 bg-brand-deep/40 shadow-glow">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <span className="brand-caps text-[0.55rem] text-primary/80">Foto em breve</span>
      </div>
    </div>
  );
}
