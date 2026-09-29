import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarmitaForm } from './MarmitaForm';
import type { Marmita } from '@/types/product';

const produtoComFotoNoBucket: Marmita = {
  id: 'bolo-de-aipim',
  nome: 'Bolo de aipim',
  descricao: null,
  categoria_id: null,
  preco: 22,
  estoque: 5,
  disponivel: true,
  imagem_url: 'https://br-x.storage.c-13.us-east-1.aws.neon.tech/produtos/bolo-de-aipim/1.webp',
  tamanhos: [],
  created_at: null,
  updated_at: null,
};

describe('MarmitaForm', () => {
  it('mantém a foto já salva no storage ao editar outros campos', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);

    render(<MarmitaForm layout="page" isEditing marmita={produtoComFotoNoBucket} categorias={[]} onSave={onSave} />);

    expect(screen.getByAltText(/Preview da imagem/i)).toHaveAttribute('src', produtoComFotoNoBucket.imagem_url);

    await user.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ imagem_url: produtoComFotoNoBucket.imagem_url }));
  });
});

describe('preço do produto', () => {
  it.each([
    ['4,50', 4.5],
    ['4.50', 4.5],
    ['19,9', 19.9],
  ])('digitar "%s" grava %s', async (typed, expected) => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);

    render(<MarmitaForm layout="page" categorias={[]} onSave={onSave} />);

    await user.type(screen.getByLabelText(/Nome/i), 'Pão de queijo');
    await user.type(screen.getByLabelText(/Preço \(R\$\)/i), typed);
    await user.click(screen.getByRole('button', { name: /Criar produto/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ preco: expected }));
  });
});
