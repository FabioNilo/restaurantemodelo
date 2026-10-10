import { Bell, BellOff, BellRing, Download, Loader2, Share } from 'lucide-react';
import type { EstadoPush } from '@/hooks/useNotificacoesPush';
import { cn } from '@/lib/utils';

interface Props {
  estado: EstadoPush;
  ocupado: boolean;
  ativar: () => void;
  desativar: () => void;
  testar: () => void;
  podeInstalar: boolean;
  instalar: () => void;
  /** escuro = menu lateral; claro = folha do celular */
  tema: 'escuro' | 'claro';
}

// Ativar/desativar o aviso de pedido novo neste aparelho + instalar o painel como app.
export function NotificacoesPainel({ estado, ocupado, ativar, desativar, testar, podeInstalar, instalar, tema }: Props) {
  const escuro = tema === 'escuro';
  const texto = escuro ? 'text-secondary-foreground/70' : 'text-muted-foreground';
  const botao = cn(
    'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
    escuro ? 'bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25' : 'bg-primary text-primary-foreground hover:bg-primary/90'
  );
  const botaoSuave = cn(
    'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
    escuro ? 'text-secondary-foreground/70 hover:bg-white/5 hover:text-primary' : 'text-muted-foreground hover:bg-muted'
  );

  if (estado === 'carregando' || estado === 'indisponivel') {
    return podeInstalar ? (
      <button type="button" onClick={instalar} className={botao}>
        <Download className="h-4 w-4" /> Instalar app
      </button>
    ) : null;
  }

  return (
    <div className={cn('space-y-2 rounded-2xl p-3 text-sm', escuro ? 'bg-white/5' : 'border bg-card')} data-testid="notificacoes-painel">
      <p className={cn('flex items-center gap-2 font-semibold', escuro ? 'text-secondary-foreground' : 'text-foreground')}>
        {estado === 'ativado' ? <BellRing className="h-4 w-4 text-primary" /> : estado === 'bloqueado' ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        Aviso de pedido novo
      </p>

      {estado === 'ativado' && (
        <>
          <p className={cn('text-xs', texto)}>Ativado neste aparelho: você é avisado a cada pedido de mesa, delivery ou retirada, mesmo com o app fechado.</p>
          <div className="flex gap-1">
            <button type="button" className={botaoSuave} onClick={testar} disabled={ocupado}>
              Enviar teste
            </button>
            <button type="button" className={botaoSuave} onClick={desativar} disabled={ocupado}>
              Desativar
            </button>
          </div>
        </>
      )}

      {estado === 'desativado' && (
        <>
          <p className={cn('text-xs', texto)}>Receba um aviso no celular ou computador quando chegar um pedido, sem precisar ficar com a tela aberta.</p>
          <button type="button" className={botao} onClick={ativar} disabled={ocupado}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            Ativar notificações
          </button>
        </>
      )}

      {estado === 'bloqueado' && (
        <p className={cn('text-xs', texto)}>
          As notificações estão bloqueadas neste navegador. Libere em <strong>Configurações do site → Notificações</strong> e recarregue a página.
        </p>
      )}

      {estado === 'precisa-instalar' && (
        <p className={cn('flex items-start gap-1.5 text-xs', texto)}>
          <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No iPhone/iPad, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Abra o painel por esse ícone e ative o aviso aqui.
          </span>
        </p>
      )}

      {estado === 'sem-servidor' && (
        <p className={cn('text-xs', texto)}>As notificações ainda não foram configuradas no servidor. Fale com o suporte.</p>
      )}

      {podeInstalar && (
        <button type="button" onClick={instalar} className={cn(botao, 'mt-1')}>
          <Download className="h-4 w-4" /> Instalar app
        </button>
      )}
    </div>
  );
}
