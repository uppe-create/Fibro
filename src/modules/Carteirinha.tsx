import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CIPFRegistration, useAppStore } from '@/store/useAppStore';
import { Search, FileBadge2, Loader2, Image as ImageIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/layout';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';
import { loadCipfFileDataUri } from '@/lib/cipf-files';
import { hasPermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { buildAuditEvent } from '@/lib/audit-events';
import { getStatusLabel, isPrintableStatus, normalizeRegistrationStatus } from '@/lib/registration-status';

const PRINT_REGISTRATION_STORAGE_KEY = 'cipf_print_registration_id';
const BATCH_PRINT_STORAGE_KEY = 'cipf_batch_print_ids';

export function Carteirinha() {
  const { registrations, fetchRegistrations, currentUser } = useAppStore();
  const canPrintCarteirinha = hasPermission(currentUser, 'printCarteirinha');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState<CIPFRegistration | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string>('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const queryParams = new URLSearchParams(window.location.search);
  const searchFromUrlRef = useRef(
    queryParams.get('id') || sessionStorage.getItem(PRINT_REGISTRATION_STORAGE_KEY) || queryParams.get('search') || ''
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const parsedBatch = JSON.parse(sessionStorage.getItem(BATCH_PRINT_STORAGE_KEY) || '[]');
        if (Array.isArray(parsedBatch)) setBatchIds(parsedBatch.filter(Boolean));
      } catch {
        sessionStorage.removeItem(BATCH_PRINT_STORAGE_KEY);
      }
      if (registrations.length === 0) {
        setIsLoading(true);
        await fetchRegistrations();
        setIsLoading(false);
      }

      if (searchFromUrlRef.current) {
        setSearchTerm(searchFromUrlRef.current);
      }
    };
    bootstrap();
  }, [fetchRegistrations, registrations.length]);

  useEffect(() => {
    if (!searchFromUrlRef.current || registrations.length === 0) return;
    handleSearch(searchFromUrlRef.current);
    sessionStorage.removeItem(PRINT_REGISTRATION_STORAGE_KEY);
    window.history.replaceState({}, '', '/carteirinha');
    searchFromUrlRef.current = '';
  }, [registrations.length]);

  const handleSearch = async (termToSearch?: string) => {
    const term = typeof termToSearch === 'string' ? termToSearch : searchTerm;
    
    if (!term.trim()) {
      setSelectedReg(null);
      setPhotoDataUri('');
      setIsImageLoaded(false);
      return;
    }
    
    const normalizedTerm = term.trim().toLowerCase();
    const digitsTerm = term.replace(/\D/g, '');

    const found = registrations.find(r =>
      r.id === term ||
      r.cpf.includes(digitsTerm || term) ||
      (r.cns || '').includes(digitsTerm || term) ||
      r.fullName.toLowerCase().includes(normalizedTerm)
    );
    
    setIsImageLoaded(false);
    
    if (found) {
      if (!isPrintableStatus(found.status)) {
        alert(`Cadastro encontrado, mas o status atual é "${getStatusLabel(found.status)}". Apenas carteirinhas aprovadas ou emitidas podem ser impressas.`);
        setSelectedReg(null);
        setPhotoDataUri('');
        return;
      }
      setSelectedReg(found);
      setSearchTerm(found.fullName);
      const photoUri = await loadCipfFileDataUri(found.photoFileId, found.photoUrl || '');
      setPhotoDataUri(photoUri);
    } else {
      alert('Nenhum cadastro encontrado com este nome ou CPF.');
      setSelectedReg(null);
      setPhotoDataUri('');
    }
  };

  const handlePrint = async () => {
    if (!printRef.current || !selectedReg) return;
    if (!canPrintCarteirinha) {
      alert('Seu perfil não permite baixar carteirinhas.');
      return;
    }
    const isFirstIssue = normalizeRegistrationStatus(selectedReg.status) === 'approved';
    const confirmMessage = isFirstIssue
      ? `Emitir e baixar a carteirinha de ${selectedReg.fullName}?`
      : `Baixar novamente a carteirinha de ${selectedReg.fullName}?`;
    if (!window.confirm(`${confirmMessage}\n\nConfirme somente se você revisou os dados da carteirinha.`)) return;
    
    try {
      setIsPrinting(true);
      if (isFirstIssue) {
        const issueDate = new Date();
        const expiryDate = new Date(issueDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        const payload = {
          status: 'issued',
          issueDate: issueDate.toLocaleDateString('pt-BR'),
          expiryDate: expiryDate.toLocaleDateString('pt-BR')
        };
        const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', selectedReg.id);
        if (registrationError) throw registrationError;
        const { error: publicError } = await supabase.from('public_validations').update(payload).eq('id', selectedReg.id);
        if (publicError) throw publicError;
        const { error: indexError } = await supabase
          .from('registration_index')
          .update({ status: 'issued', updated_at: new Date().toISOString() })
          .eq('cpf', selectedReg.cpf.replace(/\D/g, ''));
        if (indexError) throw indexError;

        await logAuditEvent(buildAuditEvent('card.issued', {
            registrationId: selectedReg.id,
            userId: currentUser?.id || null,
            userName: currentUser?.name || 'Sistema',
            targetLabel: selectedReg.fullName,
            details: 'Download PNG pelo modulo Carteirinha'
          }));

        setSelectedReg({ ...selectedReg, ...payload, status: 'issued' });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await fetchRegistrations();
      }
      
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(printRef.current, {
        quality: 1.0,
        pixelRatio: 3, // Higher scale for better print quality
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `CIPF_${selectedReg.cpf.replace(/\D/g, '')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (batchIds.length > 1) {
        const remaining = batchIds.filter((id) => id !== selectedReg.id);
        sessionStorage.setItem(BATCH_PRINT_STORAGE_KEY, JSON.stringify(remaining));
        setBatchIds(remaining);
        const nextId = remaining[0];
        const nextReg = registrations.find((reg) => reg.id === nextId);
        if (nextReg) {
          setSelectedReg(nextReg);
          setSearchTerm(nextReg.fullName);
          setIsImageLoaded(false);
          const nextPhotoUri = await loadCipfFileDataUri(nextReg.photoFileId, nextReg.photoUrl || '');
          setPhotoDataUri(nextPhotoUri);
          alert(`Carteirinha gerada. Próxima do lote: ${nextReg.fullName}`);
        }
      } else if (batchIds.length === 1) {
        sessionStorage.removeItem(BATCH_PRINT_STORAGE_KEY);
        setBatchIds([]);
      }
      
    } catch {
      alert('Ocorreu um erro ao gerar o arquivo para impressão. Tente novamente.');
    } finally {
      setIsPrinting(false);
    }
  };

  if (!canPrintCarteirinha) {
    return (
      <div className="cipf-panel mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <FileBadge2 className="h-7 w-7" />
        </div>
        <h2 className="cipf-title mt-5 text-2xl">Impressão restrita</h2>
        <p className="cipf-description mt-3 text-sm">
          Por proteção de dados e LGPD, somente o perfil Administrador pode visualizar e baixar carteirinhas para impressão.
        </p>
      </div>
    );
  }

  return (
    <div className="cipf-page cipf-page-stack">
      <section className="cipf-panel overflow-hidden print:hidden">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {batchIds.length > 0 && (
            <div className="mb-5 rounded-2xl border border-[#d9e1ea] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#17324d]">
              Lote de impressão ativo: {batchIds.length} carteirinha(s). Baixe a atual para avançar para a próxima.
            </div>
          )}
          <PageHeader
            eyebrow="Serviço interno"
            title="Imprimir Carteirinha de Fibromialgia"
            description="Busque uma carteirinha aprovada ou emitida para gerar o arquivo de impressão em PNG."
            tone="purple"
            className="!border-0 !pb-0"
            actions={
              <div className="cipf-subpanel bg-white px-4 py-3 text-sm leading-6 text-[var(--brand-muted)] lg:max-w-xs">
                <span className="font-semibold text-[var(--brand-ink)]">Acesso administrativo.</span> A emissão da carteirinha é registrada na auditoria do sistema.
              </div>
            }
          />
        </div>

        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-8 sm:px-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#617184]" />
              <Input 
                placeholder="Digite o nome completo, CPF ou Cartão SUS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-12 text-base shadow-sm"
                disabled={isLoading}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isLoading || !searchTerm.trim()}
              size="lg"
            >
              Buscar
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="cipf-panel py-16 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#005eb8]" />
          <p className="text-lg font-semibold tracking-[-0.02em] text-[#1f3657]">Carregando registros...</p>
          <p className="mt-1 text-sm text-[#617184]">Aguarde enquanto buscamos os cadastros disponíveis para impressão.</p>
        </div>
      ) : selectedReg && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <section className="cipf-panel p-5 sm:p-6 print:bg-transparent print:p-0 print:shadow-none">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div>
                <p className="cipf-kicker">Pré-visualização</p>
                <h3 className="cipf-title mt-1 text-xl">{selectedReg.fullName}</h3>
                <p className="cipf-description mt-1 text-sm">Status: {getStatusLabel(selectedReg.status)}</p>
              </div>

              <Button 
                onClick={handlePrint} 
                disabled={!canPrintCarteirinha || isPrinting || (!!photoDataUri && !isImageLoaded)}
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando imagem...
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Baixar imagem PNG
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-[1.75rem] bg-[#f8fbfd] p-4 sm:p-6 print:bg-transparent print:p-0">
              <div className="flex flex-col items-center justify-center gap-8 print:block print:w-full">
                <CarteirinhaPreview 
                  ref={printRef} 
                  registration={selectedReg} 
                  photoDataUri={photoDataUri} 
                  onImageLoad={() => setIsImageLoaded(true)}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
