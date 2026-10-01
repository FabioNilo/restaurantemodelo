import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartModal } from './CartModal';
import { ProductCard } from './ProductCard';
import { CartProvider } from '@/context/CartContext';
import { produtoComTamanhos } from '@/test/fixtures';
import { createPedidoN8n, fetchDeliveryZonesN8n } from '@/features/integrations/marmitas-api';

vi.mock('@/features/integrations/marmitas-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/integrations/marmitas-api')>('@/features/integrations/marmitas-api');

  return {
    ...actual,
    fetchDeliveryZonesN8n: vi.fn().mockResolvedValue([
      { id: 2, bairro: 'Centro', taxa: 5, taxa_quinta_sexta: 5, taxa_sab_dom_feriado: 5, ativo: true },
      { id: 4, bairro: 'Pontal', taxa: 8, taxa_quinta_sexta: 8, taxa_sab_dom_feriado: 8, ativo: true },
    ]),
    createPedidoN8n: vi.fn().mockResolvedValue({
      id: 'pedido-1',
      status: 'enviado_whatsapp',
      valor_total: 92,
      created_at: new Date(0).toISOString(),
      tracking_token: 'token-1',
      tracking_url: 'https://pastabrasiliana.test/pedido/pedido-1?token=token-1',
      cancel_until: new Date(5 * 60 * 1000).toISOString(),
    }),
  };
});

function CheckoutHarness() {
  const produto = produtoComTamanhos;

  return (
    <CartProvider>
      <ProductCard marmita={produto} categoriaNome="Gnocchi" index={0} />
      <CartModal isOpen onClose={() => undefined} whatsappNumber="557391473811" />
    </CartProvider>
  );
}

async function addItemAndOpenCheckout() {
  const user = userEvent.setup();

  render(<CheckoutHarness />);

  await user.click(screen.getByRole('button', { name: /\bG\b/i }));
  await user.click(screen.getByRole('button', { name: /Adicionar/i }));
  await user.click(screen.getByRole('button', { name: /Finalizar pedido/i }));

  return user;
}

async function fillRequiredCheckout(user: ReturnType<typeof userEvent.setup>, neighborhood = 'Pontal') {
  await user.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
  await user.type(screen.getByLabelText(/Telefone/i), '73999999999');
  await user.type(screen.getByLabelText(/Endereço/i), 'Rua A, 123');
  await user.click((await screen.findByText(/Selecione o bairro/i)).closest('button')!);
  await user.click(screen.getByRole('option', { name: new RegExp(neighborhood, 'i') }));
  await user.type(screen.getByLabelText(/Ponto de referência/i), 'Portao azul');
}

