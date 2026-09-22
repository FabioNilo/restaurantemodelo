import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { loginAdminN8n } from '@/features/integrations/marmitas-api';

vi.mock('@/features/integrations/marmitas-api', () => ({
  loginAdminN8n: vi.fn().mockResolvedValue({
    access_token: 'token',
    user: {
      id: 'admin-1',
      username: 'admin-teste',
      role: 'admin',
    },
  }),
  logoutAdminN8n: vi.fn().mockResolvedValue(undefined),
  changeAdminCredentialsN8n: vi.fn().mockResolvedValue({
    access_token: 'token-updated',
    user: {
      id: 'admin-1',
      username: 'admin-teste',
      role: 'admin',
    },
  }),
  validateStoredAdminSessionN8n: vi.fn().mockResolvedValue(null),
}));

function LoginProbe() {
  const { signIn, user } = useAuth();

  return (
    <div>
      <button type="button" onClick={() => signIn('admin-teste', 'senha-teste-123')}>
        Login
      </button>
      <span>{user?.username ?? 'sem usuario'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  it('sends username and password to n8n login', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(loginAdminN8n).toHaveBeenCalledWith({
        username: 'admin-teste',
        password: 'senha-teste-123',
      });
    });
    expect(screen.getByText('admin-teste')).toBeInTheDocument();
  });
});
