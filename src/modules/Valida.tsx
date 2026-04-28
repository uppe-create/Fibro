import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { daysUntil } from '@/lib/date';
import { getStatusLabel, isPubliclyValidStatus } from '@/lib/registration-status';
import prefeituraLogo from '@/assets/prefeitura-logo.png';

// Public QR Code validation screen. Keep this privacy-preserving: do not query
// registrations/documents here, only public_validations or validate_cipf.
type ValidationStatus = 'idle' | 'loading' | 'valid' | 'invalid' | 'error';

type PublicValidationData = {
  id: string;
  fullName: string;
  cpfMasked: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending' | string;
  visualSignature?: string;
  checksum?: string;
};

function getValiditySummary(data: PublicValidationData | null) {
  if (!data?.expiryDate) return 'Validade nao informada.';
  const days = daysUntil(data.expiryDate);
  if (days === null) return 'Validade em formato invalido.';
  if (days < 0) return `Venceu ha ${Math.abs(days)} dia(s).`;
  if (days === 0) return 'Vence hoje.';
  return `Valida por mais ${days} dia(s).`;
}

async function fetchPublicValidation(cleanId: string, cleanSig: string) {
  // Production path: this RPC only returns data when id + signature match.
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('validate_cipf', { p_id: cleanId, p_sig: cleanSig })
    .maybeSingle();

  if (!rpcError) {
    return { data: rpcData as PublicValidationData | null, signatureCheckedByDb: true };
  }

  // Compatibility path while the production hardening SQL has not been applied.
  if (!['PGRST202', '42883'].includes((rpcError as any)?.code)) {
    console.warn('Falha no RPC validate_cipf, usando fallback temporario:', rpcError.message);
  }

  const { data: tableData, error: tableError } = await supabase
    .from('public_validations')
    .select('id,fullName,cpfMasked,issueDate,expiryDate,status,visualSignature,checksum')
    .eq('id', cleanId)
    .maybeSingle();

  if (tableError) throw tableError;
  return { data: tableData as PublicValidationData | null, signatureCheckedByDb: false };
}

