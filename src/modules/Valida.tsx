import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  QrCode,
  Upload,
  XCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { daysUntil } from '@/lib/date';
import { getStatusLabel, isPubliclyValidStatus } from '@/lib/registration-status';
import {
  fetchPublicValidation,
  formatDisplaySignature,
  getValiditySummary,
  normalizeManualRegistryCode,
  normalizeSignature,
  type PublicValidationData,
  type ValidationStatus
} from '@/modules/valida/lib/publicValidation';
import { scanValidationQrFile } from '@/modules/valida/lib/qrScanner';
import { useAppStore } from '@/store/useAppStore';
import heroImg from '@/assets/landing-hero.jpg';

export function Valida() {
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [data, setData] = useState<PublicValidationData | null>(null);
  const [invalidReason, setInvalidReason] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [consultedAt, setConsultedAt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkRateLimit = () => {
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
    const cleanSig = normalizeSignature(sig);
    const registryCode = normalizeManualRegistryCode(cleanId);

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
      const result = await fetchPublicValidation(registryCode, cleanSig);
      const validationData = result.data;
      setConsultedAt(new Date().toLocaleString('pt-BR'));

      if (!validationData) {
        setInvalidReason('Registro não encontrado ou assinatura digital inválida.');
        setStatus('invalid');
        return;
      }

      const isSigValid =
        result.signatureCheckedByDb ||
        normalizeSignature(String(validationData.visualSignature || '')).startsWith(cleanSig);

      if (!isSigValid) {
        setInvalidReason('A assinatura digital não confere com os registros oficiais.');
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

      setInvalidReason(isExpiredByDate ? 'Documento expirado por validade vencida.' : 'Documento ainda não foi emitido ou não está ativo no sistema.');
      setStatus('invalid');
    } catch {
      setInvalidReason('Não foi possível comunicar com o servidor de validação.');
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
        document.title = 'CIPF válida';
        break;
      case 'invalid':
        document.title = 'CIPF inválida';
        break;
      case 'loading':
        document.title = 'Validando CIPF...';
        break;
      case 'error':
        document.title = 'Erro na validação';
        break;
      default:
        document.title = 'Validação pública da CIPF';
    }
  }, [status]);

  const handleManualValidation = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseManualCode(manualCode);
    if (!parsed) {
      setInvalidReason('Informe o Registro CIPF junto com o código manual impresso na carteirinha.');
      setStatus('error');
      return;
    }
    validate(parsed.id, parsed.sig);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>, droppedFile?: File) => {
    const file = droppedFile || ('target' in event ? (event.target as HTMLInputElement).files?.[0] : undefined);
    if (!file) return;

    setStatus('loading');
    setInvalidReason('');

    try {
      const { id, sig } = await scanValidationQrFile(file, 'qr-reader-hidden');
      setManualCode(`${id}/${sig}`);
      await validate(id, sig);
    } catch (error) {
      setInvalidReason((error as Error)?.message || 'Não foi possível ler o QR Code. Tente enviar uma imagem mais nítida.');
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
    setManualCode('');
    setConsultedAt('');
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const isValid = status === 'valid';
  const receiptCode = data?.id ? data.id.replace(/-/g, '').slice(0, 8).toUpperCase() : '';

  return (
    <div className="lovable-home cipf-page relative min-h-screen overflow-hidden bg-[hsl(30_25%_98%)] text-[hsl(270_25%_14%)]">
      <div className="absolute inset-0 -z-10">
        <img src={heroImg} alt="" className="h-full w-full scale-110 object-cover opacity-60 blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(30_25%_98%/0.72)] via-[hsl(30_25%_98%/0.90)] to-[hsl(30_25%_98%)]" />
      </div>
      <div id="qr-reader-hidden" className="hidden" />

      <header className="relative z-10 border-b border-[hsl(270_15%_90%/0.75)] bg-[hsl(30_25%_98%/0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between px-4 md:px-8">
          <button type="button" onClick={() => setActiveTab('inicio')} className="flex items-center">
            <div className="leading-tight">
              <div className="lovable-display text-base font-semibold">CIPF</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[hsl(270_8%_42%)]">Iperó · Carteirinha Municipal</div>
            </div>
          </button>

          <nav className="flex items-center gap-4 text-sm text-[hsl(270_25%_14%/0.70)] sm:gap-7">
            <button type="button" onClick={() => setActiveTab('inicio')} className="transition hover:text-[hsl(270_25%_14%)]">
              Início
            </button>
            <button type="button" onClick={() => setActiveTab('validar')} className="font-semibold text-[hsl(271_52%_32%)]">
              Validar
            </button>
            <Button type="button" size="sm" onClick={() => setActiveTab('configuracoes')} className="h-9 rounded-md">
              Entrar <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
        <div className="border-b border-[hsl(270_15%_90%)] pb-8">
          <div className="text-xs font-semibold text-[hsl(270_8%_42%)]">
            <button type="button" onClick={() => setActiveTab('inicio')} className="font-bold hover:text-[hsl(271_52%_32%)]">
              Início
            </button>
            <span> / Validação pública</span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">Validação pública</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[hsl(270_8%_42%)] md:text-lg">
            Envie o arquivo da carteirinha de Iperó ou digite o código de validação. Apenas dados mínimos são exibidos, em conformidade com a LGPD.
          </p>
        </div>

        {status === 'idle' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[hsl(270_15%_90%)] bg-white/75 shadow-[0_18px_60px_hsl(270_25%_14%/0.08)] backdrop-blur">
              <div className="border-b border-[hsl(270_15%_90%)] px-6 py-5">
                <h3 className="text-2xl font-semibold">Enviar arquivo da carteirinha</h3>
                <p className="mt-1 text-sm text-[hsl(270_8%_42%)]">Selecione uma imagem, print ou PDF com o QR Code visível.</p>
              </div>
              <div
                className={`flex min-h-[380px] cursor-pointer flex-col items-center justify-center p-6 text-center transition ${
                  isDragging ? 'bg-[hsl(271_52%_32%/0.08)]' : 'bg-white/35 hover:bg-white/55'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <div className="flex h-80 w-full max-w-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[hsl(270_15%_84%)] bg-[hsl(30_25%_98%/0.72)] px-8">
                  <Upload className="h-14 w-14 text-[hsl(271_52%_32%)]" />
                  <p className="mt-5 text-sm font-semibold text-[hsl(270_25%_14%)]">Arraste o arquivo aqui</p>
                  <p className="mt-1 text-xs text-[hsl(270_8%_42%)]">Imagem ou PDF com QR Code visível.</p>
                </div>
                <p className="mt-5 font-medium text-[hsl(270_25%_14%)]">Arquivo da carteirinha</p>
                <p className="mt-1 text-xs text-[hsl(270_8%_42%)]">Selecione foto, print ou PDF para leitura do QR Code.</p>
                <Button className="pointer-events-none mt-5 rounded-md bg-[hsl(271_52%_32%)] text-white hover:bg-[hsl(271_52%_26%)]" size="lg">
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar arquivo
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[hsl(270_15%_90%)] bg-white/75 shadow-[0_18px_60px_hsl(270_25%_14%/0.08)] backdrop-blur">
              <div className="border-b border-[hsl(270_15%_90%)] px-6 py-5">
                <h3 className="text-2xl font-semibold">Validar por código</h3>
                <p className="mt-1 text-sm text-[hsl(270_8%_42%)]">Insira o código alfanumérico abaixo do QR Code.</p>
              </div>
              <div className="p-6">
                <form onSubmit={handleManualValidation} className="space-y-3">
                  <Input
                    placeholder="CIPF-7K2M-9A3X-4P8Q"
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                    className="h-12 rounded-md border-[hsl(270_15%_86%)] bg-white/80 text-center font-mono uppercase tracking-[0.18em] focus-visible:ring-[hsl(271_52%_32%/0.25)]"
                    required
                  />
                  <Button type="submit" className="h-11 w-full rounded-md bg-[hsl(271_52%_32%)] text-white hover:bg-[hsl(271_52%_26%)]">
                    Validar carteirinha
                  </Button>
                </form>

                <div className="mt-4 rounded-2xl border border-[hsl(270_15%_90%)] bg-[hsl(270_15%_96%/0.45)] p-5">
                  <div className="mb-4 flex items-center gap-2 text-[hsl(270_8%_42%)]">
                    <QrCode className="h-5 w-5" />
                    <p className="font-bold">Aguardando validação</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[hsl(270_8%_42%)]">
                        <QrCode className="h-4 w-4" /> Titular
                      </p>
                      <p className="font-bold text-[hsl(270_25%_14%)]">Insira os dados acima</p>
                    </div>
                    <div>
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[hsl(270_8%_42%)]">
                        <CalendarDays className="h-4 w-4" /> Validade
                      </p>
                      <p className="font-bold text-[hsl(270_25%_14%)]">ou faça o upload</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[hsl(270_8%_42%)]">
                        <MapPin className="h-4 w-4" /> Município
                      </p>
                      <p className="font-bold text-[hsl(270_25%_14%)]">da carteirinha</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-[hsl(270_15%_90%)] bg-white/75 text-center shadow-[0_18px_60px_hsl(270_25%_14%/0.08)] backdrop-blur">
            <Loader2 className="h-9 w-9 animate-spin text-[hsl(271_52%_32%)]" />
            <div>
              <h3 className="text-2xl font-semibold">Validando carteirinha</h3>
              <p className="mt-2 text-sm text-[hsl(270_8%_42%)]">Consultando base pública segura.</p>
            </div>
          </div>
        )}

        {(status === 'valid' || status === 'invalid') && (
          <div className="mx-auto w-full max-w-2xl space-y-5 animate-in zoom-in-95 duration-500">
            <div className={`rounded-2xl border bg-white/80 p-5 shadow-[0_18px_60px_hsl(270_25%_14%/0.08)] backdrop-blur ${isValid ? 'border-green-200 text-green-900' : 'border-red-200 text-red-900'}`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${isValid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {isValid ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em]">{isValid ? 'Documento válido' : 'Documento não validado'}</p>
                  <h3 className="mt-1 text-2xl font-semibold">{isValid ? 'Carteirinha autêntica' : 'Não foi possível validar'}</h3>
                  <p className="mt-1 text-sm opacity-85">
                    {isValid ? 'A assinatura confere com a base pública oficial.' : invalidReason || 'Confira o QR Code ou o código informado.'}
                  </p>
                </div>
              </div>
            </div>

            {data && (
              <div className="rounded-2xl border border-[hsl(270_15%_90%)] bg-white/80 p-5 shadow-[0_18px_60px_hsl(270_25%_14%/0.08)] backdrop-blur">
                <div className="mb-4 flex flex-col justify-between gap-3 border-b border-[hsl(270_15%_90%)] pb-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[hsl(270_8%_42%)]">Comprovante de consulta</p>
                    <p className="mt-1 text-lg font-black uppercase leading-tight text-[hsl(270_25%_14%)]">{data.fullName}</p>
                    <p className="mt-1 text-xs text-[hsl(270_8%_42%)]">Conferência nº {receiptCode || '------'} realizada em {consultedAt || '-'}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {getStatusLabel(data.status)}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[hsl(270_15%_96%/0.62)] p-4">
                    <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[hsl(270_8%_42%)]">
                      <BadgeCheck className="h-4 w-4 text-[#1f8a58]" /> CPF
                    </p>
                    <p className="font-bold text-[hsl(270_25%_14%)]">{data.cpfMasked || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-[hsl(270_15%_96%/0.62)] p-4">
                    <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[hsl(270_8%_42%)]">
                      <CalendarDays className="h-4 w-4 text-[#155c9c]" /> Validade
                    </p>
                    <p className="font-bold text-[hsl(270_25%_14%)]">{data.expiryDate}</p>
                    <p className="mt-1 text-xs text-[hsl(270_8%_42%)]">{getValiditySummary(data)}</p>
                  </div>
                  <div className="rounded-xl bg-[hsl(270_15%_96%/0.62)] p-4">
                    <p className="mb-1 text-xs font-black uppercase tracking-wide text-[hsl(270_8%_42%)]">Emissão</p>
                    <p className="font-bold text-[hsl(270_25%_14%)]">{data.issueDate || '-'}</p>
                  </div>
                  <div className="rounded-xl bg-[hsl(270_15%_96%/0.62)] p-4">
                    <p className="mb-1 text-xs font-black uppercase tracking-wide text-[hsl(270_8%_42%)]">Assinatura</p>
                    <p className="font-mono text-sm font-black tracking-widest text-[hsl(270_25%_14%)]">{formatDisplaySignature(data.visualSignature)}</p>
                  </div>
                  <div className="rounded-xl bg-[hsl(270_15%_96%/0.62)] p-4 sm:col-span-2">
                    <p className="mb-1 text-xs font-black uppercase tracking-wide text-[hsl(270_8%_42%)]">Consulta realizada em</p>
                    <p className="font-bold text-[hsl(270_25%_14%)]">{consultedAt || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {!data && status === 'invalid' && (
              <div className="rounded-2xl border border-red-100 bg-red-50/90 p-4 text-sm text-red-800">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>A consulta não retornou dados oficiais para o código informado. Confira o QR Code ou a assinatura digital.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border border-[hsl(270_15%_90%)] bg-white/80 text-center shadow-[0_18px_60px_hsl(270_25%_14%/0.08)] backdrop-blur animate-in zoom-in-95 duration-500">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Erro na validação</h3>
              <p className="mt-2 max-w-sm text-sm text-[hsl(270_8%_42%)]">{invalidReason || 'Não foi possível processar a consulta agora.'}</p>
            </div>
            <Button onClick={resetValidation} className="w-full max-w-sm rounded-md bg-[hsl(271_52%_32%)] text-white hover:bg-[hsl(271_52%_26%)]" size="lg">
              Tentar novamente
            </Button>
          </div>
        )}

        {status !== 'idle' && status !== 'error' && (
          <div className="mx-auto w-full max-w-2xl">
            <Button onClick={resetValidation} variant="outline" className="w-full rounded-md bg-white/70 backdrop-blur" size="lg">
              Fazer nova consulta
            </Button>
          </div>
        )}

        <div className="text-center text-xs text-[hsl(270_8%_42%)]">
          A consulta exibe apenas dados públicos de validação. Documentos e dados sensíveis permanecem protegidos.
        </div>
      </div>
    </div>
  );
}

function parseManualCode(value: string): { id: string; sig: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes('/')) {
    const [id, sig] = trimmed.split('/');
    if (id && sig) return { id, sig };
  }

  const clean = trimmed.replace(/^CIPF/i, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (clean.length >= 14) {
    return { id: clean.slice(0, 8), sig: clean.slice(8, 16) };
  }

  return null;
}
