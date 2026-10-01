import type { AuthUser } from '@/features/integrations/n8n-contracts';

export type UserRole = 'admin' | 'gestor';

export interface UserPermissions {
  role: string | null;
  canAccessAdminPanel: boolean;
  canManageSettings: boolean;
  canManageFullMenu: boolean;
  canManageStock: boolean;
  canManageCrm: boolean;
  canManageCashier: boolean;
  canManageUsers: boolean;
  // Mesas/caixa (pedidos pelo QR code): o funcionário do caixa entra como gestor.
  canManageTables: boolean;
  // Métricas e Desempenho: só o dono (admin).
  canViewReports: boolean;
}

export function getUserPermissions(user: Pick<AuthUser, 'role'> | null | undefined): UserPermissions {
  const role = user?.role ?? null;
  const isAdmin = role === 'admin';
  const isManager = role === 'gestor';

  return {
    role,
    canAccessAdminPanel: isAdmin || isManager,
    canManageSettings: isAdmin,
    canManageFullMenu: isAdmin,
    canManageStock: isAdmin || isManager,
    canManageCrm: isAdmin || isManager,
    canManageCashier: isAdmin,
    canManageUsers: isAdmin,
    canManageTables: isAdmin || isManager,
    canViewReports: isAdmin,
  };
}
