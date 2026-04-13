import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      let message = 'Erro ao fazer login';
      
      if (err.code === 'auth/popup-blocked') {
        message = 'O popup de login foi bloqueado pelo navegador. Por favor, permita popups para este site.';
      } else if (err.code === 'auth/unauthorized-domain') {
        message = 'Este domínio não está autorizado para login no Firebase. Contate o administrador.';
      } else if (err.code === 'auth/operation-not-allowed') {
        message = 'O login com Google não está ativado no console do Firebase.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        message = 'O popup de login foi fechado antes da conclusão.';
      } else if (err.message) {
        message = err.message;
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center font-medium animate-in fade-in">
          {error}
        </div>
      )}
      <Button 
        onClick={handleLogin} 
        disabled={loading}
        className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar com Google'
        )}
      </Button>
      <div className="mt-4 text-center text-xs text-[#86868B]">
        Apenas usuários autorizados podem acessar o sistema.
      </div>
    </div>
  );
}
