import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

interface TelaCheiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}

// Abre conteúdo "por cima" do painel, em tela cheia, no lugar de uma aba nova:
// no celular a pessoa nunca sai do painel e volta com um toque.
export function TelaCheia({ open, onOpenChange, titulo, descricao, children }: TelaCheiaProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[100dvh] flex-col gap-0 rounded-none border-0 p-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-brand-deep px-2 pr-12 text-secondary-foreground">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" /> Voltar
          </button>
          <SheetTitle className="truncate text-base text-secondary-foreground">{titulo}</SheetTitle>
          <SheetDescription className="sr-only">{descricao ?? titulo}</SheetDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

// Página do próprio site dentro da TelaCheia (mesma origem: cardápio, mesa).
export function TelaCheiaFrame({ src, titulo }: { src: string; titulo: string }) {
  return <iframe src={src} title={titulo} className="h-full w-full border-0" />;
}
