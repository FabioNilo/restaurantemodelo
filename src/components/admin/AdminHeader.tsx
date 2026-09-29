import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';

interface AdminHeaderProps {
  children?: ReactNode;
}

export function AdminHeader({ children }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-primary/25 bg-brand-deep/95 text-secondary-foreground backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={BRAND.logo.sm} alt={BRAND.name} width={40} height={40} className="h-10 w-10 shrink-0 rounded-full ring-1 ring-primary/50" />
          <span className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap pt-0.5 font-display text-xl font-bold leading-normal text-primary">{BRAND.shortName}</span>
            <span className="brand-caps text-[0.55rem] leading-normal text-brand-gold-soft/80">Painel</span>
          </span>
        </div>
        <div className="flex items-center gap-4 [&_.text-muted-foreground]:text-secondary-foreground/70">{children}</div>
      </div>
    </header>
  );
}
