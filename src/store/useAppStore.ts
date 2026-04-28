import { create } from 'zustand';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { hasPermission, normalizeRole, type UserRole } from '@/lib/permissions';
import type { RegistrationStatus } from '@/lib/registration-status';

const LOCAL_AUTH_STORAGE_KEY = 'cipf_local_auth';
const LOGIN_ATTEMPTS_STORAGE_KEY = 'cipf_login_attempts';
const LOGIN_LOCK_UNTIL_STORAGE_KEY = 'cipf_login_lock_until';

export const SESSION_ACTIVITY_STORAGE_KEY = 'cipf_last_activity';
export const SESSION_LOGIN_AT_STORAGE_KEY = 'cipf_login_at';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  ip: string;
  timestamp: string;
  action: string;
  reason?: string;
};

type LocalCredential = {
  username: string;
  passwordHash: string;
  role: UserRole;
  name: string;
};

// Mirrors the Supabase registrations table. Keep this in sync when adding
// fields used by dashboard, print, validation or export flows.
export type CIPFRegistration = {
  id: string;
  fullName: string;
  cpf: string;
  cns?: string;
  phone?: string;
  birthDate: string;
  legalGuardian?: string;
  photoUrl: string;
  issueDate: string;
  expiryDate: string;
  status: RegistrationStatus;
  signature?: string;
  visualSignature?: string;
  documentUrl?: string;
  proofOfResidenceUrl?: string;
  medicalReportUrl?: string;
  photoFileId?: string;
  documentFileId?: string;
  proofOfResidenceFileId?: string;
  medicalReportFileId?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cid?: string;
  justificativaCid?: string;
  crm?: string;
  proofOfResidenceDate?: string;
  medicalReportDate?: string;
  checksum?: string;
};

type AppState = {
  isAuthReady: boolean;
  currentUser: AppUser | null;
  registrations: CIPFRegistration[];
  lastBackupDate: number | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setCurrentUser: (user: AppUser | null) => void;
  loginWithLocalCredentials: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logAudit: (action: string, reason?: string, registrationId?: string) => Promise<void>;
  fetchRegistrations: () => Promise<void>;
  exportDatabase: () => Promise<void>;
  clearDatabase: () => Promise<void>;
};

const asInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

export function getSessionSecurityConfig() {
  const env = (import.meta as any).env || {};
  const idleTimeoutMinutes = asInt(env.VITE_SESSION_IDLE_TIMEOUT_MINUTES, 20, 5, 240);
  const maxSessionHours = asInt(env.VITE_SESSION_MAX_DURATION_HOURS, 12, 1, 72);
  const loginMaxAttempts = asInt(env.VITE_LOGIN_MAX_ATTEMPTS, 5, 3, 10);
  const lockoutMinutes = asInt(env.VITE_LOGIN_LOCKOUT_MINUTES, 15, 1, 120);

  return {
    idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
    maxSessionMs: maxSessionHours * 60 * 60 * 1000,
    loginMaxAttempts,
    lockoutMinutes
  };
}

const getLocalUserSession = (): AppUser | null => {
  const raw = sessionStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppUser;
    return { ...parsed, role: normalizeRole(parsed.role) };
  } catch {
    sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    return null;
  }
};

// Login lockout is client-side UX protection for the local MVP login. It is not
// a replacement for server-side authentication/rate limiting in production.
const readFailedAttempts = (): number => Number(localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY) || '0');
const writeFailedAttempts = (value: number) => localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, String(Math.max(0, value)));
const readLockUntil = (): number => Number(localStorage.getItem(LOGIN_LOCK_UNTIL_STORAGE_KEY) || '0');

const clearLoginGuards = () => {
  localStorage.removeItem(LOGIN_ATTEMPTS_STORAGE_KEY);
  localStorage.removeItem(LOGIN_LOCK_UNTIL_STORAGE_KEY);
};

