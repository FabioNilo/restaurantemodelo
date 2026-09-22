import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Auth from './Auth';

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    signIn: authMocks.signIn,
  }),
}));

describe('Auth', () => {
  it('uses username and password to sign in', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>
    );

    expect(screen.queryByText(/inicial/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/credenciais fornecidas pelo administrador/i).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(/Usuário/i), 'admin-teste');
    await user.type(screen.getByLabelText(/Senha/i), 'senha-teste-123');
    await user.click(screen.getByRole('button', { name: /Entrar/i }));

    expect(authMocks.signIn).toHaveBeenCalledWith('admin-teste', 'senha-teste-123');
  });
});
