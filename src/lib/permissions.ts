export type UserRole = 'admin' | 'attendant' | 'viewer';

// Central permission matrix. New sensitive actions should be added here first,
// then consumed with hasPermission(...) where the UI renders or executes them.
export type Permission =
  | 'viewCarteirinha'
  | 'printCarteirinha'
  | 'viewDashboard'
  | 'createRegistration'
  | 'editRegistration'
  | 'approveRegistration'
  | 'issueRegistration'
  | 'cancelRegistration'
  | 'renewRegistration'
  | 'reissueRegistration'
  | 'deleteRegistration'
  | 'exportDashboard'
  | 'clearDatabase'
  | 'viewDocuments'
  | 'viewHistory'
  | 'viewSettings'
  | 'useDevTools';

type UserLike = {
  role?: string | null;
} | null | undefined;

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'viewCarteirinha',
    'printCarteirinha',
    'viewDashboard',
    'createRegistration',
    'editRegistration',
    'approveRegistration',
    'issueRegistration',
    'cancelRegistration',
    'renewRegistration',
    'reissueRegistration',
    'deleteRegistration',
    'exportDashboard',
    'clearDatabase',
    'viewDocuments',
    'viewHistory',
    'viewSettings',
    'useDevTools'
  ],
  attendant: [
    'viewDashboard',
    'createRegistration',
    'editRegistration',
    'approveRegistration',
    'renewRegistration',
    'viewDocuments',
    'viewHistory',
    'viewSettings'
  ],
  viewer: ['viewSettings']
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  attendant: 'Atendente',
  viewer: 'Consulta'
};

// Accept old/env-friendly aliases so saved sessions and env values keep working
// if UI wording changes, e.g. "user" -> "viewer" / "consulta".
export function normalizeRole(role: unknown): UserRole {
  const value = String(role || '').trim().toLowerCase();
  if (['admin', 'administrador'].includes(value)) return 'admin';
  if (['attendant', 'atendente'].includes(value)) return 'attendant';
  if (['viewer', 'consulta', 'consultation', 'user'].includes(value)) return 'viewer';
  return 'viewer';
}

export function getRoleLabel(role: unknown): string {
  return ROLE_LABELS[normalizeRole(role)];
}

export function hasPermission(user: UserLike, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[normalizeRole(user.role)].includes(permission);
}

export function canAccessTab(user: UserLike, tab: string): boolean {
  if (tab === 'valida') return true;
  if (tab === 'carteirinha') return hasPermission(user, 'printCarteirinha');
  if (tab === 'cadastro') return hasPermission(user, 'createRegistration');
  if (tab === 'dashboard') return hasPermission(user, 'viewDashboard');
  if (tab === 'configuracoes') return hasPermission(user, 'viewSettings');
  if (tab === 'dev') return hasPermission(user, 'useDevTools');
  return false;
}

export function getDefaultTabForRole(role: unknown): string {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'admin') return 'dashboard';
  if (normalizedRole === 'attendant') return 'cadastro';
  return 'valida';
}
