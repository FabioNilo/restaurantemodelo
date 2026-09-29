import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProductCard } from './ProductCard';
import { CartProvider, useCart } from '@/context/CartContext';
import { produtoComTamanhos } from '@/test/fixtures';

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
    const produto = produtoComTamanhos;

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

  it('uses a dropdown for many flavors and adds the chosen flavor with its price', async () => {
    const user = userEvent.setup();
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
        { codigo: 'opcao_chocolate', nome: 'Chocolate', serve: '', preco: 10 },
        { codigo: 'opcao_pistache', nome: 'Pistache', serve: '', preco: 13.9 },
      ],
    };

    render(
      <CartProvider>
        <ProductCard marmita={picole} categoriaNome="Picolés e sorvetes" index={0} />
        <CartProbe />
      </CartProvider>
    );

    expect(screen.queryByRole('button', { name: /Pistache/i })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Escolha o sabor/i), 'opcao_pistache');
    expect(screen.getByText('R$ 13,90', { selector: 'p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Adicionar/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Pistache adicionado ao carrinho');
    expect(screen.getByLabelText('cart-summary')).toHaveTextContent('Picolé|Pistache|1');
    expect(screen.getByLabelText('cart-summary')).toHaveTextContent('Total:13.9');
  });
});
