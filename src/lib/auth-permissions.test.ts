import { describe, expect, it } from 'vitest';
import { getUserPermissions } from './auth-permissions';

describe('getUserPermissions', () => {
  it('gives full access to admin users', () => {
    const permissions = getUserPermissions({ role: 'admin' });

    expect(permissions.canAccessAdminPanel).toBe(true);
    expect(permissions.canManageSettings).toBe(true);
    expect(permissions.canManageFullMenu).toBe(true);
    expect(permissions.canManageCrm).toBe(true);
    expect(permissions.canManageCashier).toBe(true);
    expect(permissions.canManageUsers).toBe(true);
  });

  it('limits gestor users to CRM and stock', () => {
    const permissions = getUserPermissions({ role: 'gestor' });

    expect(permissions.canAccessAdminPanel).toBe(true);
    expect(permissions.canManageSettings).toBe(false);
    expect(permissions.canManageFullMenu).toBe(false);
    expect(permissions.canManageStock).toBe(true);
    expect(permissions.canManageCrm).toBe(true);
    expect(permissions.canManageCashier).toBe(false);
    expect(permissions.canManageUsers).toBe(false);
  });
});
