import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCredentialsCard } from './AdminCredentialsCard';

const authMocks = vi.hoisted(() => ({
  changeCredentials: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      username: 'admin-atual',
      role: 'admin',
    },
    changeCredentials: authMocks.changeCredentials,
  }),
}));

describe('AdminCredentialsCard', () => {
  beforeEach(() => {
    authMocks.changeCredentials.mockClear();
  });

  it('validates confirmation before sending credential changes', async () => {
    const user = userEvent.setup();

    render(<AdminCredentialsCard />);

    await user.type(screen.getByLabelText(/Senha atual/i), 'senha-atual-123');
    await user.type(screen.getByLabelText(/^Nova senha/i), 'senha-nova-456');
    await user.type(screen.getByLabelText(/Confirmar nova senha/i), 'outra-senha-456');
    await user.click(screen.getByRole('button', { name: /Salvar credenciais/i }));

    expect(authMocks.changeCredentials).not.toHaveBeenCalled();
  });

  it('sends username and password change payload', async () => {
    const user = userEvent.setup();

    render(<AdminCredentialsCard />);

    await user.clear(screen.getByLabelText(/Novo usuário/i));
    await user.type(screen.getByLabelText(/Novo usuário/i), 'admin-novo');
    await user.type(screen.getByLabelText(/Senha atual/i), 'senha-atual-123');
    await user.type(screen.getByLabelText(/^Nova senha/i), 'senha-nova-456');
    await user.type(screen.getByLabelText(/Confirmar nova senha/i), 'senha-nova-456');
    await user.click(screen.getByRole('button', { name: /Salvar credenciais/i }));

    expect(authMocks.changeCredentials).toHaveBeenCalledWith({
      username: 'admin-atual',
      currentPassword: 'senha-atual-123',
      newUsername: 'admin-novo',
      newPassword: 'senha-nova-456',
    });
  });
});
