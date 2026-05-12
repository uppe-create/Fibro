import { describe, expect, it } from 'vitest';
import { assertProductionAuthSafe, getAuthMode, getProductionAuthError } from '@/lib/auth-mode';

describe('auth mode production guard', () => {
  it('allows local auth outside production', () => {
    expect(getAuthMode({ VITE_AUTH_MODE: 'local' })).toBe('local');
    expect(getProductionAuthError({ VITE_AUTH_MODE: 'local' }, false)).toBeNull();
  });

  it('rejects local auth in production', () => {
    expect(getProductionAuthError({ VITE_AUTH_MODE: 'local' }, true)).toContain('VITE_AUTH_MODE="supabase"');
  });

  it('allows Supabase auth in production when URL and anon key are configured', () => {
    expect(
      getProductionAuthError(
        {
          VITE_AUTH_MODE: 'supabase',
          VITE_SUPABASE_URL: 'https://project.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'public-anon-key'
        },
        true
      )
    ).toBeNull();
  });

  it('rejects Supabase auth in production without URL or anon key', () => {
    expect(getProductionAuthError({ VITE_AUTH_MODE: 'supabase' }, true)).toContain('VITE_SUPABASE_URL');
    expect(
      getProductionAuthError(
        {
          VITE_AUTH_MODE: 'supabase',
          VITE_SUPABASE_URL: 'https://project.supabase.co'
        },
        true
      )
    ).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('throws a safe error when production auth is not ready', () => {
    expect(() => assertProductionAuthSafe({ VITE_AUTH_MODE: 'local' }, true)).toThrow(/producao exige/);
  });
});