describe('CartModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPedidoN8n).mockResolvedValue({
      id: 'pedido-1',
      status: 'enviado_whatsapp',
      valor_total: 92,
      created_at: new Date(0).toISOString(),
      tracking_token: 'token-1',
      tracking_url: 'https://pastabrasiliana.test/pedido/pedido-1?token=token-1',
      cancel_until: new Date(5 * 60 * 1000).toISOString(),
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://pastabrasiliana.test',
        assign: vi.fn(),
      },
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(),
    });
    window.sessionStorage.clear();
  });

  it('shows the selected item thumbnail and sends delivery with the neighborhood fee', async () => {
    const user = await addItemAndOpenCheckout();

    expect(screen.getAllByRole('img', { name: /Filé ao Molho Madeira/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\bG\b/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Serve 2 pessoas/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Entrega apenas por delivery/i)).toBeInTheDocument();

    await fillRequiredCheckout(user);
    expect(screen.getByText('Entrega: R$ 8,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 86,00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Crédito$/i }));
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(createPedidoN8n).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_entrega: 'delivery',
          forma_pagamento: 'cartao_credito',
          bairro_cliente: 'Pontal',
          taxa_entrega: 8,
          valor_total: 86,
          nome_cliente: 'Cliente Teste',
          complemento_cliente: 'Portao azul',
          tracking_base_url: 'https://pastabrasiliana.test/pedido',
          itens: [
            expect.objectContaining({
              nome: 'Filé ao Molho Madeira',
              tamanho_nome: 'G',
              tamanho_serve: 'Serve 2 pessoas',
              preco: 78,
            }),
          ],
        })
      );
    });

    expect(fetchDeliveryZonesN8n).toHaveBeenCalled();

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/557391473811?text=')
      );
    });
    expect(window.open).not.toHaveBeenCalled();

    const whatsappUrl = vi.mocked(window.location.assign).mock.calls[0][0];
    const encodedMessage = String(whatsappUrl).split('text=')[1];
    const message = decodeURIComponent(encodedMessage);

    expect(message).toContain('*Cliente*');
    expect(message).toContain('Nome: Cliente Teste');
    expect(message).toContain('Bairro: Pontal');
    expect(message).toContain('Ponto de referência: Portao azul');
    expect(message).toContain('Taxa de entrega (Pontal): R$ 8,00');
    expect(message).toContain('Total do pedido: R$ 86,00');
    expect(message).toContain('https://pastabrasiliana.test/pedido/pedido-1?token=token-1');
    expect(message).toContain('Agradecemos seu pedido!');
  }, 10000);

  it('uses the fee confirmed by the server in the WhatsApp message', async () => {
    vi.mocked(createPedidoN8n).mockResolvedValueOnce({
      id: 'pedido-1',
      status: 'recebido',
      subtotal: 78,
      taxa_entrega: 9.25,
      valor_total: 87.25,
      created_at: new Date(0).toISOString(),
      tracking_token: 'token-1',
    });

    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckout(user, 'Pontal');
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalled();
    });

    const message = decodeURIComponent(String(vi.mocked(window.location.assign).mock.calls[0][0]).split('text=')[1]);
    expect(message).toContain('Taxa de entrega (Pontal): R$ 9,25');
    expect(message).toContain('Total do pedido: R$ 87,25');
  }, 10000);

  it('blocks checkout without delivery reference point', async () => {
    const user = await addItemAndOpenCheckout();

    await user.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
    await user.type(screen.getByLabelText(/Telefone/i), '73999999999');
    await user.type(screen.getByLabelText(/Endereço/i), 'Rua A, 123');
    await user.click((await screen.findByText(/Selecione o bairro/i)).closest('button')!);
    await user.click(screen.getByRole('option', { name: /Centro/i }));
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    expect(createPedidoN8n).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  }, 10000);

  it('lists only registered neighborhoods with their fee and requires choosing one', async () => {
    const user = await addItemAndOpenCheckout();

    await user.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
    await user.type(screen.getByLabelText(/Telefone/i), '73999999999');
    await user.type(screen.getByLabelText(/Endereço/i), 'Rua A, 123');
    await user.type(screen.getByLabelText(/Ponto de referência/i), 'Portao azul');

    expect(screen.getByText('Entrega: Escolha o bairro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i })).toBeDisabled();

    await user.click((await screen.findByText(/Selecione o bairro/i)).closest('button')!);
    expect(screen.getByRole('option', { name: 'Centro — R$ 5,00' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pontal — R$ 8,00' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Bairro/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /Centro/i }));
    expect(screen.getByText('Entrega: R$ 5,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 83,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i })).toBeEnabled();
  }, 10000);

  it('does not allow ordering when no neighborhood is available', async () => {
    vi.mocked(fetchDeliveryZonesN8n).mockResolvedValueOnce([]);
    await addItemAndOpenCheckout();

    expect(await screen.findByText(/não há bairros com entrega disponível/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Bairro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i })).toBeDisabled();
  });

  it('shows the reason and does not open WhatsApp when the server refuses the neighborhood', async () => {
    vi.mocked(createPedidoN8n).mockRejectedValueOnce(
      Object.assign(new Error(JSON.stringify({ success: false, error: 'Ainda não entregamos neste bairro. Escolha um bairro da lista.' })), {
        status: 400,
      })
    );
    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckout(user, 'Pontal');
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(createPedidoN8n).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(fetchDeliveryZonesN8n).toHaveBeenCalledTimes(2);
    });
    expect(window.location.assign).not.toHaveBeenCalled();
  }, 10000);

  it('opens WhatsApp even when n8n order registration fails', async () => {
    vi.mocked(createPedidoN8n).mockRejectedValueOnce(new Error('n8n indisponivel'));
    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckout(user, 'Centro');
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/557391473811?text=')
      );
    });
  });
});
