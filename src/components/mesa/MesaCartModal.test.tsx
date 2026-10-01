import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MesaCartModal } from './MesaCartModal';
import { ProductCard } from '@/components/ProductCard';
import { CartProvider } from '@/context/CartContext';
import { buildMesaReceiptLines } from '@/lib/thermal-label-pdf';

const { createPedidoMesaMock, toastMock } = vi.hoisted(() => ({ createPedidoMesaMock: vi.fn(), toastMock: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ toast: toastMock, useToast: () => ({ toast: toastMock, toasts: [] }) }));

vi.mock('@/features/integrations/marmitas-api', async () => {
  const actual = await vi.importActual<typeof import('@/features/integrations/marmitas-api')>('@/features/integrations/marmitas-api');
  return { ...actual, createPedidoMesa: createPedidoMesaMock };
});

const picole = {
  id: 'picole',
  nome: 'Picolé',
  descricao: null,
  categoria_id: 'picoles',
  preco: 8,
  estoque: 99,
  imagem_url: null,
  disponivel: true,
  tamanhos: [
    { codigo: 'opcao_morango', nome: 'Morango', serve: '', preco: 8 },
    { codigo: 'opcao_coco', nome: 'Coco', serve: '', preco: 9.5 },
    { codigo: 'opcao_limao', nome: 'Limão', serve: '', preco: 8 },
    { codigo: 'opcao_pistache', nome: 'Pistache', serve: '', preco: 13.9 },
  ],
};

function renderMesa() {
  const onVerConta = vi.fn();

  render(
    <QueryClientProvider client={new QueryClient()}>
      <CartProvider>
        <ProductCard marmita={picole} categoriaNome="Picolés e sorvetes" index={0} />
        <MesaCartModal isOpen onClose={() => undefined} token="token-mesa-5" mesaNome="Mesa 5" onVerConta={onVerConta} />
      </CartProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  createPedidoMesaMock.mockReset();
  toastMock.mockReset();
});

describe('MesaCartModal', () => {
  it('envia só produto, opção e quantidade — sem preço, endereço ou WhatsApp', async () => {
    const user = userEvent.setup();
    createPedidoMesaMock.mockResolvedValue({ numero: 12, status: 'novo', valor_total: 27.8 });
    renderMesa();

    await user.selectOptions(screen.getByLabelText(/Escolha o sabor/i), 'opcao_pistache');
    await user.click(screen.getByRole('button', { name: /Adicionar/i }));
    await user.click(screen.getByRole('button', { name: /Aumentar Picolé/i }));
    await user.click(screen.getByRole('button', { name: /Continuar/i }));

    expect(screen.queryByLabelText(/Endereço/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Telefone/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Seu nome/i), 'Ana');
    await user.type(screen.getByLabelText(/Observações/i), 'sem calda');
    await user.click(screen.getByRole('button', { name: /Enviar pedido para o caixa/i }));

    expect(createPedidoMesaMock).toHaveBeenCalledWith('token-mesa-5', {
      nome_cliente: 'Ana',
      observacoes: 'sem calda',
      itens: [{ produto_id: 'picole', tamanho_codigo: 'opcao_pistache', quantidade: 2 }],
    });
    expect(await screen.findByText(/Pedido nº 12 recebido/i)).toBeInTheDocument();
  });

  it('mostra o erro da API sem limpar o carrinho', async () => {
    const user = userEvent.setup();
    createPedidoMesaMock.mockRejectedValue(new Error(JSON.stringify({ success: false, error: 'Esta mesa não está recebendo pedidos agora.' })));
    renderMesa();

    await user.click(screen.getByRole('button', { name: /Adicionar/i }));
    await user.click(screen.getByRole('button', { name: /Continuar/i }));
    await user.click(screen.getByRole('button', { name: /Enviar pedido para o caixa/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pedido não enviado', description: 'Esta mesa não está recebendo pedidos agora.', variant: 'destructive' })
    );
    expect(screen.getByRole('button', { name: /Enviar pedido para o caixa/i })).toBeInTheDocument();
  });
});

describe('cupom da mesa', () => {
  it('destaca a mesa e o número do pedido, com o nome da marca', () => {
    const lines = buildMesaReceiptLines(
      {
        numero: 12,
        nome_cliente: 'Ana',
        observacoes: 'sem calda',
        valor_total: 27.8,
        created_at: '2026-09-30T15:30:00.000Z',
        itens: [{ nome: 'Picolé', quantidade: 2, preco: 13.9, tamanho_nome: 'Pistache' }],
      },
      'Mesa 5'
    ).map((line) => line.text);

    expect(lines).toEqual(expect.arrayContaining(['NOSSO BISTRÔ CAFÉ', 'MESA 5', 'PEDIDO N 12', '2x PICOLÉ', 'OPCAO: PISTACHE', 'TOTAL: R$ 27,80', 'SEM CALDA']));
    expect(lines.join(' ')).not.toMatch(/ENTREGA|END:/);
  });
});
