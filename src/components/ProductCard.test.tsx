import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './ProductCard';
import { CartProvider, useCart } from '@/context/CartContext';
import { produtosCardapio } from '@/data/cardapio';

function CartProbe() {
  const { items, totalPrice } = useCart();

  return (
    <div aria-label="cart-summary">
      {items.map((item) => `${item.nome}|${item.tamanho_nome}|${item.quantidade}`).join(',')}
      Total:{totalPrice}
    </div>
  );
}

describe('ProductCard', () => {
  it('requires the customer to choose a box size before adding to cart', async () => {
    const user = userEvent.setup();
    const produto = produtosCardapio.find((item) => item.id === 'file-ao-molho-madeira')!;

    render(
      <CartProvider>
        <ProductCard marmita={produto} categoriaNome="Gnocchi" index={0} />
        <CartProbe />
      </CartProvider>
    );

    await user.click(screen.getByRole('button', { name: /\bG\b/i }));
    await user.click(screen.getByRole('button', { name: /Adicionar/i }));

    expect(screen.getByLabelText('Uma pessoa')).toBeInTheDocument();
    expect(screen.getByLabelText('Duas pessoas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\bG\b/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('G adicionado ao carrinho');
    expect(screen.queryByText(/Penne sem gl/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('cart-summary')).toHaveTextContent('Filé ao Molho Madeira');
    expect(screen.getByLabelText('cart-summary')).toHaveTextContent('Total:78');
  });

  it('shows beverage volumes and adds the selected volume to cart', async () => {
    const user = userEvent.setup();
    const bebida = {
      id: 'suco-uva',
      nome: 'Suco de Uva',
      descricao: 'Suco gelado.',
      categoria_id: 'bebidas',
      preco: 8,
      estoque: 12,
      imagem_url: null,
      disponivel: true,
      tamanhos: [
        { codigo: 'copo_300ml', nome: 'Copo', serve: '300 ml', preco: 8 },
        { codigo: 'garrafa_600ml', nome: 'Garrafa', serve: '600 ml', preco: 13 },
      ],
    };

    render(
      <CartProvider>
        <ProductCard marmita={bebida} categoriaNome="Bebidas" index={0} />
        <CartProbe />
      </CartProvider>
    );

    await user.click(screen.getByRole('button', { name: /Garrafa/i }));
    await user.click(screen.getByRole('button', { name: /Adicionar/i }));

    expect(screen.getAllByLabelText('Volume da bebida').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Garrafa/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Garrafa adicionado ao carrinho');
    expect(screen.getByLabelText('cart-summary')).toHaveTextContent('Suco de Uva|Garrafa|1');
    expect(screen.getByLabelText('cart-summary')).toHaveTextContent('Total:13');
  });
});
