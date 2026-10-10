import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificacoesPainel } from './NotificacoesPainel';
import type { EstadoPush } from '@/hooks/useNotificacoesPush';

function montar(estado: EstadoPush, extra: Partial<React.ComponentProps<typeof NotificacoesPainel>> = {}) {
  const acoes = { ativar: vi.fn(), desativar: vi.fn(), testar: vi.fn(), instalar: vi.fn() };
  render(<NotificacoesPainel estado={estado} ocupado={false} podeInstalar={false} tema="claro" {...acoes} {...extra} />);
  return acoes;
}

describe('NotificacoesPainel', () => {
  it('desativado: oferece ativar as notificações', async () => {
    const acoes = montar('desativado');
    await userEvent.click(screen.getByRole('button', { name: /Ativar notificações/i }));
    expect(acoes.ativar).toHaveBeenCalledTimes(1);
  });

  it('ativado: permite enviar teste e desativar', async () => {
    const acoes = montar('ativado');
    expect(screen.getByText(/mesa, delivery ou retirada/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Enviar teste/i }));
    await userEvent.click(screen.getByRole('button', { name: /Desativar/i }));
    expect(acoes.testar).toHaveBeenCalledTimes(1);
    expect(acoes.desativar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Ativar notificações/i })).not.toBeInTheDocument();
  });

  it('bloqueado: explica como liberar no navegador, sem botão de ativar', () => {
    montar('bloqueado');
    expect(screen.getByText(/bloqueadas neste navegador/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ativar notificações/i })).not.toBeInTheDocument();
  });

  it('iPhone sem o app instalado: ensina a Adicionar à Tela de Início', () => {
    montar('precisa-instalar');
    expect(screen.getByText(/Adicionar à Tela de Início/i)).toBeInTheDocument();
  });

  it('servidor sem chaves: avisa que ainda não foi configurado', () => {
    montar('sem-servidor');
    expect(screen.getByText(/ainda não foram configuradas no servidor/i)).toBeInTheDocument();
  });

  it('navegador sem suporte ou carregando: só mostra "Instalar app" quando dá para instalar', async () => {
    const { container, unmount } = render(
      <NotificacoesPainel estado="indisponivel" ocupado={false} podeInstalar={false} tema="claro" ativar={vi.fn()} desativar={vi.fn()} testar={vi.fn()} instalar={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    unmount();

    const acoes = montar('carregando', { podeInstalar: true });
    await userEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(acoes.instalar).toHaveBeenCalledTimes(1);
  });

  it('o botão Instalar app acompanha o bloco quando o navegador permite instalar', async () => {
    const acoes = montar('desativado', { podeInstalar: true });
    await userEvent.click(screen.getByRole('button', { name: /Instalar app/i }));
    expect(acoes.instalar).toHaveBeenCalledTimes(1);
  });
});
