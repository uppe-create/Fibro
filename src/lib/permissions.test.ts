import { describe, expect, it } from 'vitest';
import { canAccessPublicTab, canAccessTab, getDefaultTabForRole, getRoleLabel, hasPermission, normalizeRole } from '@/lib/permissions';

describe('permissions', () => {
  it('normalizes supported role aliases', () => {
    expect(normalizeRole('administrador')).toBe('admin');
    expect(normalizeRole('atendente')).toBe('attendant');
    expect(normalizeRole('user')).toBe('viewer');
    expect(normalizeRole('unknown')).toBe('viewer');
  });

  it('keeps sensitive actions admin-only', () => {
    expect(hasPermission({ role: 'admin' }, 'clearDatabase')).toBe(true);
    expect(hasPermission({ role: 'attendant' }, 'clearDatabase')).toBe(false);
    expect(hasPermission({ role: 'viewer' }, 'clearDatabase')).toBe(false);
  });

  it('allows public tabs without auth and routes roles to safe defaults', () => {
    expect(canAccessTab(null, 'validar')).toBe(true);
    expect(canAccessPublicTab('configuracoes')).toBe(true);
    expect(canAccessPublicTab('dashboard')).toBe(false);
    expect(canAccessTab({ role: 'attendant' }, 'operacao')).toBe(true);
    expect(getDefaultTabForRole('admin')).toBe('dashboard');
    expect(getDefaultTabForRole('attendant')).toBe('pessoas');
    expect(getDefaultTabForRole('viewer')).toBe('configuracoes');
    expect(getRoleLabel('consulta')).toBe('Consulta');
  });
});
