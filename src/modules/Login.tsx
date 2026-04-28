import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Loader2, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getSessionSecurityConfig, useAppStore } from '@/store/useAppStore';
import prefeituraLogo from '@/assets/prefeitura-logo.png';

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
      <div className="rounded-2xl border border-[#d9e1ea] bg-[#f7fafc] p-4 text-center">
        <div className="mx-auto mb-3 flex h-16 w-32 items-center justify-center bg-white px-3 shadow-sm">
          <img src={prefeituraLogo} alt="Prefeitura de Ipero" className="max-h-12 w-auto object-contain" />
        </div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#b9d7c7] bg-[#edf7f1] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#166534]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Portal restrito oficial
        </div>
        <h3 className="text-lg font-black text-[#17324d]">Area interna da Secretaria</h3>
        <p className="mt-1 text-xs leading-5 text-[#617184]">
          Acesso para administradores, atendentes e perfis de consulta autorizados.
        </p>
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
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#617184]" />
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            autoComplete="username"
            className="h-12 rounded-xl bg-white pl-10"
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
            className="h-12 rounded-xl bg-white pl-10"
            required
          />
        </label>
        <Button type="submit" disabled={loading} className="official-button h-12 w-full rounded-xl font-bold transition-all active:scale-[0.98]">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar com credencial autorizada'
          )}
        </Button>
      </form>

      <div className="rounded-xl border border-[#d9e1ea] bg-white px-3 py-2 text-center text-xs text-[#5E6B7A]">
        Selo de seguranca: bloqueio apos {loginMaxAttempts} tentativas e pausa de {lockoutMinutes} min.
      </div>
    </div>
  );
}
