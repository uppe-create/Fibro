import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Download, FileDown, Minimize2, RefreshCw, Trash2 } from 'lucide-react';
import { buildAuditEvent, getAuditHistoryFilterKey, type AuditEntryRow } from '@/lib/audit-events';
import { normalizeAuditEntries } from '@/lib/audit-history';
import { supabase } from '@/lib/supabase';
import { loadCipfFileDataUri, openInNewTab } from '@/lib/cipf-files';
import { hasPermission } from '@/lib/permissions';
import { buildEditForm, buildSafeRegistrationSummary, buildWhatsAppMessage, normalizeUpper, toDigits, type EditRegistrationForm } from '@/lib/dashboard-utils';
import { useAppStore, type CIPFRegistration } from '@/store/useAppStore';
import { PageHeader } from '@/components/ui/layout';
import { ActionButton, ActionGrid } from './dashboard/components/ActionGrid';
import { DashboardModals } from './dashboard/components/DashboardModals';
import { DashboardQueues } from './dashboard/components/DashboardQueues';
import { DashboardStats } from './dashboard/components/DashboardStats';
import { useDashboardData } from './dashboard/hooks/useDashboardData';
import { useDashboardExports } from './dashboard/hooks/useDashboardExports';
import { useRegistrationWorkflow } from './dashboard/hooks/useRegistrationWorkflow';
import type { ConfirmActionConfig, DashboardModalState } from './dashboard/lib/types';

const PRINT_REGISTRATION_STORAGE_KEY = 'cipf_print_registration_id';
const FOCUS_REGISTRATION_STORAGE_KEY = 'cipf_focus_registration_id';
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

