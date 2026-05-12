import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/useAppStore';

export function MfaChallenge() {
  const { mfaChallenge, completeMfaChallenge, cancelMfaChallenge } = useAppStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError('');
    setLoading(true);
    try {
      await completeMfaChallenge(code);
      setCode('');
    } catch (error: any) {
      setLocalError(error?.message || 'Não foi possível validar o segundo fator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[72vh] items-center justify-center py-10 animate-in fade-in duration-500">
      <div className="w-full max-w-md overflow-hidden rounded-[1.25rem] border border-[#ece7f3] bg-white shadow-[0_18px_50px_rgba(47,20,80,0.10)]">
        <div className="border-b border-[#f0e8f6] bg-[#faf7fd] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fibro-purple)] text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#876d9f]">Segundo fator</p>
              <h2 className="text-xl font-black text-[#170b24]">Validar MFA</h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm leading-6 text-[#6f617b]">
            Digite o código de 6 dígitos do aplicativo autenticador para liberar o acesso.
            {mfaChallenge.email ? ` Conta: ${mfaChallenge.email}.` : null}
          </p>

          {(localError || mfaChallenge.error) ? (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {localError || mfaChallenge.error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="mfa-code" className="mb-2 block text-sm font-bold text-[#170b24]">
                Código do autenticador
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f617b]" />
                <Input
                  id="mfa-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="h-11 rounded-lg pl-10 tracking-[0.35em]"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading || code.length < 6} className="h-12 w-full rounded-lg" size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                'Validar segundo fator'
              )}
            </Button>

            <Button type="button" variant="outline" onClick={() => void cancelMfaChallenge()} className="h-11 w-full rounded-lg">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