export function Valida() {
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [data, setData] = useState<PublicValidationData | null>(null);
  const [invalidReason, setInvalidReason] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualSig, setManualSig] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [consultedAt, setConsultedAt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkRateLimit = () => {
    // Client-side throttle is UX protection, not hard security. Add backend
    // rate limiting before heavy public use.
    const now = Date.now();
    const attemptsStr = localStorage.getItem('validationAttempts');
    let attempts: number[] = [];

    try {
      attempts = attemptsStr ? JSON.parse(attemptsStr) : [];
    } catch {
      attempts = [];
    }

    attempts = attempts.filter((time) => now - time < 60000);
    if (attempts.length >= 5) return false;

    attempts.push(now);
    localStorage.setItem('validationAttempts', JSON.stringify(attempts));
    return true;
  };

  const validate = async (id: string, sig: string) => {
    if (!id || !sig) {
      setStatus('idle');
      return;
    }

    const cleanId = id.trim();
    const cleanSig = sig.trim().toUpperCase();

    setStatus('loading');
    setInvalidReason('');
    setData(null);
    setConsultedAt('');

    if (!checkRateLimit()) {
      setInvalidReason('Limite de consultas excedido. Tente novamente em 1 minuto.');
      setStatus('error');
      return;
    }

    try {
      const result = await fetchPublicValidation(cleanId, cleanSig);
      const validationData = result.data;
      setConsultedAt(new Date().toLocaleString('pt-BR'));

      if (!validationData) {
        setInvalidReason('Registro nao encontrado ou assinatura digital invalida.');
        setStatus('invalid');
        return;
      }

      const isSigValid =
        result.signatureCheckedByDb ||
        String(validationData.visualSignature || '').trim().toUpperCase() === cleanSig;

      if (!isSigValid) {
        setInvalidReason('A assinatura digital nao confere com os registros oficiais.');
        setStatus('invalid');
        return;
      }

      const days = daysUntil(validationData.expiryDate);
      const isExpiredByDate = days !== null && days < 0;
      const isActive = isPubliclyValidStatus(validationData.status);

      setData(validationData);
      if (isActive && !isExpiredByDate) {
        setStatus('valid');
        return;
      }

      setInvalidReason(isExpiredByDate ? 'Documento expirado por validade vencida.' : 'Documento ainda nao foi emitido ou nao esta ativo no sistema.');
      setStatus('invalid');
    } catch (error) {
      console.error('Validation error:', error);
      setInvalidReason('Nao foi possivel comunicar com o servidor de validacao.');
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
        document.title = 'CIPF valida';
        break;
      case 'invalid':
        document.title = 'CIPF invalida';
        break;
      case 'loading':
        document.title = 'Validando CIPF...';
        break;
      case 'error':
        document.title = 'Erro na validacao';
        break;
      default:
        document.title = 'Validacao publica da CIPF';
    }
  }, [status]);

  const handleManualValidation = (event: React.FormEvent) => {
    event.preventDefault();
    validate(manualId, manualSig);
  };

  const extractImageFromPdf = async (file: File): Promise<File | null> => {
    // QR scanner accepts images. For PDF uploads we rasterize page 1 and scan it.
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const pdfWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvas,
        canvasContext: context,
        viewport
      }).promise;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], 'pdf-page.png', { type: 'image/png' }) : null);
        }, 'image/png');
      });
    } catch (error) {
      console.error('Error extracting image from PDF:', error);
      return null;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>, droppedFile?: File) => {
    const file = droppedFile || ('target' in event ? (event.target as HTMLInputElement).files?.[0] : undefined);
    if (!file) return;

    setStatus('loading');
    setInvalidReason('');

    try {
      let fileToScan = file;

      if (file.type === 'application/pdf') {
        const extractedImage = await extractImageFromPdf(file);
        if (!extractedImage) throw new Error('Nao foi possivel processar o PDF.');
        fileToScan = extractedImage;
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('qr-reader-hidden');
      const decodedText = await html5QrCode.scanFile(fileToScan, true);
      const url = new URL(decodedText);
      const id = url.searchParams.get('id');
      const sig = url.searchParams.get('sig');

      if (!id || !sig) {
        setInvalidReason('QR Code invalido. Nao foi possivel extrair os dados da carteirinha.');
        setStatus('invalid');
        return;
      }

      setManualId(id);
      setManualSig(sig);
      await validate(id, sig);
    } catch (error) {
      console.error('Error scanning file', error);
      setInvalidReason('Nao foi possivel ler o QR Code. Tente enviar uma imagem mais nitida.');
      setStatus('error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(event, file);
    }
  };

  const resetValidation = () => {
    setStatus('idle');
    setData(null);
    setInvalidReason('');
    setManualId('');
    setManualSig('');
    setShowManual(false);
    setConsultedAt('');
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const isValid = status === 'valid';

  return (
    <div className="min-h-[80vh] px-4 py-8 animate-in fade-in duration-500">
      <div id="qr-reader-hidden" className="hidden" />

      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <section className="w-full overflow-hidden border border-[#d9e1ea] bg-white shadow-[0_18px_55px_rgba(23,50,77,0.08)]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#155c9c_0%,#155c9c_42%,#1f8a58_42%,#1f8a58_78%,#f2c94c_78%,#f2c94c_100%)]" />

          <div className="px-5 py-8 text-center sm:px-10 sm:py-10">
            <div className="mx-auto mb-6 flex h-16 w-40 items-center justify-center bg-white px-3">
              <img src={prefeituraLogo} alt="Prefeitura de Ipero" className="max-h-12 w-auto object-contain" />
            </div>

            <div className="mb-4 inline-flex items-center gap-2 border border-[#d9e1ea] bg-[#f8fafc] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#526579]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1f8a58]" />
              Consulta oficial
            </div>

            <h2 className="mx-auto max-w-2xl text-3xl font-black leading-tight text-[#17324d] sm:text-4xl">
              Validar Carteirinha de Fibromialgia
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#617184]">
              Confira se a CIPF apresentada foi emitida pela Prefeitura de Ipero e se ainda esta valida.
            </p>
          </div>

          <div className="border-t border-[#e3e9ef] bg-[#f8fafc] px-5 py-6 sm:px-10">
            {status === 'idle' && (
              <div className="mx-auto max-w-xl space-y-4 animate-in zoom-in-95 duration-300">
                <div
                  className={`cursor-pointer border-2 border-dashed bg-white p-5 text-center transition-all duration-200 ${
                    isDragging ? 'border-[#155c9c] bg-blue-50' : 'border-[#d8e2ec] hover:border-[#155c9c]'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-[#eef4f8]">
                    <Upload className={`h-6 w-6 ${isDragging ? 'text-[#155c9c]' : 'text-[#617184]'}`} />
                  </div>
                  <h3 className="text-base font-black text-[#17324d]">Enviar QR Code da carteirinha</h3>
                  <p className="mt-1 text-sm text-[#617184]">Aceita imagem ou PDF.</p>
                  <Button className="pointer-events-none mt-4 h-11 w-full rounded-xl bg-[#17324d] text-white hover:bg-[#10263b]">
                    Selecionar arquivo
                  </Button>
                </div>

                {!showManual ? (
                  <button
                    type="button"
                    onClick={() => setShowManual(true)}
                    className="flex w-full items-center justify-center gap-2 border border-[#d9e1ea] bg-white p-4 text-[#17324d] hover:bg-[#f8fbfd]"
                  >
                    <Fingerprint className="h-4 w-4 text-[#155c9c]" />
                    <span className="font-black">Digitar codigo manualmente</span>
                  </button>
                ) : (
                  <form onSubmit={handleManualValidation} className="space-y-4 border border-[#e3e9ef] bg-white p-5 text-left">
                    <label className="block space-y-1.5">
                      <span className="ml-1 text-xs font-bold uppercase tracking-wide text-[#617184]">Registro CIPF</span>
                      <Input placeholder="ID impresso no QR Code" value={manualId} onChange={(event) => setManualId(event.target.value)} className="h-12 rounded-xl bg-white" required />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="ml-1 text-xs font-bold uppercase tracking-wide text-[#617184]">Assinatura digital</span>
                      <Input placeholder="Ex: ABC123" value={manualSig} onChange={(event) => setManualSig(event.target.value)} className="h-12 rounded-xl bg-white font-mono uppercase" required />
                    </label>
                    <div className="flex gap-3 pt-1">
                      <Button type="button" variant="ghost" onClick={() => setShowManual(false)} className="h-12 flex-1 rounded-xl">
                        Cancelar
                      </Button>
                      <Button type="submit" className="h-12 flex-1 rounded-xl bg-[#17324d] text-white hover:bg-[#10263b]">
                        Validar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {status === 'loading' && (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#155c9c]">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-[#17324d]">Validando autenticidade...</p>
                  <p className="text-sm text-[#617184]">Consultando o registro publico oficial.</p>
                </div>
              </div>
            )}

            {(status === 'valid' || status === 'invalid') && (
              <div className="mx-auto max-w-2xl space-y-5 animate-in zoom-in-95 duration-500">
                <div className={`border bg-white p-5 ${isValid ? 'border-green-200 text-green-900' : 'border-red-200 text-red-900'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center ${isValid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {isValid ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em]">{isValid ? 'Documento valido' : 'Documento nao validado'}</p>
                      <h3 className="mt-1 text-2xl font-black">{isValid ? 'Carteirinha autentica' : 'Nao foi possivel validar'}</h3>
                      <p className="mt-1 text-sm opacity-85">
                        {isValid ? 'A assinatura confere com a base publica oficial.' : invalidReason || 'Confira o QR Code ou o codigo informado.'}
                      </p>
                    </div>
                  </div>
                </div>

                {data && (
                  <div className="border border-[#d8e2ec] bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#edf1f5] pb-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#617184]">Titular</p>
                        <p className="mt-1 text-lg font-black uppercase leading-tight text-[#17324d]">{data.fullName}</p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {getStatusLabel(data.status)}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="bg-[#f8fbfd] p-4">
                        <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#617184]">
                          <BadgeCheck className="h-4 w-4 text-[#1f8a58]" /> CPF
                        </p>
                        <p className="font-bold text-[#17324d]">{data.cpfMasked || '-'}</p>
                      </div>
                      <div className="bg-[#f8fbfd] p-4">
                        <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#617184]">
                          <CalendarDays className="h-4 w-4 text-[#155c9c]" /> Validade
                        </p>
                        <p className="font-bold text-[#17324d]">{data.expiryDate}</p>
                        <p className="mt-1 text-xs text-[#617184]">{getValiditySummary(data)}</p>
                      </div>
                      <div className="bg-[#f8fbfd] p-4">
                        <p className="mb-1 text-xs font-black uppercase tracking-wide text-[#617184]">Emissao</p>
                        <p className="font-bold text-[#17324d]">{data.issueDate || '-'}</p>
                      </div>
                      <div className="bg-[#f8fbfd] p-4">
                        <p className="mb-1 text-xs font-black uppercase tracking-wide text-[#617184]">Assinatura</p>
                        <p className="font-mono text-sm font-black tracking-widest text-[#17324d]">{data.visualSignature || '------'}</p>
                      </div>
                      <div className="bg-[#f8fbfd] p-4 sm:col-span-2">
                        <p className="mb-1 text-xs font-black uppercase tracking-wide text-[#617184]">Consulta realizada em</p>
                        <p className="font-bold text-[#17324d]">{consultedAt || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!data && status === 'invalid' && (
                  <div className="border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>A consulta nao retornou dados oficiais para o codigo informado. Confira o QR Code ou a assinatura digital.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 text-center animate-in zoom-in-95 duration-500">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#17324d]">Erro na validacao</h3>
                  <p className="mt-2 max-w-sm text-sm text-[#617184]">{invalidReason || 'Nao foi possivel processar a consulta agora.'}</p>
                </div>
                <Button onClick={resetValidation} className="h-12 w-full rounded-xl bg-[#17324d] text-white hover:bg-[#10263b]">
                  Tentar novamente
                </Button>
              </div>
            )}

            {status !== 'idle' && status !== 'error' && (
              <div className="mx-auto mt-5 max-w-2xl">
                <Button onClick={resetValidation} variant="outline" className="h-12 w-full rounded-xl bg-white">
                  Fazer nova consulta
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-[#e3e9ef] bg-white px-5 py-4 text-center text-xs text-[#617184]">
            A consulta exibe apenas dados publicos de validacao. Documentos e dados sensiveis permanecem protegidos.
          </div>
        </section>
      </div>
    </div>
  );
}