// MVP login supports one env user or a JSON array of users. Useful for testing
// roles, but production should move to Supabase Auth or a backend.
const readLocalCredentials = (env: Record<string, unknown>): LocalCredential[] => {
  const rawUsers = String(env.VITE_LOCAL_USERS_JSON || env.VITE_LOCAL_USERS || '').trim();
  if (rawUsers) {
    try {
      const parsed = JSON.parse(rawUsers);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => ({
            username: String(item?.username || '').trim().toLowerCase(),
            passwordHash: String(item?.passwordHash || item?.password_hash || '').trim().toLowerCase(),
            role: normalizeRole(item?.role),
            name: String(item?.name || item?.username || 'Usuario Local').trim().toUpperCase()
          }))
          .filter((item) => item.username && item.passwordHash);
      }
    } catch {
      console.error('VITE_LOCAL_USERS_JSON invalido. Use um JSON de usuarios locais.');
    }
  }

  const configuredUser = String(env.VITE_LOCAL_LOGIN_USERNAME || '').trim().toLowerCase();
  const configuredHash = String(env.VITE_LOCAL_LOGIN_PASSWORD_HASH || '').trim().toLowerCase();
  if (!configuredUser || !configuredHash) return [];

  return [
    {
      username: configuredUser,
      passwordHash: configuredHash,
      role: normalizeRole(env.VITE_LOCAL_LOGIN_ROLE || 'admin'),
      name: String(env.VITE_LOCAL_LOGIN_NAME || 'SEC SAUDE').trim().toUpperCase()
    }
  ];
};

