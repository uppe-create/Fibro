import { useEffect, useMemo, useState } from 'react';
import { FileWarning, RefreshCw, Search, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { formatCpfByPermission, getDocumentIssues, toDigits } from '@/lib/dashboard-utils';
import { hasPermission } from '@/lib/permissions';
import { getStatusLabel } from '@/lib/registration-status';
import { useAppStore, type CIPFRegistration } from '@/store/useAppStore';

const PEOPLE_SEARCH_STORAGE_KEY = 'cipf_people_search';
const FOCUS_REGISTRATION_STORAGE_KEY = 'cipf_focus_registration_id';

export function Documentos() {
  const { registrations, currentUser, fetchRegistrations, setActiveTab } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canViewFullCpf = hasPermission(currentUser, 'viewFullCpf');

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar pendencias documentais.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const externalSearch = sessionStorage.getItem(PEOPLE_SEARCH_STORAGE_KEY);
    const focusId = sessionStorage.getItem(FOCUS_REGISTRATION_STORAGE_KEY);
    if (externalSearch) {
      setSearchTerm(externalSearch);
      sessionStorage.removeItem(PEOPLE_SEARCH_STORAGE_KEY);
      sessionStorage.removeItem(FOCUS_REGISTRATION_STORAGE_KEY);
      return;
    }
    if (!focusId || registrations.length === 0) return;
    const focused = registrations.find((reg) => reg.id === focusId);
    if (!focused) return;
    setSearchTerm(toDigits(focused.cpf) || focused.fullName);
    sessionStorage.removeItem(FOCUS_REGISTRATION_STORAGE_KEY);
  }, [registrations]);

  const documentQueue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const digits = toDigits(searchTerm);
    return registrations
      .map((registration) => ({ registration, issues: getDocumentIssues(registration) }))
      .filter((item) => item.issues.length > 0)
      .filter((item) => {
        if (!term && !digits) return true;
        const reg = item.registration;
        return (
          reg.fullName.toLowerCase().includes(term) ||
          toDigits(reg.cpf).includes(digits) ||
          (reg.bairro || '').toLowerCase().includes(term) ||
          item.issues.some((issue) => issue.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => b.issues.length - a.issues.length || a.registration.fullName.localeCompare(b.registration.fullName));
  }, [registrations, searchTerm]);

  const openInPeople = (reg: CIPFRegistration) => {
    sessionStorage.setItem(PEOPLE_SEARCH_STORAGE_KEY, toDigits(reg.cpf) || reg.fullName);
    setActiveTab('pessoas');
  };

  return (
    <div className="cipf-page cipf-page-stack">
      <Header onRefresh={loadData} isLoading={isLoading} />

      {loadError && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>}

      <section className="cipf-panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="cipf-kicker">Fila documental</p>
            <h3 className="cipf-title mt-2 text-2xl">{documentQueue.length} cadastro(s) com pendencia</h3>
            <p className="cipf-description mt-2 max-w-2xl text-sm">Use esta tela para revisar foto, documento, comprovante e laudo antes de aprovar ou emitir.</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-muted)]" />
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nome, CPF, bairro ou pendencia..." className="pl-10" />
          </div>
        </div>

        <div className="grid gap-4">
          {documentQueue.map(({ registration, issues }) => (
            <div key={registration.id} className="rounded-2xl border border-amber-200 bg-amber-50/65 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-[var(--brand-ink)]">{registration.fullName}</p>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800">{issues.length} pendencia(s)</span>
                  </div>
                  <p className="mt-1 text-xs text-[#617184]">{formatCpfByPermission(registration.cpf, canViewFullCpf)} • {getStatusLabel(registration.status)} • {registration.bairro || 'Bairro nao informado'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {issues.map((issue) => (
                      <span key={issue} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
                <Button type="button" onClick={() => openInPeople(registration)}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Resolver em Pessoas
                </Button>
              </div>
            </div>
          ))}
          {!documentQueue.length && (
            <EmptyState
              title="Fila documental vazia"
              description="Nenhuma pendencia encontrada com os filtros atuais."
              icon={<FileWarning className="h-5 w-5" />}
              action={<Button type="button" variant="outline" onClick={() => setSearchTerm('')}>Limpar busca</Button>}
              className="text-sm"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Header({ onRefresh, isLoading }: { onRefresh: () => void; isLoading: boolean }) {
  return (
    <PageHeader
      eyebrow="Documentos"
      title="Pendencias documentais"
      description="Uma fila separada para conferir documentos sem poluir o Dashboard."
      tone="purple"
      actions={
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      }
    />
  );
}
