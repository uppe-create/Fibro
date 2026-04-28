import React, { useMemo, useState } from 'react';
import { useAppStore, CIPFRegistration } from '@/store/useAppStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ModalShell } from '@/components/ui/modal-shell';
import {
  Search,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Trash2,
  Users,
  Clock,
  CheckCircle,
  RefreshCw,
  Loader2,
  Download,
  FileBadge2,
  X,
  FileDown,
  CalendarClock,
  Filter,
  Pencil,
  Save,
  Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';
import { parseBRDate } from '@/lib/date';
import { loadCipfFileDataUri, openInNewTab } from '@/lib/cipf-files';
import { logAuditEvent } from '@/lib/audit';
import { hasPermission } from '@/lib/permissions';
import { formatCNS } from '@/lib/utils';
import {
  WORKFLOW_STATUS_OPTIONS,
  canApproveStatus,
  canCancelStatus,
  canIssueStatus,
  canReissueStatus,
  canRenewStatus,
  getStatusBadgeClass,
  getStatusLabel,
  isPrintableStatus,
  normalizeRegistrationStatus,
  type RegistrationStatus
} from '@/lib/registration-status';
import {
  buildAgeStats,
  buildBairroStats,
  buildEditForm,
  buildStats,
  datePlusYearsBR,
  filterDashboardRegistrations,
  getExpiryHighlight,
  maskCpf,
  normalizeForExport,
  normalizeUpper,
  todayBR,
  toDigits,
  type EditRegistrationForm,
  type ReviewFilter,
  type StatusFilter
} from '@/lib/dashboard-utils';
import jsPDF from 'jspdf';

type TimelineEntry = {
  action: string;
  timestamp: string;
  userName: string;
  reason?: string;
};

const PRINT_REGISTRATION_STORAGE_KEY = 'cipf_print_registration_id';

export function Dashboard() {
  const { registrations, currentUser, fetchRegistrations } = useAppStore();
  const canClearDatabase = hasPermission(currentUser, 'clearDatabase');
  const canDeleteRegistration = hasPermission(currentUser, 'deleteRegistration');
  const canEditRegistration = hasPermission(currentUser, 'editRegistration');
  const canExportDashboard = hasPermission(currentUser, 'exportDashboard');
  const canViewDocuments = hasPermission(currentUser, 'viewDocuments');
  const canViewHistory = hasPermission(currentUser, 'viewHistory');
  const canPrintCarteirinha = hasPermission(currentUser, 'printCarteirinha');
  const canApproveRegistration = hasPermission(currentUser, 'approveRegistration');
  const canIssueRegistration = hasPermission(currentUser, 'issueRegistration');
  const canCancelRegistration = hasPermission(currentUser, 'cancelRegistration');
  const canRenewRegistration = hasPermission(currentUser, 'renewRegistration');
  const canReissueRegistration = hasPermission(currentUser, 'reissueRegistration');
  const [searchTerm, setSearchTerm] = useState('');
  const [cidFilter, setCidFilter] = useState('all');
  const [bairroFilter, setBairroFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expiring30'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [loadError, setLoadError] = useState('');

  const [viewHistory, setViewHistory] = useState<{ fullName: string; entries: TimelineEntry[] } | null>(null);
  const [regToDelete, setRegToDelete] = useState<CIPFRegistration | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [showClearDbModal, setShowClearDbModal] = useState(false);
  const [clearDbConfirmation, setClearDbConfirmation] = useState('');
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editReg, setEditReg] = useState<CIPFRegistration | null>(null);
  const [editForm, setEditForm] = useState<EditRegistrationForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [detailReg, setDetailReg] = useState<CIPFRegistration | null>(null);

  const [previewReg, setPreviewReg] = useState<CIPFRegistration | null>(null);
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  // Keep audit payloads consistent if auth changes later.
  const writeAudit = async (action: string, registrationId?: string, reason?: string) => {
    await logAuditEvent({
      action,
      registrationId: registrationId || null,
      userId: currentUser?.id || null,
      userName: currentUser?.name || 'Sistema',
      reason
    });
  };

  const updateRegistrationWorkflow = async (
    reg: CIPFRegistration,
    nextStatus: RegistrationStatus,
    action: string,
    reason: string,
    extraFields: Partial<Pick<CIPFRegistration, 'issueDate' | 'expiryDate'>> = {}
  ) => {
    const payload = { status: nextStatus, ...extraFields };
    const indexPayload = { status: nextStatus, updated_at: new Date().toISOString() };

    const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', reg.id);
    if (registrationError) throw registrationError;

    const { error: publicError } = await supabase.from('public_validations').update(payload).eq('id', reg.id);
    if (publicError) throw publicError;

    const { error: indexError } = await supabase.from('registration_index').update(indexPayload).eq('cpf', toDigits(reg.cpf));
    if (indexError) throw indexError;

    await writeAudit(action, reg.id, reason);

    const updatedReg = { ...reg, ...payload };
    setDetailReg((current) => (current?.id === reg.id ? updatedReg : current));
    setPreviewReg((current) => (current?.id === reg.id ? updatedReg : current));
    await loadData();
    return updatedReg;
  };

  const requireReason = (message: string) => {
    const reason = window.prompt(message);
    const trimmed = reason?.trim();
    if (!trimmed) {
      alert('Informe um motivo para manter a auditoria completa.');
      return null;
    }
    return trimmed;
  };

  const handleApproveRegistration = async (reg: CIPFRegistration) => {
    if (!canApproveRegistration || !canApproveStatus(reg.status)) {
      alert('Este cadastro nao pode ser aprovado pelo seu perfil ou pelo status atual.');
      return;
    }
    try {
      await updateRegistrationWorkflow(reg, 'approved', 'Cadastro Aprovado', 'Cadastro aprovado para emissao administrativa');
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao aprovar cadastro.');
    }
  };

  const handleCancelRegistration = async (reg: CIPFRegistration) => {
    if (!canCancelRegistration || !canCancelStatus(reg.status)) {
      alert('Apenas administradores podem cancelar cadastros ativos.');
      return;
    }
    const reason = requireReason('Digite o motivo do cancelamento da carteirinha:');
    if (!reason) return;
    try {
      await updateRegistrationWorkflow(reg, 'cancelled', 'Carteirinha Cancelada', reason);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao cancelar carteirinha.');
    }
  };

  const handleRenewRegistration = async (reg: CIPFRegistration) => {
    if (!canRenewRegistration || !canRenewStatus(reg.status)) {
      alert('Este cadastro nao pode ser renovado pelo seu perfil ou pelo status atual.');
      return;
    }
    const reason = requireReason('Digite o motivo da renovacao:');
    if (!reason) return;
    const issueDate = todayBR();
    const expiryDate = datePlusYearsBR(2);
    try {
      await updateRegistrationWorkflow(reg, 'approved', 'Renovacao Iniciada', `${reason}; nova validade=${expiryDate}`, {
        issueDate,
        expiryDate
      });
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao renovar cadastro.');
    }
  };

  const handleReissueRegistration = async (reg: CIPFRegistration) => {
    if (!canReissueRegistration || !canReissueStatus(reg.status)) {
      alert('Apenas administradores podem registrar segunda via de carteirinhas emitidas.');
      return;
    }
    const reason = requireReason('Digite o motivo da segunda via:');
    if (!reason) return;
    await writeAudit('Segunda Via Registrada', reg.id, reason);
    await handlePreviewCarteirinha(reg);
  };

  const handleIssueAndPrint = async (reg: CIPFRegistration) => {
    if (!canIssueRegistration || !canPrintCarteirinha || !canIssueStatus(reg.status)) {
      alert('Apenas administradores podem emitir ou imprimir carteirinhas aprovadas.');
      return;
    }
    try {
      if (normalizeRegistrationStatus(reg.status) === 'approved') {
        await updateRegistrationWorkflow(reg, 'issued', 'Carteirinha Emitida', 'Emissao administrativa para impressao', {
          issueDate: todayBR(),
          expiryDate: datePlusYearsBR(2)
        });
      } else {
        await writeAudit('Acesso a Impressao', reg.id, 'Carteirinha ja emitida');
      }
      sessionStorage.setItem(PRINT_REGISTRATION_STORAGE_KEY, reg.id);
      setPreviewReg(null);
      setDetailReg(null);
      useAppStore.getState().setActiveTab('carteirinha');
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao preparar impressao.');
    }
  };

  const handlePreviewCarteirinha = async (reg: CIPFRegistration) => {
    if (!canPrintCarteirinha || !isPrintableStatus(reg.status)) {
      alert('A pre-visualizacao de carteirinha fica disponivel somente para administradores e cadastros aprovados/emitidos.');
      return;
    }
    setPreviewReg(reg);
    setIsPreviewLoading(true);
    const photoUri = await loadCipfFileDataUri(reg.photoFileId, reg.photoUrl || '');
    setPreviewPhotoUri(photoUri);
    setIsPreviewLoading(false);
  };

  const handleEditClick = (reg: CIPFRegistration) => {
    if (!canEditRegistration) {
      alert('Seu perfil nao permite editar cadastros.');
      return;
    }
    setEditReg(reg);
    setEditForm(buildEditForm(reg));
  };

  const updateEditField = <K extends keyof EditRegistrationForm>(field: K, value: EditRegistrationForm[K]) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveEdit = async () => {
    if (!editReg || !editForm) return;
    if (!canEditRegistration) {
      alert('Seu perfil nao permite salvar alteracoes.');
      return;
    }

    const fullName = normalizeUpper(editForm.fullName);
    const bairro = normalizeUpper(editForm.bairro);
    const cidade = normalizeUpper(editForm.cidade);
    const estado = editForm.estado.trim().toUpperCase();
    const cid = editForm.cid.trim().toUpperCase();
    const cnsClean = toDigits(editForm.cns);
    const criticalChanges = [
      fullName !== editReg.fullName ? 'nome' : '',
      cnsClean !== toDigits(editReg.cns || '') ? 'cartao SUS' : '',
      editForm.medicalReportDate !== (editReg.medicalReportDate || '') ? 'data do laudo' : '',
      editForm.proofOfResidenceDate !== (editReg.proofOfResidenceDate || '') ? 'data do comprovante' : '',
      editForm.issueDate !== editReg.issueDate ? 'emissao' : '',
      editForm.expiryDate !== editReg.expiryDate ? 'validade' : '',
      editForm.status !== normalizeRegistrationStatus(editReg.status) ? 'status' : ''
    ].filter(Boolean);

    if (fullName.length < 3) {
      alert('Informe um nome valido.');
      return;
    }
    if (cnsClean && cnsClean.length !== 15) {
      alert('Cartao SUS deve ter 15 digitos.');
      return;
    }
    if (!editForm.birthDate || !editForm.issueDate || !editForm.expiryDate) {
      alert('Data de nascimento, emissao e validade sao obrigatorias.');
      return;
    }
    const editReason = criticalChanges.length
      ? requireReason(`Voce alterou campo(s) sensivel(is): ${criticalChanges.join(', ')}. Informe o motivo da edicao:`)
      : 'Edicao administrativa sem alteracao critica';
    if (!editReason) return;

    try {
      setIsSavingEdit(true);
      // CPF stays locked because registration_index is the uniqueness key for
      // the current non-cancelled workflow.
      const payload = {
        fullName,
        cns: cnsClean || null,
        phone: toDigits(editForm.phone),
        birthDate: editForm.birthDate,
        legalGuardian: editForm.legalGuardian ? normalizeUpper(editForm.legalGuardian) : null,
        cep: toDigits(editForm.cep),
        logradouro: normalizeUpper(editForm.logradouro),
        bairro,
        cidade,
        estado,
        cid,
        justificativaCid: editForm.justificativaCid || null,
        crm: editForm.crm.trim().toUpperCase(),
        proofOfResidenceDate: editForm.proofOfResidenceDate || null,
        medicalReportDate: editForm.medicalReportDate || null,
        issueDate: editForm.issueDate,
        expiryDate: editForm.expiryDate,
        status: editForm.status
      };

      const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', editReg.id);
      if (registrationError) throw registrationError;

      const { error: publicError } = await supabase
        .from('public_validations')
        .update({
          fullName,
          issueDate: editForm.issueDate,
          expiryDate: editForm.expiryDate,
          status: editForm.status
        })
        .eq('id', editReg.id);
      if (publicError) throw publicError;

      const { error: indexError } = await supabase
        .from('registration_index')
        .update({ status: editForm.status, updated_at: new Date().toISOString() })
        .eq('cpf', toDigits(editReg.cpf));
      if (indexError) throw indexError;

      await writeAudit(
        'Edicao de Cadastro',
        editReg.id,
        `${editReason}; campos atualizados para ${fullName}; status=${editForm.status}; cns=${cnsClean ? 'informado' : 'nao-informado'}`
      );
      setEditReg(null);
      setEditForm(null);
      await loadData();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao salvar edicao.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar dados do dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  const cidOptions = useMemo(
    () => ['all', ...Array.from(new Set(registrations.map((r) => r.cid).filter(Boolean) as string[])).sort()],
    [registrations]
  );

  const bairroOptions = useMemo(
    () => ['all', ...Array.from(new Set(registrations.map((r) => r.bairro).filter(Boolean) as string[])).sort()],
    [registrations]
  );

  const filteredRegistrations = useMemo(() => {
    return filterDashboardRegistrations(registrations, {
      searchTerm,
      cidFilter,
      bairroFilter,
      statusFilter,
      expiryFilter,
      reviewFilter
    });
  }, [registrations, searchTerm, cidFilter, bairroFilter, statusFilter, expiryFilter, reviewFilter]);

  const stats = useMemo(() => buildStats(registrations, filteredRegistrations), [registrations, filteredRegistrations]);

  const statCards = [
    { label: 'Em analise', value: stats.underReview, icon: Clock, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Aprovadas', value: stats.approved, icon: CheckCircle, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Emitidas', value: stats.issued, icon: FileBadge2, tone: 'bg-[#eaf4ee] text-[#1f8a58]' },
    { label: 'Vencendo 30d', value: stats.expiring30, icon: Clock, tone: 'bg-[#fff8dc] text-[#8a6500]' },
    { label: 'Canceladas', value: stats.cancelled, icon: X, tone: 'bg-zinc-100 text-zinc-700' },
    { label: 'Pend. docs', value: stats.documentIssues, icon: AlertTriangle, tone: 'bg-red-50 text-red-700' },
    { label: 'Resultado filtrado', value: stats.filtered, icon: Filter, tone: 'bg-[#f3f6f9] text-[#17324d]' }
  ];

  const bairroStats = useMemo(() => buildBairroStats(filteredRegistrations), [filteredRegistrations]);

  const ageStats = useMemo(() => buildAgeStats(filteredRegistrations), [filteredRegistrations]);

  const handleViewMedicalDoc = async (reg: CIPFRegistration) => {
    if (!canViewDocuments) {
      alert('Seu perfil nao permite abrir documentos anexos.');
      return;
    }
    const fileId = reg.medicalReportFileId;
    const fileUrl = reg.medicalReportUrl;
    if (!fileId && !fileUrl) {
      alert('Documento nao encontrado.');
      return;
    }
    try {
      setIsLoading(true);
      const dataUri = await loadCipfFileDataUri(fileId, fileUrl || '');
      if (!dataUri) throw new Error('Arquivo nao encontrado no banco.');
      openInNewTab(dataUri);
      await writeAudit('Visualizacao de Laudo Medico', reg.id);
    } catch (error) {
      console.error(error);
      alert('Erro ao abrir o documento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewHistory = async (reg: CIPFRegistration) => {
    if (!canViewHistory) {
      alert('Seu perfil nao permite visualizar historico.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('registrationId', reg.id)
        .order('timestamp', { ascending: false });
      if (error) throw error;
      const emissionDate = parseBRDate(reg.issueDate);
      const synthetic: TimelineEntry[] = emissionDate
        ? [
            {
              action: normalizeRegistrationStatus(reg.status) === 'under_review' ? 'Cadastro recebido' : 'Registro inicial',
              timestamp: emissionDate.toISOString(),
              userName: 'Sistema',
              reason: `Status atual: ${getStatusLabel(reg.status)}; validade registrada ate ${reg.expiryDate}`
            }
          ]
        : [];
      const entries = [...synthetic, ...((data || []) as TimelineEntry[])].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setViewHistory({ fullName: reg.fullName, entries });
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar historico.');
    }
  };

  const handleDeleteClick = (reg: CIPFRegistration) => {
    if (!canDeleteRegistration) {
      alert('Apenas administradores podem arquivar registros.');
      return;
    }
    setRegToDelete(reg);
    setDeleteConfirmationText('');
  };

  const confirmDelete = async () => {
    if (!regToDelete) return;
    if (deleteConfirmationText.trim().toUpperCase() !== regToDelete.fullName.trim().toUpperCase()) return;
    try {
      await writeAudit('Registro Arquivado', regToDelete.id, `Arquivamento seguro de ${regToDelete.fullName}`);
      await Promise.all([
        supabase.from('registrations').update({ status: 'cancelled' }).eq('id', regToDelete.id),
        supabase.from('public_validations').update({ status: 'cancelled' }).eq('id', regToDelete.id),
        supabase.from('registration_index').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('cpf', toDigits(regToDelete.cpf))
      ]);
      setRegToDelete(null);
      setDeleteConfirmationText('');
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao arquivar registro.');
    }
  };

  const handleExportCsv = async () => {
    if (!canExportDashboard) {
      alert('Apenas administradores podem exportar relatorios.');
      return;
    }
    const rows = filteredRegistrations.map(normalizeForExport);
    const headers = Object.keys(rows[0] || normalizeForExport({
      id: '',
      fullName: '',
      cpf: '',
      birthDate: '',
      photoUrl: '',
      issueDate: '',
      expiryDate: '',
      status: 'under_review'
    } as CIPFRegistration));
    const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => `"${String((r as any)[h] ?? '')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_filtrado_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await writeAudit('Exportacao CSV Dashboard');
  };

  const handleExportExcelCompatibleCsv = async () => {
    if (!canExportDashboard) {
      alert('Apenas administradores podem exportar relatorios.');
      return;
    }
    await handleExportCsv();
    await writeAudit('Exportacao CSV Compativel Excel');
  };

  const handleExportPdf = async () => {
    if (!canExportDashboard) {
      alert('Apenas administradores podem exportar relatorios.');
      return;
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const now = new Date();
    doc.setFontSize(14);
    doc.text('Relatorio Dashboard CIPF - Prefeitura de Ipero', 10, 12);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now.toLocaleString('pt-BR')}`, 10, 18);
    const statusFilterLabel = statusFilter === 'all' ? 'Todos' : getStatusLabel(statusFilter);
    doc.text(`Filtros: CID=${cidFilter} | Bairro=${bairroFilter} | Status=${statusFilterLabel} | Vencimento=${expiryFilter}`, 10, 24);
    doc.text(`Total=${stats.total} | Analise=${stats.underReview} | Aprovadas=${stats.approved} | Emitidas=${stats.issued}`, 10, 30);
    let y = 38;
    doc.setFontSize(9);
    doc.text('Nome', 10, y);
    doc.text('CPF', 90, y);
    doc.text('CID', 125, y);
    doc.text('Bairro', 145, y);
    doc.text('Status', 182, y);
    y += 4;
    filteredRegistrations.slice(0, 25).forEach((reg) => {
      if (y > 280) return;
      doc.text(reg.fullName.slice(0, 42), 10, y);
      doc.text(maskCpf(reg.cpf), 90, y);
      doc.text((reg.cid || '-').slice(0, 8), 125, y);
      doc.text((reg.bairro || '-').slice(0, 18), 145, y);
      doc.text(getStatusLabel(reg.status), 182, y);
      y += 5;
    });
    doc.save(`dashboard_relatorio_${now.toISOString().slice(0, 10)}.pdf`);
    await writeAudit('Exportacao PDF Dashboard');
  };

  const handleClearDatabase = async () => {
    if (!canClearDatabase) {
      alert('Apenas administradores podem limpar o banco de dados.');
      return;
    }
    if (clearDbConfirmation !== 'EXCLUIR TUDO') return;
    try {
      setIsClearingDb(true);
      await useAppStore.getState().clearDatabase();
      setShowClearDbModal(false);
      setClearDbConfirmation('');
      alert('Banco de dados limpo com sucesso.');
      await writeAudit('Limpeza Completa Banco');
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Erro ao limpar banco de dados.');
    } finally {
      setIsClearingDb(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCidFilter('all');
    setBairroFilter('all');
    setStatusFilter('all');
    setExpiryFilter('all');
    setReviewFilter('all');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="institutional-hero overflow-hidden rounded-[1.5rem] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#dce9f5]">
              <FileBadge2 className="h-4 w-4 text-[#f2c94c]" />
              Painel executivo da Secretaria
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Gestao de Carteiras CIPF</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#dce9f5]">
              Acompanhamento institucional de emissoes, vencimentos, bairros atendidos e acoes administrativas.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
            <p className="font-black uppercase tracking-wide">Prefeitura Municipal de Ipero</p>
            <p className="text-xs text-[#dce9f5]">Secretaria Municipal de Saude</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h3 className="text-lg font-black text-[#17324d]">Acoes e filtros</h3>
          <p className="mt-1 text-sm text-[#617184]">Use os botoes abaixo para atualizar, exportar ou auditar os dados filtrados.</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
          {canClearDatabase && (
            <Button
              variant="outline"
              onClick={() => setShowClearDbModal(true)}
              className="h-12 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Limpar Banco
            </Button>
          )}
          {canExportDashboard && (
            <>
              <Button variant="outline" onClick={handleExportCsv} className="h-12">
                <FileDown className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" onClick={handleExportExcelCompatibleCsv} className="h-12">
                <FileDown className="w-4 h-4 mr-2" /> CSV p/ Excel
              </Button>
              <Button variant="outline" onClick={handleExportPdf} className="h-12">
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </>
          )}
          <Button variant="outline" onClick={loadData} disabled={isLoading} className="h-12">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          Falha ao carregar dashboard: {loadError}
        </div>
      )}

      <div className="institutional-panel rounded-[1.25rem] p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868B]" />
            <Input
              placeholder="Nome, CPF, Cartao SUS, CID ou bairro..."
              className="h-12 pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={cidFilter}
            onChange={(e) => setCidFilter(e.target.value)}
            className="h-12 rounded-xl border border-[#d9e1ea] bg-white px-3"
          >
            {cidOptions.map((cid) => (
              <option key={cid} value={cid}>
                {cid === 'all' ? 'CID: Todos' : `CID: ${cid}`}
              </option>
            ))}
          </select>
          <select
            value={bairroFilter}
            onChange={(e) => setBairroFilter(e.target.value)}
            className="h-12 rounded-xl border border-[#d9e1ea] bg-white px-3"
          >
            {bairroOptions.map((bairro) => (
              <option key={bairro} value={bairro}>
                {bairro === 'all' ? 'Bairro: Todos' : bairro}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-12 rounded-xl border border-[#d9e1ea] bg-white px-3"
          >
            <option value="all">Status: Todos</option>
            {WORKFLOW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as typeof expiryFilter)}
            className="h-12 rounded-xl border border-[#d9e1ea] bg-white px-3"
          >
            <option value="all">Validade: Todas</option>
            <option value="expiring30">Vencendo em 30 dias</option>
          </select>
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as ReviewFilter)}
            className="h-12 rounded-xl border border-[#d9e1ea] bg-white px-3"
          >
            <option value="all">Revisao: normal</option>
            <option value="document_issues">Pendencias documentais</option>
            <option value="archived">Arquivados</option>
          </select>
          <Button type="button" variant="outline" onClick={clearFilters} className="h-12">
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="institutional-panel rounded-[1rem] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#617184]">{card.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-[#17324d]">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="institutional-panel rounded-[1rem] p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-[#617184]">Emissoes por Bairro</h3>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {Object.entries(bairroStats)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([bairro, count]) => (
                <div key={bairro} className="flex justify-between text-sm">
                  <span className="truncate pr-3">{bairro}</span>
                  <span className="rounded bg-[#eaf4ee] px-2 font-bold text-[#166534]">{count}</span>
                </div>
              ))}
            {Object.keys(bairroStats).length === 0 && <p className="text-sm text-gray-400">Sem dados</p>}
          </div>
        </div>
        <div className="institutional-panel rounded-[1rem] p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-[#617184]">Faixa Etaria</h3>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {Object.entries(ageStats)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([group, count]) => (
                <div key={group} className="flex justify-between text-sm">
                  <span>{group} anos</span>
                  <span className="rounded bg-[#eaf3fb] px-2 font-bold text-[#155c9c]">{count}</span>
                </div>
              ))}
            {Object.keys(ageStats).length === 0 && <p className="text-sm text-gray-400">Sem dados</p>}
          </div>
        </div>
      </div>

      <div className="institutional-panel overflow-hidden rounded-[1.25rem]">
        <div className="flex items-center justify-between gap-3 border-b border-[#e3e9ef] bg-[#f8fafc] p-4 text-sm text-[#617184]">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#155c9c]" /> Registros filtrados
          </div>
          <span className="status-chip rounded-full px-3 py-1">{filteredRegistrations.length} registros</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
            <p className="text-[#86868B]">Carregando registros...</p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center text-[#86868B]">Nenhum registro encontrado para os filtros aplicados.</div>
        ) : (
          <>
            <div className="md:hidden p-3 space-y-3">
              {filteredRegistrations.map((reg) => (
                <div key={reg.id} className={`rounded-2xl border border-[#d9e1ea] bg-[#fbfdff] p-3 ${getExpiryHighlight(reg)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{reg.fullName}</p>
                      <p className="text-xs text-[#86868B]">{maskCpf(reg.cpf)}</p>
                      <p className="text-xs text-[#86868B]">CID: {reg.cid || '-'}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-xs font-bold uppercase ${getStatusBadgeClass(reg.status)}`}>{getStatusLabel(reg.status)}</span>
                  </div>
                  <div className="text-xs text-[#86868B] mt-2">Bairro: {reg.bairro || '-'} | Validade: {reg.expiryDate}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canPrintCarteirinha && isPrintableStatus(reg.status) && (
                      <Button variant="ghost" size="icon" onClick={() => handlePreviewCarteirinha(reg)} title="Carteirinha">
                        <FileBadge2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDetailReg(reg)} title="Ver detalhes">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canEditRegistration && (
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(reg)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {canViewDocuments && (
                      <Button variant="ghost" size="icon" onClick={() => handleViewMedicalDoc(reg)} title="Laudo">
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    {canViewHistory && (
                      <Button variant="ghost" size="icon" onClick={() => handleViewHistory(reg)} title="Historico">
                        <CalendarClock className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteRegistration && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(reg)} title="Arquivar">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase text-[#617184]">
                  <tr>
                    <th className="px-4 py-3 text-left">Titular</th>
                    <th className="px-4 py-3 text-left">CPF</th>
                    <th className="px-4 py-3 text-left">CID</th>
                    <th className="px-4 py-3 text-left">Bairro</th>
                    <th className="px-4 py-3 text-left">Validade</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className={`hover:bg-[#f8fafc] ${getExpiryHighlight(reg)}`}>
                      <td className="px-4 py-3 font-medium">{reg.fullName}</td>
                      <td className="px-4 py-3 text-[#86868B]">{maskCpf(reg.cpf)}</td>
                      <td className="px-4 py-3">{reg.cid || '-'}</td>
                      <td className="px-4 py-3">{reg.bairro || '-'}</td>
                      <td className="px-4 py-3">{reg.expiryDate}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-bold uppercase ${getStatusBadgeClass(reg.status)}`}>{getStatusLabel(reg.status)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canPrintCarteirinha && isPrintableStatus(reg.status) && (
                            <Button variant="ghost" size="icon" onClick={() => handlePreviewCarteirinha(reg)} title="Carteirinha">
                              <FileBadge2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDetailReg(reg)} title="Ver detalhes">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEditRegistration && (
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(reg)} title="Editar cadastro">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canViewDocuments && (
                            <Button variant="ghost" size="icon" onClick={() => handleViewMedicalDoc(reg)} title="Laudo">
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          {canViewHistory && (
                            <Button variant="ghost" size="icon" onClick={() => handleViewHistory(reg)} title="Historico">
                              <ShieldAlert className="w-4 h-4" />
                            </Button>
                          )}
                          {canDeleteRegistration && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(reg)} title="Arquivar">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {detailReg && (
        <ModalShell
          open={Boolean(detailReg)}
          onClose={() => setDetailReg(null)}
          title="Ficha do Cadastro"
          description={detailReg.fullName}
          size="lg"
        >
            <div className="space-y-5">
              <div className={`rounded-2xl border p-4 ${getExpiryHighlight(detailReg) || 'border-[#e3e9ef] bg-[#f8fafc]'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#617184]">Status atual</p>
                    <p className="mt-1 text-lg font-black text-[#17324d]">{getStatusLabel(detailReg.status)}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${getStatusBadgeClass(detailReg.status)}`}>
                    Validade: {detailReg.expiryDate}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-[#d9e1ea] bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-black text-[#17324d]">Fluxo operacional</p>
                  <p className="mt-1 text-sm text-[#617184]">
                    Aprovacao, emissao, renovacao e cancelamento ficam registrados na auditoria.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canApproveRegistration && canApproveStatus(detailReg.status) && (
                    <Button type="button" onClick={() => handleApproveRegistration(detailReg)} className="h-10 bg-blue-600 text-white hover:bg-blue-700">
                      Aprovar cadastro
                    </Button>
                  )}
                  {canIssueRegistration && canPrintCarteirinha && canIssueStatus(detailReg.status) && (
                    <Button type="button" onClick={() => handleIssueAndPrint(detailReg)} className="h-10 bg-green-700 text-white hover:bg-green-800">
                      Emitir / imprimir
                    </Button>
                  )}
                  {canRenewRegistration && canRenewStatus(detailReg.status) && (
                    <Button type="button" variant="outline" onClick={() => handleRenewRegistration(detailReg)} className="h-10">
                      Renovar
                    </Button>
                  )}
                  {canReissueRegistration && canReissueStatus(detailReg.status) && (
                    <Button type="button" variant="outline" onClick={() => handleReissueRegistration(detailReg)} className="h-10">
                      Registrar 2 via
                    </Button>
                  )}
                  {canCancelRegistration && canCancelStatus(detailReg.status) && (
                    <Button type="button" variant="outline" onClick={() => handleCancelRegistration(detailReg)} className="h-10 border-red-200 text-red-700 hover:bg-red-50">
                      Cancelar
                    </Button>
                  )}
                  {!(canApproveRegistration && canApproveStatus(detailReg.status)) &&
                    !(canIssueRegistration && canPrintCarteirinha && canIssueStatus(detailReg.status)) &&
                    !(canRenewRegistration && canRenewStatus(detailReg.status)) &&
                    !(canReissueRegistration && canReissueStatus(detailReg.status)) &&
                    !(canCancelRegistration && canCancelStatus(detailReg.status)) && (
                      <p className="text-sm text-[#617184]">Nenhuma acao operacional disponivel para este status.</p>
                    )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['CPF', maskCpf(detailReg.cpf)],
                  ['Cartao SUS', detailReg.cns ? formatCNS(detailReg.cns) : 'Nao informado'],
                  ['Nascimento', detailReg.birthDate],
                  ['Telefone', detailReg.phone || '-'],
                  ['Endereco', [detailReg.logradouro, detailReg.bairro, detailReg.cidade, detailReg.estado].filter(Boolean).join(', ') || '-'],
                  ['CID', detailReg.cid || '-'],
                  ['CRM', detailReg.crm || '-'],
                  ['Responsavel legal', detailReg.legalGuardian || 'Nao informado'],
                  ['Emissao', detailReg.issueDate],
                  ['Assinatura visual', detailReg.visualSignature || '-']
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-[#617184]">{label}</p>
                    <p className="mt-1 break-words font-semibold text-[#17324d]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-[#d9e1ea] bg-white p-4">
                <p className="text-sm font-black text-[#17324d]">Auditoria visual</p>
                <p className="mt-1 text-sm text-[#617184]">
                  Use o historico para ver emissao inicial, edicoes, visualizacao de laudos, exclusoes e o responsavel por cada acao.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const reg = detailReg;
                    setDetailReg(null);
                    void handleViewHistory(reg);
                  }}
                  className="mt-3 h-10"
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Abrir historico
                </Button>
              </div>
            </div>
        </ModalShell>
      )}

      {viewHistory && (
        <ModalShell
          open={Boolean(viewHistory)}
          onClose={() => setViewHistory(null)}
          title="Linha do Tempo"
          description={viewHistory.fullName}
          size="lg"
        >
              {viewHistory.entries.length === 0 ? (
                <p className="text-sm text-[#86868B] text-center py-8">Sem eventos registrados.</p>
              ) : (
                <div className="space-y-3">
                  {viewHistory.entries.map((entry, idx) => (
                    <div key={`${entry.timestamp}-${idx}`} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-sm">{entry.action}</p>
                        <span className="text-xs text-[#86868B]">{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-[#86868B] mt-1">Responsavel: {entry.userName || 'Sistema'}</p>
                      {entry.reason && <p className="text-xs text-[#86868B] mt-1">{entry.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
        </ModalShell>
      )}

      {editReg && editForm && (
        <ModalShell
          open={Boolean(editReg && editForm)}
          onClose={() => {
            setEditReg(null);
            setEditForm(null);
          }}
          title="Editar Cadastro"
          description={`CPF ${maskCpf(editReg.cpf)} mantido bloqueado para preservar a unicidade do registro.`}
          size="xl"
          closeDisabled={isSavingEdit}
          footer={
            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditReg(null);
                  setEditForm(null);
                }}
                disabled={isSavingEdit}
              >
                Cancelar
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Alteracoes
              </Button>
            </div>
          }
        >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Nome completo</span>
                  <Input
                    value={editForm.fullName}
                    onChange={(e) => updateEditField('fullName', e.target.value)}
                    className="h-11 uppercase"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Status</span>
                  <select
                    value={editForm.status}
                    onChange={(e) => updateEditField('status', e.target.value as EditRegistrationForm['status'])}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 bg-white"
                  >
                    {WORKFLOW_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Telefone</span>
                  <Input value={editForm.phone} onChange={(e) => updateEditField('phone', e.target.value)} className="h-11" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Cartao SUS</span>
                  <Input
                    value={editForm.cns}
                    onChange={(e) => updateEditField('cns', formatCNS(e.target.value))}
                    placeholder="000 0000 0000 0000"
                    maxLength={18}
                    className="h-11"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Nascimento</span>
                  <Input value={editForm.birthDate} onChange={(e) => updateEditField('birthDate', e.target.value)} className="h-11" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Responsavel legal</span>
                  <Input
                    value={editForm.legalGuardian}
                    onChange={(e) => updateEditField('legalGuardian', e.target.value)}
                    className="h-11 uppercase"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <label className="space-y-1 md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">CEP</span>
                  <Input value={editForm.cep} onChange={(e) => updateEditField('cep', e.target.value)} className="h-11" />
                </label>
                <label className="space-y-1 md:col-span-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Logradouro</span>
                  <Input
                    value={editForm.logradouro}
                    onChange={(e) => updateEditField('logradouro', e.target.value)}
                    className="h-11 uppercase"
                  />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Bairro</span>
                  <Input value={editForm.bairro} onChange={(e) => updateEditField('bairro', e.target.value)} className="h-11 uppercase" />
                </label>
                <label className="space-y-1 md:col-span-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Cidade</span>
                  <Input value={editForm.cidade} onChange={(e) => updateEditField('cidade', e.target.value)} className="h-11 uppercase" />
                </label>
                <label className="space-y-1 md:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">UF</span>
                  <Input
                    value={editForm.estado}
                    onChange={(e) => updateEditField('estado', e.target.value)}
                    maxLength={2}
                    className="h-11 uppercase"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">CID</span>
                  <Input value={editForm.cid} onChange={(e) => updateEditField('cid', e.target.value)} className="h-11 uppercase" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">CRM</span>
                  <Input value={editForm.crm} onChange={(e) => updateEditField('crm', e.target.value)} className="h-11 uppercase" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Data laudo</span>
                  <Input
                    value={editForm.medicalReportDate}
                    onChange={(e) => updateEditField('medicalReportDate', e.target.value)}
                    className="h-11"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Data comprovante</span>
                  <Input
                    value={editForm.proofOfResidenceDate}
                    onChange={(e) => updateEditField('proofOfResidenceDate', e.target.value)}
                    className="h-11"
                  />
                </label>
                <label className="space-y-1 md:col-span-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Justificativa CID</span>
                  <Input
                    value={editForm.justificativaCid}
                    onChange={(e) => updateEditField('justificativaCid', e.target.value)}
                    className="h-11"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Emissao</span>
                  <Input value={editForm.issueDate} onChange={(e) => updateEditField('issueDate', e.target.value)} className="h-11" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#86868B]">Validade</span>
                  <Input value={editForm.expiryDate} onChange={(e) => updateEditField('expiryDate', e.target.value)} className="h-11" />
                </label>
              </div>
            </div>
        </ModalShell>
      )}

      {regToDelete && (
        <ModalShell
          open={Boolean(regToDelete)}
          onClose={() => setRegToDelete(null)}
          title="Arquivar cadastro"
          description={`Para arquivar ${regToDelete.fullName}, digite o nome completo abaixo. O registro ficara oculto da lista normal, mas permanecera recuperavel e auditavel.`}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRegToDelete(null)}>Cancelar</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>Arquivar</Button>
            </div>
          }
        >
          <Input value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} placeholder={regToDelete.fullName} className="h-12" />
        </ModalShell>
      )}

      {showClearDbModal && (
        <ModalShell
          open={showClearDbModal}
          onClose={() => setShowClearDbModal(false)}
          title="Limpar Banco"
          description="Esta acao e irreversivel. Digite EXCLUIR TUDO para confirmar."
          size="md"
          closeDisabled={isClearingDb}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowClearDbModal(false)} disabled={isClearingDb}>Cancelar</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleClearDatabase}
                disabled={clearDbConfirmation !== 'EXCLUIR TUDO' || isClearingDb}
              >
                {isClearingDb ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
              </Button>
            </div>
          }
        >
          <Input value={clearDbConfirmation} onChange={(e) => setClearDbConfirmation(e.target.value)} placeholder="EXCLUIR TUDO" className="h-12 text-center font-semibold" />
        </ModalShell>
      )}

      {previewReg && (
        <ModalShell
          open={Boolean(previewReg)}
          onClose={() => setPreviewReg(null)}
          title="Pre-visualizacao da Carteirinha"
          size="xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreviewReg(null)}>Fechar</Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => handleIssueAndPrint(previewReg)}
              >
                Emitir / ir para Impressao
              </Button>
            </div>
          }
        >
            <div className="flex min-h-[460px] justify-center overflow-x-auto rounded-xl bg-gray-50/50 px-3 py-8 sm:px-6">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center justify-center text-[#86868B]">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                  <p>Carregando foto e dados...</p>
                </div>
              ) : (
                <div className="scale-[0.85] sm:scale-100 origin-top">
                  <CarteirinhaPreview registration={previewReg} photoDataUri={previewPhotoUri} />
                </div>
              )}
            </div>
        </ModalShell>
      )}
    </div>
  );
}
