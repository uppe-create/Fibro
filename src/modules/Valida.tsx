import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2, Search } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Valida() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'error'>('idle');
  const [data, setData] = useState<any>(null);
  const [manualId, setManualId] = useState('');
  const [manualSig, setManualSig] = useState('');

  const checkRateLimit = () => {
    const now = Date.now();
    const attemptsStr = localStorage.getItem('validationAttempts');
    let attempts = attemptsStr ? JSON.parse(attemptsStr) : [];
    
    attempts = attempts.filter((time: number) => now - time < 60000);
    
    if (attempts.length >= 5) {
      return false;
    }
    
    attempts.push(now);
    localStorage.setItem('validationAttempts', JSON.stringify(attempts));
    return true;
  };

  const generateChecksum = async (data: string) => {
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const validate = async (id: string, sig: string) => {
    if (!id || !sig) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    if (!checkRateLimit()) {
      alert('Limite de consultas excedido. Tente novamente em 1 minuto.');
      setStatus('error');
      return;
    }

    try {
      const docRef = doc(db, 'registrations', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const regData = docSnap.data();
        
        const dataToHash = `${regData.cpf}${regData.fullName}${regData.birthDate}${regData.issueDate}${regData.visualSignature}`;
        const calculatedChecksum = await generateChecksum(dataToHash);

        if (regData.visualSignature === sig && regData.status === 'active' && calculatedChecksum === regData.checksum) {
          setStatus('valid');
          setData(regData);
        } else {
          setStatus('invalid');
        }
      } else {
        setStatus('invalid');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const sig = urlParams.get('sig');

    // Also support the old path-based format just in case
    const pathParts = window.location.pathname.split('/');
    const pathId = pathParts.length > 1 && pathParts[1] === 'valida' ? (pathParts.pop() || pathParts.pop()) : null;

    const finalId = id || (pathId !== 'valida' ? pathId : null);

    if (finalId && sig) {
      validate(finalId, sig);
    }
  }, []);

  const handleManualValidation = (e: React.FormEvent) => {
    e.preventDefault();
    validate(manualId, manualSig);
  };

  const resetValidation = () => {
    setStatus('idle');
    setData(null);
    setManualId('');
    setManualSig('');
    // Remove query params from URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 font-sans animate-in fade-in duration-500">
      <div className="mb-8 text-center animate-in slide-in-from-bottom-4 duration-700">
        <div className="mx-auto bg-blue-600 text-white p-4 rounded-3xl w-20 h-20 flex items-center justify-center mb-6 shadow-lg shadow-blue-600/20">
          <Activity className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-semibold text-[#1D1D1F] tracking-tight">Validação CIPF</h1>
        <p className="text-[#86868B] mt-2 font-medium">Secretaria Municipal de Saúde</p>
      </div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden animate-in zoom-in-95 duration-500 delay-150">
        <div className="text-center pb-2 pt-8">
          <h3 className="text-lg font-medium text-[#1D1D1F]">Status da Carteira</h3>
        </div>
        <div className="flex flex-col items-center justify-center p-8">
          
          {status === 'idle' && (
            <form onSubmit={handleManualValidation} className="w-full space-y-4 animate-in fade-in duration-300">
              <p className="text-sm text-[#86868B] text-center mb-6">
                Escaneie o QR Code da carteirinha ou insira os dados manualmente abaixo.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1D1D1F]">Registro CIPF</label>
                <Input 
                  placeholder="Ex: a1b2c3d4..." 
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1D1D1F]">Assinatura Digital</label>
                <Input 
                  placeholder="Ex: ABC123XYZ" 
                  value={manualSig}
                  onChange={(e) => setManualSig(e.target.value)}
                  className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors rounded-xl font-mono uppercase"
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98] mt-4">
                <Search className="w-4 h-4 mr-2" />
                Validar Carteirinha
              </Button>
            </form>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center text-[#86868B] py-8">
              <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-600" />
              <p className="font-medium">Verificando autenticidade...</p>
            </div>
          )}

          {status === 'valid' && data && (
            <div className="flex flex-col items-center text-center space-y-6 w-full animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <div>
                <h2 className="text-3xl font-semibold text-green-600 tracking-tight">VÁLIDA</h2>
                <p className="text-[#86868B] mt-2">Esta carteira é autêntica e está ativa.</p>
              </div>
              <div className="w-full border-t border-gray-100/50 pt-6 mt-2 text-left space-y-4">
                <div className="bg-gray-50/50 p-4 rounded-2xl">
                  <p className="text-xs text-[#86868B] uppercase font-semibold tracking-wider mb-1">Titular</p>
                  <p className="font-medium text-[#1D1D1F]">{data.fullName}</p>
                </div>
                <div className="bg-gray-50/50 p-4 rounded-2xl">
                  <p className="text-xs text-[#86868B] uppercase font-semibold tracking-wider mb-1">Validade</p>
                  <p className="font-medium text-[#1D1D1F]">{data.expiryDate}</p>
                </div>
                <div className="bg-gray-50/50 p-4 rounded-2xl">
                  <p className="text-xs text-[#86868B] uppercase font-semibold tracking-wider mb-1">Assinatura Digital</p>
                  <p className="font-mono font-bold tracking-widest text-lg text-[#1D1D1F]">{data.visualSignature}</p>
                </div>
              </div>
              <Button onClick={resetValidation} variant="outline" className="w-full rounded-xl mt-4">
                Nova Consulta
              </Button>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center text-center space-y-6 py-8 animate-in zoom-in-95 duration-300 w-full">
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-2">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
              <div>
                <h2 className="text-3xl font-semibold text-red-600 tracking-tight">INVÁLIDA</h2>
                <p className="text-[#86868B] mt-2">Registro não encontrado ou expirado.</p>
              </div>
              <Button onClick={resetValidation} variant="outline" className="w-full rounded-xl mt-4">
                Tentar Novamente
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center text-center space-y-6 py-8 animate-in zoom-in-95 duration-300 w-full">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                <XCircle className="h-12 w-12 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Erro na Verificação</h2>
                <p className="text-[#86868B] mt-2">Não foi possível verificar os dados informados.</p>
              </div>
              <Button onClick={resetValidation} variant="outline" className="w-full rounded-xl mt-4">
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
