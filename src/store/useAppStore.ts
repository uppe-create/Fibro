import { create } from 'zustand';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { buildAuditEvent, type AuditEventInput } from '@/lib/audit-events';
import { hasPermission, normalizeRole, type UserRole } from '@/lib/permissions';
import type { RegistrationStatus } from '@/lib/registration-status';
import { getAuthMode, getProductionAuthError } from '@/lib/auth-mode';

const LOCAL_AUTH_STORAGE_KEY = 'cipf_local_auth';
const LOGIN_ATTEMPTS_STORAGE_KEY = 'cipf_login_attempts';
const LOGIN_LOCK_UNTIL_STORAGE_KEY = 'cipf_login_lock_until';
const SESSION_LOCKED_STORAGE_KEY = 'cipf_session_locked';

export const SESSION_ACTIVITY_STORAGE_KEY = 'cipf_last_activity';
export const SESSION_LOGIN_AT_STORAGE_KEY = 'cipf_login_at';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  intendedRole?: UserRole;
  accessNotice?: 'admin_mfa_required';
};

export type MfaChallengeState = {
  required: boolean;
  email: string | null;
  error: string | null;
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
  patient_notified_at?: string | null;
  patient_notified_by?: string | null;
  patient_notification_channel?: string | null;
  picked_up_at?: string | null;
  picked_up_by?: string | null;
  pickup_note?: string | null;
  last_accessed_at?: string | null;
  last_accessed_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

type AppState = {
  isAuthReady: boolean;
  currentUser: AppUser | null;
  isSessionLocked: boolean;
  mfaChallenge: MfaChallengeState;
  registrations: CIPFRegistration[];
  lastBackupDate: number | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setCurrentUser: (user: AppUser | null) => void;
  initializeAuth: () => Promise<void>;
  loginWithLocalCredentials: (username: string, password: string) => Promise<void>;
  completeMfaChallenge: (code: string) => Promise<void>;
  cancelMfaChallenge: () => Promise<void>;
  clearMfaChallengeError: () => void;
  refreshCurrentUser: () => Promise<void>;
  lockSession: () => Promise<void>;
  unlockSession: () => Promise<void>;
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
  const idleTimeoutMinutes = asInt(env.VITE_SESSION_IDLE_TIMEOUT_MINUTES, 120, 5, 240);
  const maxSessionHours = asInt(env.VITE_SESSION_MAX_DURATION_HOURS, 24, 1, 72);
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

const isMissingColumnError = (error: unknown, columnName: string): boolean => {
  const message = String((error as any)?.message || '').toLowerCase();
  const details = String((error as any)?.details || '').toLowerCase();
  const hint = String((error as any)?.hint || '').toLowerCase();
  const target = columnName.toLowerCase();
  return [message, details, hint].some((value) => value.includes(target) && value.includes('does not exist'));
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

const SUPABASE_ROLE_FALLBACKS: Record<string, { role: UserRole; name: string }> = {
  'c640040c-e657-4fbe-8e97-7974c08091ca': { role: 'admin', name: 'SEC SAUDE' },
  'd4eea78f-7f9c-4661-ab80-b4ce3b9b3561': { role: 'attendant', name: 'ATENDENTE' }
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_MFA_CHALLENGE: MfaChallengeState = {
  required: false,
  email: null,
  error: null
};

const buildUserFromSupabaseAuth = async (user: SupabaseUser): Promise<AppUser> => {
  const fallback = SUPABASE_ROLE_FALLBACKS[user.id];
  const configuredRole = normalizeRole(user.app_metadata?.app_role || user.user_metadata?.app_role || user.user_metadata?.role || fallback?.role);
  let role = configuredRole;
  let name = String(user.user_metadata?.full_name || user.user_metadata?.name || fallback?.name || user.email || 'Usuario Supabase').trim();
  let intendedRole = configuredRole;

  try {
    const { data: rpcRole } = await supabase.rpc('current_app_role');
    if (rpcRole) role = normalizeRole(rpcRole);

    const { data } = await supabase.from('app_profiles').select('full_name, role').eq('id', user.id).maybeSingle();
    if (data?.role) intendedRole = normalizeRole(data.role);
    if (data?.full_name) name = String(data.full_name).trim();
  } catch {
    // app_profiles is optional during migration. Metadata keeps the login usable
    // until RLS/profile tables are fully enabled.
  }

  const accessNotice =
    intendedRole === 'admin' && role !== 'admin' ? 'admin_mfa_required' : undefined;

  return {
    id: user.id,
    name: name.toUpperCase(),
    email: user.email || `${user.id}@supabase.local`,
    role,
    intendedRole,
    accessNotice
  };
};

const isMfaChallengeRequired = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel;
};

export const useAppStore = create<AppState>((set, get) => ({
  isAuthReady: getAuthMode((import.meta as any).env || {}) !== 'supabase',
  currentUser:
    getProductionAuthError((import.meta as any).env || {}, Boolean((import.meta as any).env?.PROD)) ||
    getAuthMode((import.meta as any).env || {}) === 'supabase'
      ? null
      : getLocalUserSession(),
  isSessionLocked: localStorage.getItem(SESSION_LOCKED_STORAGE_KEY) === '1',
  mfaChallenge: EMPTY_MFA_CHALLENGE,
  registrations: [],
  lastBackupDate: parseInt(localStorage.getItem('lastBackupDate') || '0', 10) || null,
  activeTab: (() => {
    const path = window.location.pathname.replace('/', '');
    return [
      'inicio',
      'acessibilidade',
      'contato',
      'privacidade',
      'suporte',
      'termos',
      'validar',
      'valida',
      'cadastros',
      'carteirinha',
      'cadastro',
      'dashboard',
      'pessoas',
      'operacao',
      'documentos',
      'retiradas',
      'relatorios',
      'auditoria',
      'configuracoes',
      'dev'
    ].includes(path) ? ({ valida: 'validar', cadastros: 'pessoas' } as Record<string, string>)[path] || path : 'inicio';
  })(),
  setActiveTab: (tab: string) => {
    set({ activeTab: tab });
    const route = tab === 'pessoas' ? 'cadastros' : tab;
    window.history.pushState({}, '', `/${route === 'inicio' ? '' : route}`);
  },
  setCurrentUser: (user) => {
    if (user) {
      sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(SESSION_LOGIN_AT_STORAGE_KEY, String(Date.now()));
      localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
      localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
    } else {
      sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    }
    set({ currentUser: user, isSessionLocked: false });
  },
  initializeAuth: async () => {
    const env = (import.meta as any).env || {};
    const productionAuthError = getProductionAuthError(env, Boolean(env.PROD));
    if (productionAuthError) {
      sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      set({ currentUser: null, isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });
      return;
    }

    if (getAuthMode(env) !== 'supabase') {
      set({ currentUser: getLocalUserSession(), isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });
      return;
    }

    set({ isAuthReady: false });
    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
        set({ currentUser: null, isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });
        return;
      }

      if (await isMfaChallengeRequired()) {
        sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
        set({
          currentUser: null,
          isAuthReady: true,
          mfaChallenge: {
            required: true,
            email: data.session.user.email || null,
            error: null
          }
        });
        return;
      }

      const authUser = await buildUserFromSupabaseAuth(data.session.user);
      sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
      set({ currentUser: authUser, isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });
    } catch (error) {
      console.error('Falha ao restaurar sessao Supabase Auth.', error);
      sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      set({ currentUser: null, isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });
    }
  },
  logAudit: async (action: string, reason?: string, registrationId?: string) => {
    const user = get().currentUser;
    const fallbackEvent: AuditEventInput = { action, details: reason, registrationId: registrationId || null, userId: user?.id || null, userName: user?.name || 'Sistema' };
    await logAuditEvent(fallbackEvent);
  },
  loginWithLocalCredentials: async (username: string, password: string) => {
    const env = (import.meta as any).env || {};
    const productionAuthError = getProductionAuthError(env, Boolean(env.PROD));
    if (productionAuthError) {
      throw new Error(productionAuthError);
    }

    if (getAuthMode(env) === 'supabase') {
      assertSupabaseConfigured();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password
      });
      if (error || !data.user) throw new Error(error?.message || 'Credenciais invalidas no Supabase Auth.');

      if (await isMfaChallengeRequired()) {
        sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
        set({
          currentUser: null,
          isAuthReady: true,
          mfaChallenge: {
            required: true,
            email: data.user.email || username.trim(),
            error: null
          }
        });
        return;
      }

      const authUser = await buildUserFromSupabaseAuth(data.user);
      sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
      localStorage.setItem(SESSION_LOGIN_AT_STORAGE_KEY, String(Date.now()));
      localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
      localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
      set({ currentUser: authUser, isSessionLocked: false, isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });

      await logAuditEvent(buildAuditEvent('auth.login.supabase', { userId: authUser.id, userName: authUser.name, details: `Perfil ${authUser.role}` }));
      return;
    }

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
      await logAuditEvent(buildAuditEvent('auth.login_failed', { userName: normalizedUsername || 'usuario-desconhecido', details: `Tentativa ${attempts}/${loginMaxAttempts}` }));

      if (attempts >= loginMaxAttempts) {
        const newLockUntil = now + lockoutMinutes * 60000;
        localStorage.setItem(LOGIN_LOCK_UNTIL_STORAGE_KEY, String(newLockUntil));
        writeFailedAttempts(0);
        await logAuditEvent(buildAuditEvent('auth.lockout_enabled', { userName: normalizedUsername || 'usuario-desconhecido', details: `Bloqueio por ${lockoutMinutes} min` }));
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
    localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
    set({ currentUser: localUser, isSessionLocked: false, isAuthReady: true });

    await logAuditEvent(buildAuditEvent('auth.login.local', { userId: localUser.id, userName: localUser.name, details: 'Acesso autorizado' }));
  },
  completeMfaChallenge: async (code: string) => {
    assertSupabaseConfigured();
    const normalizedCode = code.replace(/\s+/g, '');
    if (!normalizedCode) throw new Error('Informe o código do autenticador.');

    set((state) => ({
      mfaChallenge: {
        ...state.mfaChallenge,
        error: null
      }
    }));

    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;

    const factor = factors.data.totp[0];
    if (!factor) {
      throw new Error('Nenhum fator TOTP ativo encontrado para esta conta.');
    }

    const verify = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: normalizedCode
    });
    if (verify.error) {
      set((state) => ({
        mfaChallenge: {
          ...state.mfaChallenge,
          error: verify.error.message
        }
      }));
      throw verify.error;
    }

    const authUser = await buildUserFromSupabaseAuth(verify.data.user);
    sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
    localStorage.setItem(SESSION_LOGIN_AT_STORAGE_KEY, String(Date.now()));
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
    localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
    set({ currentUser: authUser, isSessionLocked: false, isAuthReady: true, mfaChallenge: EMPTY_MFA_CHALLENGE });
  },
  cancelMfaChallenge: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // cleanup below still runs.
    }

    sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    localStorage.removeItem(SESSION_LOGIN_AT_STORAGE_KEY);
    localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
    localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
    set({ currentUser: null, isSessionLocked: false, mfaChallenge: EMPTY_MFA_CHALLENGE });
  },
  clearMfaChallengeError: () => {
    set((state) => ({
      mfaChallenge: {
        ...state.mfaChallenge,
        error: null
      }
    }));
  },
  refreshCurrentUser: async () => {
    const env = (import.meta as any).env || {};
    if (getAuthMode(env) !== 'supabase') return;

    assertSupabaseConfigured();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      set({ currentUser: null, mfaChallenge: EMPTY_MFA_CHALLENGE });
      return;
    }

    if (await isMfaChallengeRequired()) {
      set({
        currentUser: null,
        mfaChallenge: {
          required: true,
          email: data.session.user.email || null,
          error: null
        }
      });
      return;
    }

    const authUser = await buildUserFromSupabaseAuth(data.session.user);
    sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(authUser));
    set({ currentUser: authUser, mfaChallenge: EMPTY_MFA_CHALLENGE });
  },
  lockSession: async () => {
    const user = get().currentUser;
    if (!user) return;
    localStorage.setItem(SESSION_LOCKED_STORAGE_KEY, '1');
    set({ isSessionLocked: true, registrations: [] });
    try {
      await logAuditEvent(buildAuditEvent('auth.session_locked', { userId: user.id, userName: user.name, details: 'Bloqueio local de tela' }));
    } catch {
      // Local lock must work even when audit RPC is temporarily unavailable.
    }
  },
  unlockSession: async () => {
    await get().refreshCurrentUser();
    if (get().mfaChallenge.required) return;
    if (!get().currentUser) throw new Error('Sessao expirada. Entre novamente.');
    localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
    set({ isSessionLocked: false });
  },
  logout: async () => {
    const env = (import.meta as any).env || {};
    const user = get().currentUser;
    if (getAuthMode(env) === 'supabase') {
      try {
        await supabase.auth.signOut();
      } catch {
        // Session cleanup below still runs even if the network is unavailable.
      }
    }
    sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    localStorage.removeItem(SESSION_LOGIN_AT_STORAGE_KEY);
    localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
    localStorage.removeItem(SESSION_LOCKED_STORAGE_KEY);
    set({ currentUser: null, isSessionLocked: false, registrations: [], mfaChallenge: EMPTY_MFA_CHALLENGE });

    await logAuditEvent(buildAuditEvent('auth.logout', { userId: user?.id || null, userName: user?.name || 'Sistema', details: 'Encerramento de sessao' }));
  },
  exportDatabase: async () => {
    throw new Error('Backup integral desabilitado por protecao LGPD. Use apenas CSV ou PDF minimizado.');
  },
  clearDatabase: async () => {
    const { currentUser } = get();
    if (!hasPermission(currentUser, 'clearDatabase')) {
      throw new Error('Apenas administradores podem arquivar a base.');
    }

    assertSupabaseConfigured();

    const deleteTable = async (table: string, key: string) => {
      const { error } = await supabase.from(table).delete().not(key, 'is', null);
      if (error) throw error;
    };

    try {
      const archivedAt = new Date().toISOString();
      const deletedBy = currentUser?.id && UUID_PATTERN.test(currentUser.id) ? currentUser.id : null;
      const registrationPatch: Record<string, string | null> = {
        status: 'cancelled',
        deleted_at: archivedAt,
        deleted_by: deletedBy
      };

      const { error: registrationsError } = await supabase.from('registrations').update(registrationPatch).is('deleted_at', null);
      if (registrationsError) throw registrationsError;

      const { error: validationsError } = await supabase
        .from('public_validations')
        .update({ status: 'cancelled', deleted_at: archivedAt })
        .is('deleted_at', null);
      if (validationsError) throw validationsError;

      await deleteTable('registration_index', 'cpf');
      set({ registrations: [] });
      await logAuditEvent(buildAuditEvent('system.database_archived', { userId: currentUser?.id || null, userName: currentUser?.name || 'Sistema', details: 'Registros ativos arquivados logicamente' }));
    } catch (error) {
      console.error('Erro ao arquivar base:', error);
      throw error;
    }
  },
  fetchRegistrations: async () => {
    // Dashboard and restricted print flows read private records. Public QR
    // validation must stay on public_validations/validate_cipf only.
    const { currentUser } = get();
    const canReadPrivateRecords =
      hasPermission(currentUser, 'viewCarteirinha') ||
      hasPermission(currentUser, 'viewDashboard') ||
      hasPermission(currentUser, 'viewPeople') ||
      hasPermission(currentUser, 'viewOperations') ||
      hasPermission(currentUser, 'viewDocumentsQueue') ||
      hasPermission(currentUser, 'viewPickupQueue') ||
      hasPermission(currentUser, 'viewReports') ||
      hasPermission(currentUser, 'viewAudit') ||
      hasPermission(currentUser, 'viewDocuments') ||
      hasPermission(currentUser, 'viewHistory');

    if (!canReadPrivateRecords) return;

    try {
      assertSupabaseConfigured();
      let { data, error } = await supabase
        .from('registrations')
        .select('*')
        .is('deleted_at', null)
        .order('issueDate', { ascending: false });

      if (error && isMissingColumnError(error, 'registrations.deleted_at')) {
        const legacyResult = await supabase.from('registrations').select('*').order('issueDate', { ascending: false });
        data = legacyResult.data;
        error = legacyResult.error;
      }

      if (error) {
        if ((error as any).code === 'PGRST205') {
          throw new Error(
            'Tabelas do Supabase não estão disponíveis para este projeto/chave. Execute o script supabase-schema.sql no SQL Editor.'
          );
        }
        throw error;
      }

      const normalizedRegistrations = ((data || []) as CIPFRegistration[]).filter((registration) => {
        if (registration.deleted_at) return false;
        return registration.status !== 'cancelled';
      });

      set({ registrations: normalizedRegistrations });
    } catch (error) {
      console.error('Failed to fetch registrations', error);
      set({ registrations: [] });
      throw error;
    }
  }
}));