const sha256Hex = async (input: string): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const useAppStore = create<AppState>((set, get) => ({
  isAuthReady: true,
  currentUser: getLocalUserSession(),
  registrations: [],
  lastBackupDate: parseInt(localStorage.getItem('lastBackupDate') || '0', 10) || null,
  activeTab: (() => {
    const path = window.location.pathname.replace('/', '');
    return ['valida', 'carteirinha', 'cadastro', 'dashboard', 'configuracoes', 'dev'].includes(path) ? path : 'valida';
  })(),
  setActiveTab: (tab: string) => {
    set({ activeTab: tab });
    window.history.pushState({}, '', `/${tab === 'valida' ? '' : tab}`);
  },
  setCurrentUser: (user) => {
    if (user) {
      sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(SESSION_LOGIN_AT_STORAGE_KEY, String(Date.now()));
      localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
    } else {
      sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    }
    set({ currentUser: user });
  },
  logAudit: async (action: string, reason?: string, registrationId?: string) => {
    const user = get().currentUser;
    await logAuditEvent({
      action,
      reason,
      registrationId: registrationId || null,
      userId: user?.id || null,
      userName: user?.name || 'Sistema'
    });
  },
  loginWithLocalCredentials: async (username: string, password: string) => {
    const env = (import.meta as any).env || {};
    const localCredentials = readLocalCredentials(env);
    const { loginMaxAttempts, lockoutMinutes } = getSessionSecurityConfig();

    if (localCredentials.length === 0) {
      throw new Error('Login local indisponível neste ambiente.');
    }

    const now = Date.now();
    const lockUntil = readLockUntil();
    if (lockUntil > now) {
      const remainingMinutes = Math.ceil((lockUntil - now) / 60000);
      throw new Error(`Acesso temporariamente bloqueado. Tente novamente em ${remainingMinutes} minuto(s).`);
    }

    const normalizedUsername = username.trim().toLowerCase();
    const providedHash = await sha256Hex(password);
    const matchedCredential = localCredentials.find((credential) => credential.username === normalizedUsername);
    const isValid = Boolean(matchedCredential && providedHash === matchedCredential.passwordHash);

    if (!isValid) {
      const attempts = readFailedAttempts() + 1;
      writeFailedAttempts(attempts);
      await logAuditEvent({
        action: 'Tentativa de Login Falha',
        userName: normalizedUsername || 'usuario-desconhecido',
        reason: `Tentativa ${attempts}/${loginMaxAttempts}`
      });

      if (attempts >= loginMaxAttempts) {
        const newLockUntil = now + lockoutMinutes * 60000;
        localStorage.setItem(LOGIN_LOCK_UNTIL_STORAGE_KEY, String(newLockUntil));
        writeFailedAttempts(0);
        await logAuditEvent({
          action: 'Bloqueio de Login Ativado',
          userName: normalizedUsername || 'usuario-desconhecido',
          reason: `Bloqueio por ${lockoutMinutes} min`
        });
        throw new Error(`Muitas tentativas inválidas. Acesso bloqueado por ${lockoutMinutes} minutos.`);
      }

      throw new Error('Credenciais inválidas.');
    }

    clearLoginGuards();

    const localUser: AppUser = {
      id: `local-${matchedCredential!.username}`,
      name: matchedCredential!.name,
      email: `${matchedCredential!.username}@local`,
      role: matchedCredential!.role
    };

    sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(localUser));
    localStorage.setItem(SESSION_LOGIN_AT_STORAGE_KEY, String(Date.now()));
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
    set({ currentUser: localUser, isAuthReady: true });

    await logAuditEvent({
      action: 'Login com Credencial Local',
      userId: localUser.id,
      userName: localUser.name,
      reason: 'Acesso autorizado'
    });
  },
  logout: async () => {
    const user = get().currentUser;
    sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    localStorage.removeItem(SESSION_LOGIN_AT_STORAGE_KEY);
    localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
    set({ currentUser: null, registrations: [] });

    await logAuditEvent({
      action: 'Logout',
      userId: user?.id || null,
      userName: user?.name || 'Sistema',
      reason: 'Encerramento de sessao'
    });
  },
  exportDatabase: async () => {
    const { registrations, fetchRegistrations } = get();
    let dataToExport = registrations;
    if (dataToExport.length === 0) {
      await fetchRegistrations();
      dataToExport = get().registrations;
    }

    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', `backup_cipf_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(url);

    const now = Date.now();
    localStorage.setItem('lastBackupDate', now.toString());
    set({ lastBackupDate: now });
    await get().logAudit('Backup JSON Exportado');
  },
  clearDatabase: async () => {
    const { currentUser } = get();
    if (!hasPermission(currentUser, 'clearDatabase')) {
      throw new Error('Apenas administradores podem limpar o banco de dados.');
    }

    assertSupabaseConfigured();

    const deleteTable = async (table: string, key: string) => {
      const { error } = await supabase.from(table).delete().not(key, 'is', null);
      if (error) throw error;
    };

    try {
      await deleteTable('audit_logs', 'id');
      await deleteTable('public_validations', 'id');
      await deleteTable('registration_index', 'cpf');
      await deleteTable('registrations', 'id');
      await deleteTable('cipf_file_chunks', 'file_id');
      await deleteTable('cipf_files', 'id');
      set({ registrations: [] });
      await get().logAudit('Limpeza de Banco', 'Remocao total dos dados');
    } catch (error) {
      console.error('Erro ao limpar banco de dados:', error);
      throw error;
    }
  },
  fetchRegistrations: async () => {
    // Dashboard and restricted print flows read private records. Public QR
    // validation must stay on public_validations/validate_cipf only.
    const { currentUser } = get();
    if (!hasPermission(currentUser, 'viewCarteirinha') && !hasPermission(currentUser, 'viewDashboard')) return;

    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('issueDate', { ascending: false });

      if (error) {
        if ((error as any).code === 'PGRST205') {
          throw new Error(
            'Tabelas do Supabase nao estao disponiveis para este projeto/chave. Execute o script supabase-schema.sql no SQL Editor.'
          );
        }
        throw error;
      }

      set({ registrations: (data || []) as CIPFRegistration[] });
    } catch (error) {
      console.error('Failed to fetch registrations', error);
      set({ registrations: [] });
      throw error;
    }
  }
}));
