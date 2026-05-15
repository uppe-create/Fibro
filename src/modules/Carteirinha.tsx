import React, { useEffect, useRef, useState } from 'react';
import { FileBadge2, FileSearch, Image as ImageIcon, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';
import { loadCipfFileDataUri } from '@/lib/cipf-files';
import { isSecureAdminBackendEnabled, runAdminWorkflowRpc } from '@/lib/admin-rpc';
import { hasPermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { buildAuditEvent } from '@/lib/audit-events';
import { getStatusLabel, isPrintableStatus, normalizeRegistrationStatus } from '@/lib/registration-status';
import { CIPFRegistration, useAppStore } from '@/store/useAppStore';

const PRINT_REGISTRATION_STORAGE_KEY = 'cipf_print_registration_id';
const BATCH_PRINT_STORAGE_KEY = 'cipf_batch_print_ids';

export function Carteirinha() {
  const { registrations, fetchRegistrations, currentUser } = useAppStore();
  const canPrintCarteirinha = hasPermission(currentUser, 'printCarteirinha');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState<CIPFRegistration | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [totalBatchCount, setTotalBatchCount] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);
  const queryParams = new URLSearchParams(window.location.search);
  const searchFromUrlRef = useRef(
    queryParams.get('id') || sessionStorage.getItem(PRINT_REGISTRATION_STORAGE_KEY) || queryParams.get('search') || ''
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const parsedBatch = JSON.parse(sessionStorage.getItem(BATCH_PRINT_STORAGE_KEY) || '[]');
        if (Array.isArray(parsedBatch)) {
          const nextBatch = parsedBatch.filter(Boolean);
          setBatchIds(nextBatch);
          setTotalBatchCount(nextBatch.length);
        }
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

    void bootstrap();
  }, [fetchRegistrations, registrations.length]);

  useEffect(() => {
    if (!searchFromUrlRef.current || registrations.length === 0) return;
    void handleSearch(searchFromUrlRef.current);
    sessionStorage.removeItem(PRINT_REGISTRATION_STORAGE_KEY);
    window.history.replaceState({}, '', '/carteirinha');
    searchFromUrlRef.current = '';
  }, [registrations.length]);

  const handleSearch = async (termToSearch?: string) => {
    const term = typeof termToSearch === 'string' ? termToSearch : searchTerm;

    if (!term.trim()) {
      setHasSearched(false);
      setSelectedReg(null);
      setPhotoDataUri('');
      setIsImageLoaded(false);
      return;
    }

    const normalizedTerm = term.trim().toLowerCase();
    const digitsTerm = term.replace(/\D/g, '');
    const found = registrations.find((registration) =>
      registration.id === term ||
      registration.cpf.includes(digitsTerm || term) ||
      (registration.cns || '').includes(digitsTerm || term) ||
      registration.fullName.toLowerCase().includes(normalizedTerm)
    );

    setIsImageLoaded(false);
    setHasSearched(true);

    if (!found) {
      alert('Nenhum cadastro encontrado com este nome ou CPF.');
      setSelectedReg(null);
      setPhotoDataUri('');
      return;
    }

    if (!isPrintableStatus(found.status)) {
      alert(`Cadastro encontrado, mas o status atual e "${getStatusLabel(found.status)}". Apenas carteirinhas aprovadas ou emitidas podem ser impressas.`);
      setSelectedReg(null);
      setPhotoDataUri('');
      return;
    }

    setSelectedReg(found);
    setSearchTerm(found.fullName);
    setPhotoDataUri(await loadCipfFileDataUri(found.photoFileId, found.photoUrl || ''));
  };

  const handlePrint = async () => {
    if (!printRef.current || !selectedReg) return;
    if (!canPrintCarteirinha) {
      alert('Seu perfil nao permite baixar carteirinhas.');
      return;
    }

    const isFirstIssue = normalizeRegistrationStatus(selectedReg.status) === 'approved';
    const confirmMessage = isFirstIssue
      ? `Emitir e baixar a carteirinha de ${selectedReg.fullName}?`
      : `Baixar novamente a carteirinha de ${selectedReg.fullName}?`;

    if (!window.confirm(`${confirmMessage}\n\nConfirme somente se voce revisou os dados da carteirinha.`)) return;

    try {
      setIsPrinting(true);

      if (isFirstIssue) {
        if (isSecureAdminBackendEnabled()) {
          await runAdminWorkflowRpc(selectedReg.id, 'issue', 'Download PNG pelo modulo Carteirinha');
        } else {
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
        }

        await logAuditEvent(buildAuditEvent('card.issued', {
          registrationId: selectedReg.id,
          userId: currentUser?.id || null,
          userName: currentUser?.name || 'Sistema',
          targetLabel: selectedReg.fullName,
          details: 'Download PNG pelo modulo Carteirinha'
        }));

        await fetchRegistrations();
        const refreshed = useAppStore.getState().registrations.find((reg) => reg.id === selectedReg.id);
        if (refreshed) setSelectedReg(refreshed);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(printRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#ffffff'
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
          setPhotoDataUri(await loadCipfFileDataUri(nextReg.photoFileId, nextReg.photoUrl || ''));
          alert(`Carteirinha gerada. Proxima do lote: ${nextReg.fullName}`);
        }
      } else if (batchIds.length === 1) {
        sessionStorage.removeItem(BATCH_PRINT_STORAGE_KEY);
        setBatchIds([]);
        setTotalBatchCount(0);
      }
    } catch {
      alert('Ocorreu um erro ao gerar o arquivo para impressao. Tente novamente.');
    } finally {
      setIsPrinting(false);
    }
  };

  const batchProgress = totalBatchCount > 0 && batchIds.length > 0
    ? {
        current: Math.max(totalBatchCount - batchIds.length + 1, 1),
        total: totalBatchCount,
        percent: Math.round(((totalBatchCount - batchIds.length + 1) / totalBatchCount) * 100),
        nextName: batchIds.length > 1 ? registrations.find((reg) => reg.id === batchIds[1])?.fullName || '' : ''
      }
    : null;

  if (!canPrintCarteirinha) {
    return (
      <div className="cipf-panel mx-auto max-w-xl p-8">
        <EmptyState
          title="Impressao restrita"
          description="Somente administrador pode visualizar e baixar carteirinhas."
          icon={<FileBadge2 className="h-5 w-5" />}
        />
      </div>
    );
  }

  return (
    <div className="cipf-page cipf-page-stack">
      <section className="cipf-panel overflow-hidden print:hidden">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {batchProgress && (
            <div className="mb-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4 text-sm text-[#17324d]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#617184]">Lote de impressao</p>
                  <p className="mt-1 font-semibold">{batchProgress.current} de {batchProgress.total} carteirinhas</p>
                  {batchProgress.nextName ? <p className="mt-1 text-xs text-[#617184]">Proxima: {batchProgress.nextName}</p> : null}
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[var(--fibro-purple)]">
                  {batchProgress.percent}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[var(--fibro-purple)] transition-all duration-300" style={{ width: `${batchProgress.percent}%` }} />
              </div>
            </div>
          )}

          <PageHeader
            eyebrow="Servico interno"
            title="Imprimir Carteirinha de Fibromialgia"
            description="Busque uma carteirinha aprovada ou emitida para gerar o PNG oficial."
            tone="purple"
            className="!border-0 !pb-0"
            actions={
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm text-[var(--brand-muted)]">
                <span className="font-semibold text-[var(--brand-ink)]">Acesso administrativo.</span> Emissao auditada.
              </div>
            }
          />
        </div>

        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-6 sm:px-10 sm:py-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#617184]" />
              <Input
                placeholder="Digite nome, CPF ou Cartao SUS..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void handleSearch()}
                className="h-12 pl-12 text-base shadow-sm"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={() => void handleSearch()}
              disabled={isLoading || !searchTerm.trim()}
              size="lg"
              className="w-full sm:w-auto"
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
          <p className="mt-1 text-sm text-[#617184]">Aguarde enquanto buscamos os cadastros disponiveis para impressao.</p>
        </div>
      ) : selectedReg ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <section className="cipf-panel p-4 sm:p-6 print:bg-transparent print:p-0 print:shadow-none">
            <div className="mb-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-4 print:hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="cipf-kicker">Pre-visualizacao</p>
                  <h3 className="cipf-title mt-1 break-words text-lg sm:text-xl">{selectedReg.fullName}</h3>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">Status: {getStatusLabel(selectedReg.status)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--border-subtle)] bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-[#617184]">
                    PNG oficial
                  </span>
                  <Button
                    onClick={handlePrint}
                    disabled={!canPrintCarteirinha || isPrinting || (!!photoDataUri && !isImageLoaded)}
                    className="w-full sm:w-auto"
                  >
                    {isPrinting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando imagem...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Baixar PNG
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3 sm:p-5 print:border-0 print:bg-transparent print:p-0">
              <div className="flex min-w-[360px] flex-col items-center justify-center gap-8 print:block print:w-full">
                <div className="origin-top scale-[0.82] sm:scale-100">
                  <CarteirinhaPreview
                    ref={printRef}
                    registration={selectedReg}
                    photoDataUri={photoDataUri}
                    onImageLoad={() => setIsImageLoaded(true)}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className="cipf-panel p-6 sm:p-8">
          <EmptyState
            title={hasSearched ? 'Nenhuma carteirinha encontrada' : 'Busque uma carteirinha'}
            description={
              hasSearched
                ? 'Tente outro nome, CPF ou Cartao SUS para localizar a emissao.'
                : 'Digite nome, CPF ou Cartao SUS para abrir a pre-visualizacao e gerar o PNG oficial.'
            }
            icon={<FileSearch className="h-5 w-5" />}
            action={
              hasSearched
                ? <Button type="button" variant="outline" onClick={() => { setSearchTerm(''); setHasSearched(false); }}>Limpar busca</Button>
                : undefined
            }
          />
        </section>
      )}
    </div>
  );
}
