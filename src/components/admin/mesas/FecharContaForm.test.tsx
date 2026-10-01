import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FecharContaForm } from './FecharContaForm';

describe('FecharContaForm', () => {
  it('fecha com uma forma de pagamento pelo total, sem digitar valor', async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    render(<FecharContaForm total={24.9} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

    expect(screen.queryByRole('radio', { name: /Dinheiro/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Débito' }));
    await user.click(screen.getByRole('button', { name: /Fechar conta e liberar mesa/i }));

    expect(onFechar).toHaveBeenCalledWith([{ metodo: 'cartao_debito', valor: 24.9 }]);
  });

  it('divide o pagamento e completa o que falta', async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    render(<FecharContaForm total={24} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

    await user.click(screen.getByRole('button', { name: /Dividir pagamento/i }));
    const valor2 = screen.getByLabelText('Valor do pagamento 2');
    await user.clear(valor2);
    await user.type(valor2, '2');
    expect(screen.getByRole('button', { name: /Fechar conta/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Completar R\$/i }));
    await user.click(screen.getByRole('button', { name: /Fechar conta e liberar mesa/i }));

    expect(onFechar).toHaveBeenCalledWith([
      { metodo: 'pix', valor: 12 },
      { metodo: 'cartao_debito', valor: 12 },
    ]);
  });

  it('bloqueia com pedido em andamento', () => {
    render(<FecharContaForm total={24} pedidosEmAndamento={1} enviando={false} onFechar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Fechar conta/i })).toBeDisabled();
    expect(screen.getByText(/Ainda há pedidos em andamento/i)).toBeInTheDocument();
  });
});
