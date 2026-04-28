import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, LockKeyhole, ShieldAlert, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getSessionSecurityConfig, useAppStore } from '@/store/useAppStore';

export function Login() {
  const { loginWithLocalCredentials } = useAppStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf4ee] text-[#166534]">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-black text-[#17324d]">Acesso administrativo</h2>
        <p className="mt-1 text-sm text-[#617184]">Entre para gerenciar a Carteirinha de Fibromialgia.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 animate-in fade-in">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-3">
        <label className="relative block">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#617184]" />
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            autoComplete="username"
            className="h-12 rounded-xl border-[#d9e1ea] bg-white pl-10"
            required
          />
        </label>
        <label className="relative block">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#617184]" />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            type="password"
            autoComplete="current-password"
            className="h-12 rounded-xl border-[#d9e1ea] bg-white pl-10"
            required
          />
        </label>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[#17324d] font-bold text-white transition-all hover:bg-[#10263b] active:scale-[0.98]">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-[#617184]">
        Bloqueio apos {loginMaxAttempts} tentativas. Pausa de {lockoutMinutes} min.
      </div>
    </div>
  );
}
