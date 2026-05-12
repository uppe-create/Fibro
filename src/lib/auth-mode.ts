export type AuthMode = 'local' | 'supabase';

type EnvLike = Record<string, unknown>;

const readString = (env: EnvLike, key: string): string => String(env[key] || '').trim();

export function getAuthMode(env: EnvLike): AuthMode {
  return readString(env, 'VITE_AUTH_MODE').toLowerCase() === 'supabase' ? 'supabase' : 'local';
}

export function getProductionAuthError(env: EnvLike, isProduction: boolean): string | null {
  if (!isProduction) return null;

  if (getAuthMode(env) !== 'supabase') {
    return 'Configuracao insegura: producao exige VITE_AUTH_MODE="supabase".';
  }

  if (!readString(env, 'VITE_SUPABASE_URL')) {
    return 'Configuracao insegura: producao exige VITE_SUPABASE_URL.';
  }

  if (!readString(env, 'VITE_SUPABASE_ANON_KEY')) {
    return 'Configuracao insegura: producao exige VITE_SUPABASE_ANON_KEY.';
  }

  return null;
}

export function assertProductionAuthSafe(env: EnvLike, isProduction: boolean): void {
  const error = getProductionAuthError(env, isProduction);
  if (error) throw new Error(error);
}
