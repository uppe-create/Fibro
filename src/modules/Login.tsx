import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export function Login() {
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao fazer login');
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center font-medium animate-in fade-in">
          {error}
        </div>
      )}
      <Button onClick={handleLogin} className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98]">
        Entrar com Google
      </Button>
      <div className="mt-4 text-center text-xs text-[#86868B]">
        Apenas usuários autorizados podem acessar o sistema.
      </div>
    </div>
  );
}