export function Operacao() {
  const { registrations, currentUser, fetchRegistrations, exportDatabase, clearDatabase } = useAppStore();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModalState] = useState<DashboardModalState>(initialModalState);
  const [loadError, setLoadError] = useState('');
  const [editForm, setEditForm] = useState<EditRegistrationForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [internalNote, setInternalNote] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const previewPhotoUri = '';
  const isPreviewLoading = false;
  const [message, setMessage] = useState('');

  const setModal = (patch: Partial<DashboardModalState>) => setModalState((current) => ({ ...current, ...patch }));

  const permissions = {
    canClearDatabase: hasPermission(currentUser, 'clearDatabase'),
    canDeleteRegistration: hasPermission(currentUser, 'deleteRegistration'),
    canEditRegistration: hasPermission(currentUser, 'editRegistration'),
    canExportDashboard: hasPermission(currentUser, 'exportDashboard'),
    canViewDocuments: hasPermission(currentUser, 'viewDocuments'),
    canViewHistory: hasPermission(currentUser, 'viewHistory'),
    canPrintCarteirinha: hasPermission(currentUser, 'printCarteirinha'),
    canApproveRegistration: hasPermission(currentUser, 'approveRegistration'),
    canIssueRegistration: hasPermission(currentUser, 'issueRegistration'),
    canCancelRegistration: hasPermission(currentUser, 'cancelRegistration'),
    canRenewRegistration: hasPermission(currentUser, 'renewRegistration'),
    canReissueRegistration: hasPermission(currentUser, 'reissueRegistration')
  };

  const canRegisterPatientContact = permissions.canApproveRegistration || permissions.canIssueRegistration;
  const canRegisterPickup = permissions.canIssueRegistration;
  const dashboard = useDashboardData(registrations);

  const loadData = async () => {
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar dados da operacao.');
    }
  };

  const workflow = useRegistrationWorkflow({ currentUser, reload: loadData, onError: setMessage });
  const exports = useDashboardExports({ writeAudit: workflow.writeAudit, exportDatabase, onError: setMessage });

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const focusId = sessionStorage.getItem(FOCUS_REGISTRATION_STORAGE_KEY);
    if (!focusId || modal.detailReg || registrations.length === 0) return;
    const focused = registrations.find((reg) => reg.id === focusId);
    if (!focused) return;
    sessionStorage.removeItem(FOCUS_REGISTRATION_STORAGE_KEY);
    setModal({ detailReg: focused });
  }, [modal.detailReg, registrations]);

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
      const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', modal.editReg.id);
      if (registrationError) throw registrationError;
      await supabase.from('public_validations').update({ fullName: payload.fullName, issueDate: payload.issueDate, expiryDate: payload.expiryDate, status: payload.status }).eq('id', modal.editReg.id);
      await supabase.from('registration_index').update({ status: payload.status, updated_at: new Date().toISOString() }).eq('cpf', toDigits(modal.editReg.cpf));
      await workflow.writeAudit(buildAuditEvent('registration.edited', { registrationId: modal.editReg.id, targetLabel: modal.editReg.fullName, details: reason }));
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

  const openDocumentFile = async (reg: CIPFRegistration, kind: DocumentFileKind) => {
    if (!permissions.canViewDocuments) return;
    const fileMap = {
      document: { id: reg.documentFileId, fallback: reg.documentUrl || '', label: 'Documento oficial' },
      proof: { id: reg.proofOfResidenceFileId, fallback: reg.proofOfResidenceUrl || '', label: 'Comprovante de residencia' },
      medical: { id: reg.medicalReportFileId, fallback: reg.medicalReportUrl || '', label: 'Laudo medico' },
      photo: { id: reg.photoFileId, fallback: reg.photoUrl || '', label: 'Foto' }
    };
    const file = fileMap[kind];
    const uri = await loadCipfFileDataUri(file.id, file.fallback);
    if (!uri) {
      setMessage('Arquivo nao encontrado.');
      return;
    }
    openInNewTab(uri);
    await workflow.writeAudit(buildAuditEvent('document.sensitive_viewed', { registrationId: reg.id, targetLabel: reg.fullName, details: file.label }));
  };

  const requestWorkflow = (action: 'approve' | 'issue' | 'cancel' | 'renew' | 'reissue', reg: CIPFRegistration) => {
    const configByAction: Record<typeof action, ConfirmActionConfig> = {
      approve: { title: 'Aprovar cadastro', description: `Aprovar ${reg.fullName}?`, confirmLabel: 'Aprovar', tone: 'success', onConfirm: () => workflow.approve(reg) },
      issue: { title: 'Emitir carteirinha', description: `Emitir e preparar impressão de ${reg.fullName}?`, confirmLabel: 'Emitir', tone: 'success', onConfirm: () => workflow.issue(reg).then(() => goToPrint(reg)) },
      cancel: { title: 'Cancelar carteirinha', description: `Cancelar ${reg.fullName}?`, confirmLabel: 'Cancelar', tone: 'danger', requiresReason: true, reasonLabel: 'Motivo do cancelamento', onConfirm: (reason) => workflow.cancel(reg, reason) },
      renew: { title: 'Renovar cadastro', description: `Iniciar renovação de ${reg.fullName}?`, confirmLabel: 'Renovar', requiresReason: true, reasonLabel: 'Motivo da renovação', onConfirm: (reason) => workflow.renew(reg, reason) },
      reissue: { title: 'Registrar segunda via', description: `Registrar segunda via para ${reg.fullName}?`, confirmLabel: 'Registrar', requiresReason: true, reasonLabel: 'Motivo da segunda via', onConfirm: (reason) => workflow.reissue(reg, reason) }
    };
    setModal({ confirmAction: configByAction[action] });
  };

  const goToPrint = (reg: CIPFRegistration) => {
    sessionStorage.setItem(PRINT_REGISTRATION_STORAGE_KEY, reg.id);
    setModal({ previewReg: null, detailReg: null });
    useAppStore.getState().setActiveTab('carteirinha');
  };

  const confirmWhatsApp = async () => {
    const draft = modal.whatsAppDraft;
    if (!draft) return;
    const { buildWhatsAppUrl } = await import('@/lib/dashboard-utils');
    const url = buildWhatsAppUrl(draft.reg.phone, draft.message || buildWhatsAppMessage(draft.reg, draft.template));
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    await workflow.notifyPatient(draft.reg, `WhatsApp: ${draft.template}`);
    setModal({ whatsAppDraft: null });
  };

  const confirmPickup = async () => {
    const draft = modal.pickupDraft;
    if (!draft || !draft.documentChecked) {
      setMessage('Confirme que o documento apresentado foi conferido.');
      return;
    }
    await workflow.registerPickup(draft.reg, [draft.pickedBy ? `Retirado por: ${draft.pickedBy}` : 'Retirada registrada', draft.note].filter(Boolean).join('; '));
    setModal({ pickupDraft: null });
  };

  const confirmAction = async (config: ConfirmActionConfig, value: string) => {
    await config.onConfirm(value);
    setModal({ confirmAction: null });
  };

  const copySummary = async (reg: CIPFRegistration) => {
    await navigator.clipboard.writeText(buildSafeRegistrationSummary(reg));
    await workflow.writeAudit(buildAuditEvent('export.summary_copied', { registrationId: reg.id, targetLabel: reg.fullName, details: 'Resumo com CPF completo e sem dados medicos sensiveis' }));
  };

  const batchPrint = () => {
    const selected = dashboard.batchPrintableRegistrations.filter((reg) => selectedBatchIds.includes(reg.id));
    if (!selected.length) {
      setMessage('Selecione ao menos uma carteirinha aprovada e sem pendências.');
      return;
    }
    sessionStorage.setItem('cipf_batch_print_ids', JSON.stringify(selected.map((reg) => reg.id)));
    goToPrint(selected[0]);
  };

  return (
    <div className={`cipf-page ${dashboard.filters.isCompactMode ? 'space-y-10' : 'cipf-page-stack'}`}>
      <Header />
      <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-center">
        <div>
          <h3 className="cipf-title text-xl">Aprovar cadastros</h3>
          <p className="cipf-description mt-1 text-sm">Confira documentos, aprove cadastros, avise pacientes, emita carteirinhas e registre retiradas.</p>
        </div>
        <ActionGrid>
          {permissions.canClearDatabase && <ActionButton tone="danger" onClick={() => setModal({ confirmAction: { title: 'Arquivar base', description: 'Digite ARQUIVAR TUDO para confirmar. Registros ativos serão ocultados sem exclusão física.', confirmLabel: 'Arquivar', tone: 'danger', requiredText: 'ARQUIVAR TUDO', onConfirm: async () => { await clearDatabase(); await loadData(); } } })}><Trash2 className="mr-2 h-4 w-4" />Arquivar</ActionButton>}
          {permissions.canExportDashboard && <><ActionButton onClick={() => exports.exportCsv(registrations)}><FileDown className="mr-2 h-4 w-4" />CSV</ActionButton><ActionButton onClick={() => exports.exportPdf(registrations, dashboard.filters)}><Download className="mr-2 h-4 w-4" />PDF</ActionButton><ActionButton onClick={() => exports.exportMonthlyPdf(registrations)}><CalendarClock className="mr-2 h-4 w-4" />Mensal</ActionButton></>}
          <ActionButton onClick={dashboard.filterActions.toggleCompactMode}><Minimize2 className="mr-2 h-4 w-4" />{dashboard.filters.isCompactMode ? 'Confortável' : 'Compacto'}</ActionButton>
          <ActionButton onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</ActionButton>
        </ActionGrid>
      </div>
      {(loadError || message) && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError || message}</div>}
      <DashboardStats stats={dashboard.stats} todayActions={dashboard.todayActions} quickSearchTerm={dashboard.filters.quickSearchTerm} onQuickSearchChange={dashboard.filterActions.setQuickSearchTerm} quickResults={dashboard.quickResults} onOpenDetails={(reg) => setModal({ detailReg: reg })} onCopySummary={copySummary} />
      <DashboardQueues operationalQueue={dashboard.operationalQueue} documentIssueQueue={dashboard.documentIssueQueue} batchPrintableRegistrations={dashboard.batchPrintableRegistrations} selectedBatchIds={selectedBatchIds} setSelectedBatchIds={setSelectedBatchIds} permissions={{ ...permissions, canRegisterPatientContact, canRegisterPickup }} onOpenDetails={(reg) => setModal({ detailReg: reg })} onResolveIssue={(reg) => openEdit(reg)} onApprove={(reg) => requestWorkflow('approve', reg)} onIssue={(reg) => requestWorkflow('issue', reg)} onNotify={(reg, template) => setModal({ whatsAppDraft: { reg, template, message: buildWhatsAppMessage(reg, template) } })} onRegisterNotice={(reg) => workflow.notifyPatient(reg, 'Aviso registrado manualmente')} onPickup={(reg) => setModal({ pickupDraft: { reg, pickedBy: '', documentChecked: false, note: '' } })} onBatchPrint={batchPrint} showDocumentIssues={false} />
      <DashboardModals modal={modal} setModal={setModal} editForm={editForm} updateEditField={updateEditField} saveEdit={saveEdit} isSavingEdit={isSavingEdit} historyFilter={historyFilter} setHistoryFilter={setHistoryFilter} filteredHistoryEntries={filteredHistoryEntries} internalNote={internalNote} setInternalNote={setInternalNote} onAddInternalNote={() => modal.detailReg && workflow.addInternalNote(modal.detailReg, internalNote).then(() => setInternalNote(''))} onCopySummary={copySummary} onResolveIssue={openEdit} onWorkflow={requestWorkflow} onOpenHistory={openHistory} onOpenDocumentFile={openDocumentFile} onConfirmWhatsApp={confirmWhatsApp} onConfirmPickup={confirmPickup} onConfirmAction={confirmAction} onPreviewPrint={(reg) => requestWorkflow('issue', reg)} previewPhotoUri={previewPhotoUri} isPreviewLoading={isPreviewLoading} permissions={permissions} />
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      eyebrow="Operação administrativa"
      title="Aprovações, avisos e emissão"
      description="Fila diária para decidir cadastros, comunicar pacientes e controlar retirada presencial."
      tone="purple"
    />
  );
}
