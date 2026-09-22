import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PedidoTracking from './PedidoTracking';
import { cancelPedidoN8n, fetchPedidoStatusN8n } from '@/features/integrations/marmitas-api';
import type { PedidoStatusResponse } from '@/features/integrations/n8n-contracts';

vi.mock('@/features/integrations/marmitas-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/integrations/marmitas-api')>('@/features/integrations/marmitas-api');

  return {
    ...actual,
    fetchPedidoStatusN8n: vi.fn(),
    cancelPedidoN8n: vi.fn().mockResolvedValue({
      id: 'pedido-1',
      status: 'cancelado',
      cancelled_at: '2026-06-29T18:03:00.000Z',
    }),
  };
});

function makePedido(overrides: Partial<PedidoStatusResponse> = {}): PedidoStatusResponse {
  return {
    id: 'pedido-1',
    status: 'enviado_whatsapp',
    valor_total: 92,
    created_at: '2026-06-29T18:00:00.000Z',
    cancel_until: '2026-06-29T18:05:00.000Z',
    can_cancel: true,
    nome_cliente: 'Cliente Teste',
    telefone_cliente: '73999999999',
    endereco_cliente: 'Rua A, 123',
    bairro_cliente: 'Pontal',
    complemento_cliente: 'Portao azul',
    observacoes_cliente: 'Sem cebola',
    tipo_entrega: 'delivery',
    forma_pagamento: 'pix',
    itens: [
      {
        nome: 'Nhoque ao File Gorgonzola',
        quantidade: 1,
        preco: 84,
        tamanho_nome: 'G',
        tamanho_serve: 'Serve 2 pessoas',
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/pedido/pedido-1?token=token-1']}>
        <Routes>
          <Route path="/pedido/:pedidoId" element={<PedidoTracking />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PedidoTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-29T18:01:00.000Z'));
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders status, total, address, reference and items', async () => {
    vi.mocked(fetchPedidoStatusN8n).mockResolvedValue(makePedido());

    renderPage();

    expect(await screen.findByText(/Acompanhe seu pedido/i)).toBeInTheDocument();
    expect(screen.getByText(/Pedido enviado/i)).toBeInTheDocument();
    expect(screen.getByText(/Cliente Teste/i)).toBeInTheDocument();
    expect(screen.getByText(/Rua A, 123/i)).toBeInTheDocument();
    expect(screen.getByText(/Pontal/i)).toBeInTheDocument();
    expect(screen.getByText(/Portao azul/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhoque ao File Gorgonzola/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 92,00/i)).toBeInTheDocument();
    expect(fetchPedidoStatusN8n).toHaveBeenCalledWith('pedido-1', 'token-1');
  });

  it('allows cancellation before five minutes', async () => {
    vi.mocked(fetchPedidoStatusN8n).mockResolvedValue(makePedido());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderPage();

    const cancelButton = await screen.findByRole('button', { name: /Cancelar pedido/i });
    expect(cancelButton).toBeEnabled();

    await user.click(cancelButton);

    await waitFor(() => {
      expect(cancelPedidoN8n).toHaveBeenCalledWith({ id: 'pedido-1', token: 'token-1' });
    });
  });

  it('blocks cancellation after five minutes', async () => {
    vi.setSystemTime(new Date('2026-06-29T18:06:00.000Z'));
    vi.mocked(fetchPedidoStatusN8n).mockResolvedValue(makePedido());

    renderPage();

    expect(await screen.findByRole('button', { name: /Cancelar pedido/i })).toBeDisabled();
  });

  it('blocks cancellation for cancelled or delivered orders', async () => {
    vi.mocked(fetchPedidoStatusN8n).mockResolvedValue(makePedido({ status: 'entregue', can_cancel: false }));

    renderPage();

    expect(await screen.findByRole('button', { name: /Cancelar pedido/i })).toBeDisabled();
  });
});
