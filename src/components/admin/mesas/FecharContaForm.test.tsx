import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FecharContaForm } from './FecharContaForm';

describe('FecharContaForm', () => {
  it('fecha com uma forma de pagamento pelo total, sem digitar valor', async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    render(<FecharContaForm total={24.9} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

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

  it('mostra, em texto, a forma de pagamento escolhida', async () => {
    const user = userEvent.setup();
    render(<FecharContaForm total={24.9} pedidosEmAndamento={0} enviando={false} onFechar={vi.fn()} />);
    const resumo = () => screen.getByTestId('resumo-pagamento').textContent?.replace(/\s/g, ' ');

    expect(resumo()).toContain('Pix: R$ 24,90');
    await user.click(screen.getByRole('radio', { name: 'Crédito' }));
    expect(resumo()).toContain('Crédito: R$ 24,90');
    expect(resumo()).not.toContain('Pix:');
  });

  describe('dinheiro', () => {
    it('sem informar o recebido, fecha com o valor exato e sem troco', async () => {
      const user = userEvent.setup();
      const onFechar = vi.fn();
      render(<FecharContaForm total={27.8} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

      await user.click(screen.getByRole('radio', { name: 'Dinheiro' }));
      expect(screen.getByText('Valor exato, sem troco')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Fechar conta e liberar mesa/i }));

      expect(onFechar).toHaveBeenCalledWith([{ metodo: 'dinheiro', valor: 27.8, valor_recebido: 27.8 }]);
    });

    it('calcula o troco ao vivo e envia valor e valor recebido', async () => {
      const user = userEvent.setup();
      const onFechar = vi.fn();
      render(<FecharContaForm total={27.8} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

      await user.click(screen.getByRole('radio', { name: 'Dinheiro' }));
      const recebido = screen.getByLabelText('Valor recebido em dinheiro 1');
      await user.clear(recebido);
      await user.type(recebido, '50');

      expect(screen.getByText(/^Troco: R\$\s22,20$/)).toBeInTheDocument();
      const resumo = screen.getByTestId('resumo-pagamento').textContent?.replace(/\s/g, ' ');
      expect(resumo).toContain('Dinheiro: R$ 27,80 · recebido R$ 50,00 · troco R$ 22,20');
      expect(screen.getByText('Troco a devolver')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Fechar conta e liberar mesa/i }));
      expect(onFechar).toHaveBeenCalledWith([{ metodo: 'dinheiro', valor: 27.8, valor_recebido: 50 }]);
    });

    it('atalho de cédula preenche o recebido', async () => {
      const user = userEvent.setup();
      const onFechar = vi.fn();
      render(<FecharContaForm total={27.8} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

      await user.click(screen.getByRole('radio', { name: 'Dinheiro' }));
      await user.click(screen.getByRole('button', { name: /R\$\s50,00/ }));
      expect(screen.getByText(/^Troco: R\$\s22,20$/)).toBeInTheDocument();
    });

    it('bloqueia quando o cliente entregou menos que o valor em dinheiro', async () => {
      const user = userEvent.setup();
      render(<FecharContaForm total={27.8} pedidosEmAndamento={0} enviando={false} onFechar={vi.fn()} />);

      await user.click(screen.getByRole('radio', { name: 'Dinheiro' }));
      const recebido = screen.getByLabelText('Valor recebido em dinheiro 1');
      await user.clear(recebido);
      await user.type(recebido, '20');

      expect(screen.getByText(/Faltam R\$\s7,80 para cobrir o valor em dinheiro/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Fechar conta/i })).toBeDisabled();
    });

    it('dividido: Pix + dinheiro com troco só na parte em dinheiro', async () => {
      const user = userEvent.setup();
      const onFechar = vi.fn();
      render(<FecharContaForm total={24} pedidosEmAndamento={0} enviando={false} onFechar={onFechar} />);

      await user.click(screen.getByRole('button', { name: /Dividir pagamento/i }));
      await user.click(screen.getAllByRole('radio', { name: 'Dinheiro' })[1]);
      const recebido = screen.getByLabelText('Valor recebido em dinheiro 2');
      await user.clear(recebido);
      await user.type(recebido, '20');
      await user.click(screen.getByRole('button', { name: /Fechar conta e liberar mesa/i }));

      expect(onFechar).toHaveBeenCalledWith([
        { metodo: 'pix', valor: 12 },
        { metodo: 'dinheiro', valor: 12, valor_recebido: 20 },
      ]);
    });
  });

  it('usa título, botão e bloqueio próprios (venda no balcão)', () => {
    render(<FecharContaForm total={0} enviando={false} onFechar={vi.fn()} titulo="Receber pagamento" rotuloBotao="Registrar venda" bloqueio="Adicione ao menos um item à venda." />);

    expect(screen.getByRole('heading', { name: /Receber pagamento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar venda' })).toBeDisabled();
    expect(screen.getByText('Adicione ao menos um item à venda.')).toBeInTheDocument();
  });

  it('bloqueia com pedido em andamento', () => {
    render(<FecharContaForm total={24} pedidosEmAndamento={1} enviando={false} onFechar={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Fechar conta/i })).toBeDisabled();
    expect(screen.getByText(/Ainda há pedidos em andamento/i)).toBeInTheDocument();
  });
});
