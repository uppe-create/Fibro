import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSessionSecurityConfig, useAppStore } from '@/store/useAppStore';
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Shield, ShieldAlert, User } from 'lucide-react';
import { getAuthMode } from '@/lib/auth-mode';

export function Login() {
  const { loginWithLocalCredentials } = useAppStore();
  const authMode = getAuthMode((import.meta as any).env || {});
  const isSupabaseAuth = authMode === 'supabase';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { lockoutMinutes, loginMaxAttempts } = getSessionSecurityConfig();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithLocalCredentials(username, password);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-[1.25rem] bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-[#5c2685] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.28)_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative mt-auto max-w-lg pb-12">
          <Shield className="mb-6 h-8 w-8 text-white/78" />
          <h2 className="lovable-display text-4xl font-semibold leading-[1.04] tracking-tight text-white xl:text-5xl">
            Reconhecer a fibromialgia
            <br />
            é o primeiro gesto de <span className="text-[#f1dcff]">cuidado.</span>
          </h2>
          <p className="mt-5 text-base font-medium leading-7 text-white/82">
            Acesso restrito à equipe municipal autorizada de Iperó para gestão da Carteirinha de Fibromialgia.
          </p>
        </div>

      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#6f617b]">Acesso restrito</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-[#170b24]">Acesso administrativo</h2>
            <p className="mt-3 text-sm leading-6 text-[#6f617b]">Use suas credenciais da Prefeitura de Iperó para continuar.</p>
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700 animate-in fade-in" aria-live="polite">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-username" className="mb-2 block text-sm font-bold text-[#170b24]">
                {isSupabaseAuth ? 'E-mail' : 'Usuário'}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f617b]" />
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isSupabaseAuth ? 'email@municipio.gov.br' : 'usuario'}
                  aria-label={isSupabaseAuth ? 'E-mail' : 'Usuario'}
                  autoComplete="username"
                  type={isSupabaseAuth ? 'email' : 'text'}
                  className="h-11 rounded-lg pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="login-password" className="block text-sm font-bold text-[#170b24]">
                  Senha
                </label>
                <button type="button" className="text-xs font-semibold text-[var(--fibro-purple)] hover:text-[var(--fibro-purple-strong)]">
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f617b]" />
                <Input
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  aria-label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-11 rounded-lg pl-10 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#6f617b] hover:bg-[#f8f5fb] hover:text-[var(--fibro-purple)]"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-lg bg-[var(--fibro-purple)] font-bold hover:bg-[var(--fibro-purple-strong)]" size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 rounded-lg border border-[#ece7f3] bg-white p-4 text-sm text-[#6f617b] shadow-sm">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fibro-purple)]" />
              <p>
                Sessão protegida com bloqueio após {loginMaxAttempts} tentativas e pausa de {lockoutMinutes} min.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
