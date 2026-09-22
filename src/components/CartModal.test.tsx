import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartModal } from './CartModal';
import { ProductCard } from './ProductCard';
import { CartProvider } from '@/context/CartContext';
import { produtosCardapio } from '@/data/cardapio';
import { createPedidoN8n, fetchDeliveryFeeN8n, fetchDeliveryZonesN8n } from '@/features/integrations/marmitas-api';

vi.mock('@/features/integrations/marmitas-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/integrations/marmitas-api')>('@/features/integrations/marmitas-api');

  return {
    ...actual,
    fetchDeliveryFeeN8n: vi.fn().mockResolvedValue({
      bairro: 'Pontal',
      taxa: 8,
      encontrado: true,
      entrega_disponivel: true,
      regra_aplicada: 'quinta_sexta',
      observacao: 'Taxa inicial por bairro',
    }),
    fetchDeliveryZonesN8n: vi.fn().mockResolvedValue([
      { id: 2, bairro: 'Centro', taxa_quinta_sexta: 5, taxa_sab_dom_feriado: 7, ativo: true, observacao: 'Taxa padrao inicial' },
      { id: 4, bairro: 'Pontal', taxa_quinta_sexta: 8, taxa_sab_dom_feriado: 10, ativo: true, observacao: 'Taxa inicial por bairro' },
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
  const produto = produtosCardapio.find((item) => item.id === 'file-ao-molho-madeira')!;

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

async function fillRequiredCheckoutManually(user: ReturnType<typeof userEvent.setup>, neighborhood = 'Novo Bairro') {
  await user.type(screen.getByLabelText(/Nome completo/i), 'Cliente Teste');
  await user.type(screen.getByLabelText(/Telefone/i), '73999999999');
  await user.type(screen.getByLabelText(/Endere/i), 'Rua A, 123');
  const neighborhoodInput = await screen.findByLabelText(/Bairro/i);
  await waitFor(() => expect(neighborhoodInput).not.toBeDisabled());
  await user.type(neighborhoodInput, neighborhood);
  await user.type(screen.getByLabelText(/Ponto de refer/i), 'Portao azul');
}

describe('CartModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDeliveryFeeN8n).mockResolvedValue({
      bairro: 'Pontal',
      taxa: 8,
      encontrado: true,
      entrega_disponivel: true,
      regra_aplicada: 'quinta_sexta',
      observacao: 'Taxa inicial por bairro',
    });
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

  it('shows the selected item thumbnail and sends delivery with tracking link', async () => {
    const user = await addItemAndOpenCheckout();

    expect(screen.getAllByRole('img', { name: /Filé ao Molho Madeira/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\bG\b/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Serve 2 pessoas/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Entrega apenas por delivery/i)).toBeInTheDocument();

    await fillRequiredCheckout(user);
    await waitFor(() => {
      expect(fetchDeliveryFeeN8n).toHaveBeenCalledWith({ bairro: 'Pontal' });
    });
    expect(screen.getByText('Entrega: R$ 8,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 86,00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cartão de crédito/i }));
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(createPedidoN8n).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_entrega: 'delivery',
          forma_pagamento: 'cartao_credito',
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
    expect(fetchDeliveryFeeN8n).toHaveBeenCalledWith({ bairro: 'Pontal' });

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
    expect(message).toContain('Ponto de referência: Portao azul');
    expect(message).toContain('Taxa de delivery: R$ 8,00');
    expect(message).toContain('Total do pedido: R$ 86,00');
    expect(message).toContain('https://pastabrasiliana.test/pedido/pedido-1?token=token-1');
    expect(message).toContain('Agradecemos seu pedido!');
  }, 10000);

  it('keeps delivery fee and order total in WhatsApp message when the backend returns fee aliases', async () => {
    vi.mocked(fetchDeliveryFeeN8n).mockResolvedValue({
      bairro: 'Pontal',
      taxa_entrega: '8,50',
      encontrado: 'true',
      regra_aplicada: 'quinta_sexta',
      observacao: 'Taxa por alias',
    } as any);

    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckout(user);
    await waitFor(() => {
      expect(screen.getByText('Entrega: R$ 8,50')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(createPedidoN8n).toHaveBeenCalledWith(
        expect.objectContaining({
          taxa_entrega: 8.5,
          valor_total: 86.5,
        })
      );
    });

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/557391473811?text=')
      );
    });

    const whatsappUrl = vi.mocked(window.location.assign).mock.calls[0][0];
    const encodedMessage = String(whatsappUrl).split('text=')[1];
    const message = decodeURIComponent(encodedMessage);

    expect(message).toContain('Taxa de delivery: R$ 8,50');
    expect(message).toContain('Total do pedido: R$ 86,50');
  }, 10000);

  it('uses the selected configured delivery fee in the WhatsApp message when confirmation has no fee', async () => {
    vi.mocked(fetchDeliveryZonesN8n).mockResolvedValueOnce([
      {
        id: 4,
        bairro: 'Pontal',
        taxa: 9.25,
        taxa_quinta_sexta: 8,
        taxa_sab_dom_feriado: 10,
        ativo: true,
        observacao: 'Taxa selecionada',
      },
    ]);
    vi.mocked(fetchDeliveryFeeN8n).mockResolvedValue({
      bairro: 'Pontal',
      taxa: null,
      encontrado: true,
      entrega_disponivel: true,
      regra_aplicada: null,
      observacao: null,
    });

    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckout(user, 'Pontal');
    await waitFor(() => {
      expect(screen.getByText('Entrega: R$ 9,25')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(createPedidoN8n).toHaveBeenCalledWith(
        expect.objectContaining({
          taxa_entrega: 9.25,
          valor_total: 87.25,
        })
      );
    });

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/557391473811?text=')
      );
    });

    const whatsappUrl = vi.mocked(window.location.assign).mock.calls[0][0];
    const encodedMessage = String(whatsappUrl).split('text=')[1];
    const message = decodeURIComponent(encodedMessage);

    expect(message).toContain('Taxa de delivery: R$ 9,25');
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

  it('does not show delivery fee values in neighborhood selection', async () => {
    const user = await addItemAndOpenCheckout();

    await user.click((await screen.findByText(/Selecione o bairro/i)).closest('button')!);

    expect(screen.getByRole('option', { name: 'Centro' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pontal' })).toBeInTheDocument();
    expect(screen.queryByText(/Qui\/Sex/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feriado/i)).not.toBeInTheDocument();
    expect(fetchDeliveryFeeN8n).not.toHaveBeenCalled();
  });

  it('blocks checkout when delivery is not available today', async () => {
    vi.mocked(fetchDeliveryFeeN8n).mockImplementation(async ({ bairro }) => {
      if (bairro === 'Centro') {
        return {
          bairro: 'Centro',
          taxa: null,
          encontrado: true,
          entrega_disponivel: false,
          regra_aplicada: 'sem_entrega',
          motivo_indisponivel: 'Hoje não há entrega normal para este bairro.',
          observacao: null,
        };
      }

      return {
        bairro,
        taxa: 8,
        encontrado: true,
        entrega_disponivel: true,
        regra_aplicada: 'quinta_sexta',
        observacao: null,
      };
    });
    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckout(user, 'Centro');
    await waitFor(() => {
      expect(fetchDeliveryFeeN8n).toHaveBeenCalledWith({ bairro: 'Centro' });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i })).toBeDisabled();
    });
    expect(createPedidoN8n).not.toHaveBeenCalled();
  });

  it('opens WhatsApp with delivery fee pending when neighborhood is not registered', async () => {
    vi.mocked(fetchDeliveryZonesN8n).mockResolvedValueOnce([]);
    vi.mocked(fetchDeliveryFeeN8n).mockResolvedValue({
      bairro: 'Novo Bairro',
      taxa: null,
      encontrado: false,
      entrega_disponivel: false,
      regra_aplicada: null,
      motivo_indisponivel: 'Bairro não cadastrado.',
      observacao: null,
    });

    const user = await addItemAndOpenCheckout();

    await fillRequiredCheckoutManually(user, 'Novo Bairro');
    await waitFor(() => {
      expect(screen.getByText('Entrega: A confirmar')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Enviar pedido no WhatsApp/i }));

    await waitFor(() => {
      expect(createPedidoN8n).toHaveBeenCalledWith(
        expect.objectContaining({
          bairro_cliente: 'Novo Bairro',
          subtotal: 78,
          valor_total: 78,
        })
      );
    });

    const payload = vi.mocked(createPedidoN8n).mock.calls[0][0];
    expect(payload.taxa_entrega).toBeUndefined();

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/557391473811?text=')
      );
    });

    const whatsappUrl = vi.mocked(window.location.assign).mock.calls[0][0];
    const encodedMessage = String(whatsappUrl).split('text=')[1];
    const message = decodeURIComponent(encodedMessage);

    expect(message).toContain('Taxa de delivery: A confirmar');
    expect(message).toContain('Total do pedido: A confirmar');
  });

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
