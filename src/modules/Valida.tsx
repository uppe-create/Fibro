import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Fingerprint, ChevronRight, Upload, Image as ImageIcon, FileText } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Html5Qrcode } from 'html5-qrcode';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Setup PDF.js worker locally using Vite's ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function Valida() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid' | 'error'>('idle');
  const [data, setData] = useState<any>(null);
  const [manualId, setManualId] = useState('');
  const [manualSig, setManualSig] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setStatus('idle');
      return;
    }

    const cleanId = id.trim();
    const cleanSig = sig.trim().toUpperCase();

    setStatus('loading');

    if (!checkRateLimit()) {
      alert('Limite de consultas excedido. Tente novamente em 1 minuto.');
      setStatus('error');
      return;
    }

    try {
      const docRef = doc(db, 'registrations', cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const regData = docSnap.data();
        
        // Normalize data for checksum comparison
        const cpf = (regData.cpf || '').replace(/\D/g, '');
        const fullName = (regData.fullName || '').toUpperCase().trim();
        const birthDate = (regData.birthDate || '').trim();
        const issueDate = (regData.issueDate || '').trim();
        const visualSignature = (regData.visualSignature || '').toUpperCase().trim();

        const dataToHash = `${cpf}${fullName}${birthDate}${issueDate}${visualSignature}`;
        const calculatedChecksum = await generateChecksum(dataToHash);

        const isSigValid = visualSignature === cleanSig;
        const isActive = regData.status === 'active';
        const isChecksumValid = calculatedChecksum === regData.checksum;

        if (isSigValid && isActive && isChecksumValid) {
          setStatus('valid');
          setData(regData);
        } else {
          setStatus('invalid');
        }
      } else {
        setStatus('invalid');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const sig = urlParams.get('sig');

    if (id && sig) {
      validate(id, sig);
    }
  }, []);

  useEffect(() => {
    switch (status) {
      case 'valid':
        document.title = 'Válida - CIPF';
        break;
      case 'invalid':
        document.title = 'Inválida - CIPF';
        break;
      case 'loading':
        document.title = 'Validando...';
        break;
      case 'error':
        document.title = 'Erro na Validação';
        break;
      default:
        document.title = 'Validação Oficial - CIPF';
    }
  }, [status]);

  const handleManualValidation = (e: React.FormEvent) => {
    e.preventDefault();
    validate(manualId, manualSig);
  };

  const extractImageFromPdf = async (file: File): Promise<File | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Get the first page
      const page = await pdf.getPage(1);
      
      // Set scale to get a high-quality render for the QR code reader
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], "pdf-page.png", { type: "image/png" }));
          } else {
            resolve(null);
          }
        }, 'image/png');
      });
    } catch (error) {
      console.error("Error extracting image from PDF:", error);
      return null;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>, droppedFile?: File) => {
    let file: File | undefined;
    
    if (droppedFile) {
      file = droppedFile;
    } else if (event && 'target' in event && (event.target as HTMLInputElement).files) {
      file = (event.target as HTMLInputElement).files?.[0];
    }
    
    if (!file) return;

    setStatus('loading');
    try {
      let fileToScan = file;
      
      if (file.type === 'application/pdf') {
        const extractedImage = await extractImageFromPdf(file);
        if (extractedImage) {
          fileToScan = extractedImage;
        } else {
          throw new Error("Não foi possível processar o PDF.");
        }
      }

      const html5QrCode = new Html5Qrcode("qr-reader-hidden");
      const decodedText = await html5QrCode.scanFile(fileToScan, true);
      
      try {
        const url = new URL(decodedText);
        const id = url.searchParams.get('id');
        const sig = url.searchParams.get('sig');
        
        if (id && sig) {
          setManualId(id);
          setManualSig(sig);
          validate(id, sig);
        } else {
          alert('QR Code inválido. Não foi possível extrair os dados da carteirinha.');
          setStatus('idle');
        }
      } catch (e) {
        alert('QR Code inválido. Formato não reconhecido.');
        setStatus('idle');
      }
    } catch (err) {
      console.error("Error scanning file", err);
      alert("Não foi possível ler o QR Code no arquivo. Tente enviar um arquivo com melhor qualidade ou mais nítido.");
      setStatus('idle');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(e as any, file);
    }
  };

  const resetValidation = () => {
    setStatus('idle');
    setData(null);
    setManualId('');
    setManualSig('');
    setShowManual(false);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 animate-in fade-in duration-500">
      <div id="qr-reader-hidden" style={{ display: 'none' }}></div>
      
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden relative">
        
        <div className="p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Validação Oficial</h2>
            <p className="text-[#86868B] mt-1">Verifique a autenticidade da CIPF</p>
          </div>

          {/* IDLE STATE */}
          {status === 'idle' && (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
              
              <div 
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' 
                    : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <div className="w-14 h-14 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-[#86868B]'}`} />
                </div>
                <h3 className="text-base font-medium text-[#1D1D1F] mb-1">
                  Envie o arquivo da carteirinha
                </h3>
                <p className="text-sm text-[#86868B] mb-6">
                  Arraste e solte ou clique para selecionar
                </p>
                <Button 
                  className="w-full rounded-xl h-12 bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-sm transition-all active:scale-[0.98] pointer-events-none"
                >
                  Selecionar Arquivo
                </Button>
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-medium text-[#86868B] uppercase tracking-widest">ou</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              {!showManual ? (
                <Button 
                  variant="ghost"
                  onClick={() => setShowManual(true)}
                  className="w-full h-12 rounded-xl text-[#86868B] font-medium hover:bg-gray-100/50 transition-all flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  Digitar código manualmente
                </Button>
              ) : (
                <form onSubmit={handleManualValidation} className="space-y-4 animate-in slide-in-from-top-4 duration-300 bg-white/50 p-5 rounded-2xl border border-gray-100">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#86868B] ml-1">Registro CIPF</label>
                    <Input 
                      placeholder="Ex: a1b2c3d4..." 
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl h-12"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#86868B] ml-1">Assinatura Digital</label>
                    <Input 
                      placeholder="Ex: ABC123XYZ" 
                      value={manualSig}
                      onChange={(e) => setManualSig(e.target.value)}
                      className="bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl h-12 font-mono uppercase"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setShowManual(false)} className="flex-1 h-12 rounded-xl text-[#86868B] hover:bg-gray-100">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium">
                      Validar
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* LOADING STATE */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
                <div className="w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              </div>
              <p className="text-[#86868B] font-medium animate-pulse">Processando arquivo...</p>
            </div>
          )}

          {/* VALID STATE */}
          {status === 'valid' && data && (
            <div className="flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">VÁLIDA</h2>
                <p className="text-[#86868B]">Documento autêntico e ativo</p>
              </div>

              <div className="w-full bg-gray-50/50 rounded-2xl border border-gray-100 p-5 space-y-4 mt-4">
                <div>
                  <p className="text-[10px] text-[#86868B] font-medium uppercase tracking-widest mb-1">Titular da Carteira</p>
                  <p className="font-medium text-[#1D1D1F] text-lg leading-tight">{data.fullName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] text-[#86868B] font-medium uppercase tracking-widest mb-1">CPF</p>
                    <p className="font-medium text-[#1D1D1F]">{data.cpf}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#86868B] font-medium uppercase tracking-widest mb-1">Validade</p>
                    <p className="font-medium text-[#1D1D1F]">{data.expiryDate}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[10px] text-[#86868B] font-medium uppercase tracking-widest mb-1">Assinatura Digital</p>
                  <p className="font-mono font-medium tracking-widest text-[#1D1D1F] bg-white py-1.5 px-3 rounded-lg inline-block border border-gray-200">{data.visualSignature}</p>
                </div>
              </div>

              <Button onClick={resetValidation} className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-sm mt-4">
                Realizar Nova Consulta
              </Button>
            </div>
          )}

          {/* INVALID STATE */}
          {status === 'invalid' && (
            <div className="flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-500 py-4">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">INVÁLIDA</h2>
                <p className="text-[#86868B]">Este documento não é autêntico ou foi revogado.</p>
              </div>

              <div className="w-full bg-red-50/50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 mt-4">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 leading-relaxed">
                  A assinatura digital não confere com os registros oficiais da Secretaria de Saúde. O documento pode ter sido adulterado.
                </p>
              </div>

              <Button onClick={resetValidation} className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-sm mt-4">
                Tentar Novamente
              </Button>
            </div>
          )}

          {/* ERROR STATE */}
          {status === 'error' && (
            <div className="flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-500 py-4">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-orange-600" />
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Erro na Leitura</h2>
                <p className="text-[#86868B]">Não foi possível processar o arquivo ou comunicar com o servidor.</p>
              </div>

              <Button onClick={resetValidation} className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-sm mt-4">
                Tentar Novamente
              </Button>
            </div>
          )}

        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="mt-8 text-center opacity-60">
        <p className="text-xs font-medium text-[#86868B] tracking-widest uppercase">Sistema Integrado de Saúde</p>
      </div>
    </div>
  );
}

