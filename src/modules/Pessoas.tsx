import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileDown, Minimize2, Plus, RefreshCw } from 'lucide-react';
import { buildAuditEvent, getAuditHistoryFilterKey, type AuditEntryRow } from '@/lib/audit-events';
import { isSecureAdminBackendEnabled, updateRegistrationSecure } from '@/lib/admin-rpc';
import { normalizeAuditEntries } from '@/lib/audit-history';
import { supabase } from '@/lib/supabase';
import { loadCipfFileDataUri, openInNewTab } from '@/lib/cipf-files';
import { hasPermission } from '@/lib/permissions';
import { buildEditForm, buildSafeRegistrationSummary, normalizeUpper, toDigits, type EditRegistrationForm } from '@/lib/dashboard-utils';
import { useAppStore, type CIPFRegistration } from '@/store/useAppStore';
import { PageHeader } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { ActionButton, ActionGrid } from './dashboard/components/ActionGrid';
import { DashboardFilters } from './dashboard/components/DashboardFilters';
import { DashboardModals } from './dashboard/components/DashboardModals';
import { DashboardResults } from './dashboard/components/DashboardResults';
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { useDashboardExports } from './dashboard/hooks/useDashboardExports';
import { useRegistrationWorkflow } from './dashboard/hooks/useRegistrationWorkflow';
import type { ConfirmActionConfig, DashboardModalState } from './dashboard/lib/types';
import { Auditoria } from './Auditoria';

const PEOPLE_SEARCH_STORAGE_KEY = 'cipf_people_search';
type DocumentFileKind = 'document' | 'proof' | 'medical' | 'photo';

const initialModalState: DashboardModalState = {
  detailReg: null,
  editReg: null,
  history: null,
  previewReg: null,
  deleteReg: null,
  clearDatabaseOpen: false,
  whatsAppDraft: null,
  pickupDraft: null,
  confirmAction: null,
  editFocusSection: null
};

