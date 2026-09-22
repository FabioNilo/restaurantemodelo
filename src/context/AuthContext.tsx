import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  loginAdminN8n,
  logoutAdminN8n,
  changeAdminCredentialsN8n,
  validateStoredAdminSessionN8n,
} from '@/features/integrations/marmitas-api';
import type { AuthSession, AuthUser } from '@/features/integrations/n8n-contracts';
import { getUserPermissions, type UserPermissions } from '@/lib/auth-permissions';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  isAdmin: boolean;
  permissions: UserPermissions;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  changeCredentials: (data: {
    username: string;
    currentPassword: string;
    newUsername: string;
    newPassword: string;
  }) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const permissions = getUserPermissions(user);

  useEffect(() => {
    let active = true;

    validateStoredAdminSessionN8n()
      .then((storedSession) => {
        if (!active) {
          return;
        }

        setSession(storedSession);
        setUser(storedSession?.user ?? null);
        setIsAdmin(storedSession?.user?.role === 'admin');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const nextSession = await loginAdminN8n({ username, password });

      setSession(nextSession);
      setUser(nextSession.user);
      setIsAdmin(nextSession.user.role === 'admin');

      if (!getUserPermissions(nextSession.user).canAccessAdminPanel) {
        return { error: new Error('Usuário sem permissão para acessar o painel.') };
      }

      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Não foi possível entrar.') };
    }
  };

  const signUp = async (username: string, password: string) => {
    void username;
    void password;
    return { error: new Error('Cadastro público desativado. Crie usuários no PostgreSQL/n8n.') };
  };

  const signOut = async () => {
    await logoutAdminN8n();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
  };

  const changeCredentials: AuthContextType['changeCredentials'] = async (data) => {
    try {
      const nextSession = await changeAdminCredentialsN8n(data);
      setSession(nextSession);
      setUser(nextSession.user);
      setIsAdmin(nextSession.user.role === 'admin');
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Não foi possível atualizar as credenciais.'),
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, permissions, signIn, signUp, signOut, changeCredentials }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
