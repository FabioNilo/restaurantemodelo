import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface Pedido {
  titulo: string;
  descricao?: string;
  confirmar?: string;
  perigo?: boolean;
}

// Substitui window.confirm (no celular vira um alerta cru do navegador) por um
// diálogo da marca. Uso: `if (await confirmar({ titulo: '...' })) ...` e renderizar `dialogo`.
export function useConfirmar() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resolver = useRef<(ok: boolean) => void>();

  const confirmar = useCallback(
    (novo: Pedido) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setPedido(novo);
      }),
    []
  );

  const responder = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = undefined;
    setPedido(null);
  };

  const dialogo = (
    <AlertDialog open={!!pedido} onOpenChange={(aberto) => !aberto && responder(false)}>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{pedido?.titulo}</AlertDialogTitle>
          {pedido?.descricao && <AlertDialogDescription>{pedido.descricao}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-11 sm:h-10">Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => responder(true)}
            className={cn('h-11 sm:h-10', pedido?.perigo && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          >
            {pedido?.confirmar ?? 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmar, dialogo };
}