export function Pessoas() {
  const { registrations, currentUser, fetchRegistrations, exportDatabase, setActiveTab } = useAppStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const didLoadExternalSearch = useRef(false);
  const [modal, setModalState] = useState<DashboardModalState>(initialModalState);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditRegistrationForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [internalNote, setInternalNote] = useState('');
  const [previewPhotoUri, setPreviewPhotoUri] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [message, setMessage] = useState('');

  const setModal = (patch: Partial<DashboardModalState>) => setModalState((current) => ({ ...current, ...patch }));

  const permissions = {
    canDeleteRegistration: false,
    canEditRegistration: hasPermission(currentUser, 'editRegistration'),
    canExportDashboard: hasPermission(currentUser, 'exportDashboard'),
    canViewDocuments: hasPermission(currentUser, 'viewSensitiveDocuments'),
    canViewHistory: hasPermission(currentUser, 'viewHistory'),
    canViewFullCpf: hasPermission(currentUser, 'viewFullCpf'),
    canPrintCarteirinha: false,
    canApproveRegistration: false,
    canIssueRegistration: false,
    canCancelRegistration: false,
    canRenewRegistration: false,
    canReissueRegistration: false
  };

  const dashboard = useDashboardData(registrations);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar pessoas cadastradas.');
    } finally {
      setIsLoading(false);
    }
  };

  const workflow = useRegistrationWorkflow({
    currentUser,
    reload: loadData,
    onError: setMessage
  });

  const exports = useDashboardExports({
    writeAudit: workflow.writeAudit,
    exportDatabase,
    onError: setMessage
  });

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (didLoadExternalSearch.current) return;
    const externalSearch = sessionStorage.getItem(PEOPLE_SEARCH_STORAGE_KEY);
    if (externalSearch) {
      dashboard.filterActions.setSearchTerm(externalSearch);
      sessionStorage.removeItem(PEOPLE_SEARCH_STORAGE_KEY);
    }
    didLoadExternalSearch.current = true;
  }, [dashboard.filterActions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredHistoryEntries = useMemo(() => {
    if (!modal.history) return [];
    if (historyFilter === 'all') return modal.history.entries;
    return modal.history.entries.filter((entry) => getAuditHistoryFilterKey(entry) === historyFilter);
  }, [historyFilter, modal.history]);

  const updateEditField = <K extends keyof EditRegistrationForm>(field: K, value: EditRegistrationForm[K]) => {
    setEditForm((previous) => (previous ? { ...previous, [field]: value } : previous));
  };

  const openEdit = (reg: CIPFRegistration) => {
    setEditForm(buildEditForm(reg));
    setModal({ editReg: reg });
  };

  const saveEdit = async () => {
    if (!modal.editReg || !editForm || !permissions.canEditRegistration) return;
    setModal({
      confirmAction: {
        title: 'Confirmar edição',
        description: `Salvar alterações no cadastro de ${modal.editReg.fullName}?`,
        confirmLabel: 'Salvar alterações',
        requiresReason: true,
        reasonLabel: 'Motivo da edição',
        onConfirm: async (reason) => {
          await persistEdit(reason);
        }
      }
    });
  };

  const persistEdit = async (reason: string) => {
    if (!modal.editReg || !editForm) return;
    try {
      setIsSavingEdit(true);
      const payload = {
        fullName: normalizeUpper(editForm.fullName),
        cns: toDigits(editForm.cns) || null,
        phone: toDigits(editForm.phone),
        birthDate: editForm.birthDate,
        legalGuardian: editForm.legalGuardian ? normalizeUpper(editForm.legalGuardian) : null,
        cep: toDigits(editForm.cep),
        logradouro: normalizeUpper(editForm.logradouro),
        bairro: normalizeUpper(editForm.bairro),
        cidade: normalizeUpper(editForm.cidade),
        estado: editForm.estado.trim().toUpperCase(),
        cid: editForm.cid.trim().toUpperCase(),
        justificativaCid: editForm.justificativaCid || null,
        crm: editForm.crm.trim().toUpperCase(),
        proofOfResidenceDate: editForm.proofOfResidenceDate || null,
        medicalReportDate: editForm.medicalReportDate || null,
        issueDate: editForm.issueDate,
        expiryDate: editForm.expiryDate,
        status: editForm.status
      };

      if (isSecureAdminBackendEnabled()) {
        await updateRegistrationSecure(modal.editReg.id, payload, reason);
      } else {
        const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', modal.editReg.id);
        if (registrationError) throw registrationError;

        await supabase
          .from('public_validations')
          .update({ fullName: payload.fullName, issueDate: payload.issueDate, expiryDate: payload.expiryDate, status: payload.status })
          .eq('id', modal.editReg.id);
        await supabase.from('registration_index').update({ status: payload.status, updated_at: new Date().toISOString() }).eq('cpf', toDigits(modal.editReg.cpf));
        await workflow.writeAudit(buildAuditEvent('registration.edited', { registrationId: modal.editReg.id, targetLabel: modal.editReg.fullName, details: reason }));
      }

      setModal({ editReg: null, confirmAction: null, editFocusSection: null });
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Erro ao salvar edição.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openHistory = async (reg: CIPFRegistration) => {
    if (!permissions.canViewHistory) return;
    const { data, error } = await supabase.from('audit_logs').select('*').eq('registrationId', reg.id).order('timestamp', { ascending: false });
    if (error) {
      setMessage('Erro ao buscar histórico.');
      return;
    }
    setHistoryFilter('all');
    setModal({ detailReg: null, history: { fullName: reg.fullName, entries: normalizeAuditEntries((data || []) as AuditEntryRow[]) } });
  };

  const openPreview = async (reg: CIPFRegistration) => {
    setModal({ previewReg: reg });
    setIsPreviewLoading(true);
    setPreviewPhotoUri(await loadCipfFileDataUri(reg.photoFileId, reg.photoUrl || ''));
    setIsPreviewLoading(false);
  };

  const openDocument = async (reg: CIPFRegistration) => {
    if (!permissions.canViewDocuments) return;
    const dataUri = await loadCipfFileDataUri(reg.medicalReportFileId, reg.medicalReportUrl || '');
    if (dataUri) {
      openInNewTab(dataUri);
      await workflow.writeAudit(buildAuditEvent('document.sensitive_viewed', { registrationId: reg.id, targetLabel: reg.fullName, details: 'Laudo medico' }));
    }
  };

  const openDocumentFile = async (reg: CIPFRegistration, kind: DocumentFileKind) => {
    if (!permissions.canViewDocuments) return;
    const fileMap = {
      document: { id: reg.documentFileId, fallback: reg.documentUrl || '', label: 'Documento oficial' },
      proof: { id: reg.proofOfResidenceFileId, fallback: reg.proofOfResidenceUrl || '', label: 'Comprovante de residencia' },
      medical: { id: reg.medicalReportFileId, fallback: reg.medicalReportUrl || '', label: 'Laudo medico' },
      photo: { id: reg.photoFileId, fallback: reg.photoUrl || '', label: 'Foto' }
    };
    const file = fileMap[kind];
    const dataUri = await loadCipfFileDataUri(file.id, file.fallback);
    if (dataUri) {
      openInNewTab(dataUri);
      await workflow.writeAudit(buildAuditEvent('document.sensitive_viewed', { registrationId: reg.id, targetLabel: reg.fullName, details: file.label }));
    }
  };

  const confirmAction = async (config: ConfirmActionConfig, value: string) => {
    await config.onConfirm(value);
    setModal({ confirmAction: null });
  };

  const copySummary = async (reg: CIPFRegistration) => {
    await navigator.clipboard.writeText(buildSafeRegistrationSummary(reg, permissions.canViewFullCpf));
    await workflow.writeAudit(buildAuditEvent('export.summary_copied', { registrationId: reg.id, targetLabel: reg.fullName, details: `Resumo com CPF ${permissions.canViewFullCpf ? 'completo' : 'mascarado'} e sem dados medicos sensiveis` }));
  };

  return (
    <div className={`cipf-page ${dashboard.filters.isCompactMode ? 'space-y-10' : 'cipf-page-stack'}`}>
      <Header
        count={dashboard.filteredRegistrations.length}
        canExport={permissions.canExportDashboard}
        onExport={() => exports.exportCsv(dashboard.filteredRegistrations)}
        onNew={() => setActiveTab('cadastro')}
      />

      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <h3 className="cipf-title text-xl">Cadastros</h3>
          <p className="cipf-description mt-1 text-sm">{dashboard.filteredRegistrations.length} registro(s) · consulta interna com CPF {permissions.canViewFullCpf ? 'completo' : 'mascarado'}.</p>
        </div>
        <ActionGrid>
          {permissions.canExportDashboard && (
            <>
              <ActionButton onClick={() => exports.exportCsv(dashboard.filteredRegistrations)}><FileDown className="mr-2 h-4 w-4" />CSV</ActionButton>
              <ActionButton onClick={() => exports.exportPdf(dashboard.filteredRegistrations, dashboard.filters)}><Download className="mr-2 h-4 w-4" />PDF</ActionButton>
            </>
          )}
          <ActionButton onClick={dashboard.filterActions.toggleCompactMode}><Minimize2 className="mr-2 h-4 w-4" />{dashboard.filters.isCompactMode ? 'Confortável' : 'Compacto'}</ActionButton>
          <ActionButton onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</ActionButton>
        </ActionGrid>
      </div>

      {(loadError || message) && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError || message}</div>}

      <DashboardFilters filters={dashboard.filters} actions={dashboard.filterActions} cidOptions={dashboard.cidOptions} bairroOptions={dashboard.bairroOptions} searchInputRef={searchInputRef} />
      <DashboardResults registrations={dashboard.filteredRegistrations} isLoading={isLoading} permissions={permissions} onPreview={openPreview} onDetails={(reg) => setModal({ detailReg: reg })} onEdit={openEdit} onDocument={openDocument} onHistory={openHistory} onDelete={() => undefined} onResetFilters={dashboard.filterActions.clearFilters} />

      {hasPermission(currentUser, 'viewAudit') && (
        <section className="pt-2">
          <Auditoria />
        </section>
      )}

      <DashboardModals
        modal={modal}
        setModal={setModal}
        editForm={editForm}
        updateEditField={updateEditField}
        saveEdit={saveEdit}
        isSavingEdit={isSavingEdit}
        historyFilter={historyFilter}
        setHistoryFilter={setHistoryFilter}
        filteredHistoryEntries={filteredHistoryEntries}
        internalNote={internalNote}
        setInternalNote={setInternalNote}
        onAddInternalNote={() => modal.detailReg && workflow.addInternalNote(modal.detailReg, internalNote).then(() => setInternalNote(''))}
        onCopySummary={copySummary}
        onResolveIssue={openEdit}
        onWorkflow={() => undefined}
        onOpenHistory={openHistory}
        onOpenDocumentFile={openDocumentFile}
        onConfirmWhatsApp={() => undefined}
        onConfirmPickup={() => undefined}
        onConfirmAction={confirmAction}
        onPreviewPrint={() => undefined}
        previewPhotoUri={previewPhotoUri}
        isPreviewLoading={isPreviewLoading}
        permissions={permissions}
      />
    </div>
  );
}

function Header({
  count,
  canExport,
  onExport,
  onNew
}: {
  count: number;
  canExport: boolean;
  onExport: () => void;
  onNew: () => void;
}) {
  return (
    <PageHeader
      eyebrow="Início / Cadastros"
      title="Cadastros"
      description={`${count} registro(s) · atualizado agora`}
      tone="purple"
      actions={
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <Button type="button" variant="outline" onClick={onExport} className="h-10">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
          <Button type="button" onClick={onNew} className="h-10 bg-[var(--fibro-purple)] text-white hover:bg-[var(--fibro-purple-strong)]">
            <Plus className="mr-2 h-4 w-4" />
            Novo cadastro
          </Button>
        </div>
      }
    />
  );
}
