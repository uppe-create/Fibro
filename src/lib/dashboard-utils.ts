import { getAgeBucket, getAgeFromBRDate, isExpiringInDays, parseBRDate } from '@/lib/date';
import { formatCNS, formatPhone } from '@/lib/utils';
import {
  getStatusLabel,
  normalizeRegistrationStatus,
  statusMatchesFilter,
  type RegistrationStatus
} from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';

export type StatusFilter = 'all' | RegistrationStatus;
export type ReviewFilter = 'all' | 'document_issues' | 'archived';
export type WhatsAppTemplate = 'approved' | 'pickup' | 'pending' | 'renewal';
export type IssueTargetSection = 'contact' | 'documents' | 'medical' | 'address' | 'personal';

export type EditRegistrationForm = {
  fullName: string;
  cns: string;
  phone: string;
  birthDate: string;
  legalGuardian: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cid: string;
  justificativaCid: string;
  crm: string;
  proofOfResidenceDate: string;
  medicalReportDate: string;
  issueDate: string;
  expiryDate: string;
  status: CIPFRegistration['status'];
};

export function toDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskCpf(cpf: string): string {
  const digits = toDigits(cpf);
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**');
}

export function normalizeForExport(reg: CIPFRegistration) {
  return {
    nome: reg.fullName,
    cpf: toDigits(reg.cpf),
    cartao_sus: toDigits(reg.cns || ''),
    status: getStatusLabel(reg.status),
    cid: reg.cid || '',
    bairro: reg.bairro || '',
    cidade: reg.cidade || '',
    validade: reg.expiryDate,
    emissao: reg.issueDate,
    paciente_avisado_em: reg.patient_notified_at ? new Date(reg.patient_notified_at).toLocaleString('pt-BR') : '',
    retirada_confirmada_em: reg.picked_up_at ? new Date(reg.picked_up_at).toLocaleString('pt-BR') : '',
    proxima_acao: getNextOperationalAction(reg)
  };
}

export function normalizeUpper(value: string): string {
  return value.toUpperCase().replace(/\s+/g, ' ').trim();
}

export function getExpiryHighlight(reg: CIPFRegistration) {
  const normalizedStatus = normalizeRegistrationStatus(reg.status);
  if (normalizedStatus === 'cancelled') return 'border-l-4 border-l-zinc-400 bg-zinc-50/60';
  const expiry = parseBRDate(reg.expiryDate);
  if (!expiry) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0 || normalizedStatus === 'expired') return 'border-l-4 border-l-red-500 bg-red-50/40';
  if (diffDays <= 30 && normalizedStatus === 'issued') return 'border-l-4 border-l-amber-400 bg-amber-50/40';
  return '';
}

export function daysSinceBRDate(value?: string): number | null {
  const date = parseBRDate(value || '');
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

export function getDocumentIssues(reg: CIPFRegistration): string[] {
  const issues: string[] = [];
  if (!reg.documentFileId && !reg.documentUrl) issues.push('Documento oficial ausente');
  if (!reg.proofOfResidenceFileId && !reg.proofOfResidenceUrl) issues.push('Comprovante ausente');
  if (!reg.medicalReportFileId && !reg.medicalReportUrl) issues.push('Laudo médico ausente');
  if (!reg.photoFileId && !reg.photoUrl) issues.push('Foto ausente');

  const proofDays = daysSinceBRDate(reg.proofOfResidenceDate);
  if (proofDays !== null && proofDays > 90) issues.push('Comprovante com mais de 90 dias');

  const reportDays = daysSinceBRDate(reg.medicalReportDate);
  if (reportDays !== null && reportDays > 183) issues.push('Laudo com mais de 6 meses');

  return issues;
}

export function getIssueTargetSection(issue: string): IssueTargetSection {
  const lower = issue.toLowerCase();
  if (lower.includes('telefone')) return 'contact';
  if (lower.includes('laudo') || lower.includes('crm') || lower.includes('cid')) return 'medical';
  if (lower.includes('comprovante') || lower.includes('resid')) return 'address';
  if (lower.includes('documento') || lower.includes('foto')) return 'documents';
  return 'personal';
}

export function isReadyToPrint(reg: CIPFRegistration): boolean {
  return normalizeRegistrationStatus(reg.status) === 'approved' && getDocumentIssues(reg).length === 0;
}

export function isAwaitingPatientNotice(reg: CIPFRegistration): boolean {
  return normalizeRegistrationStatus(reg.status) === 'approved' && !reg.patient_notified_at;
}

export function isAwaitingPickup(reg: CIPFRegistration): boolean {
  return normalizeRegistrationStatus(reg.status) === 'issued' && !reg.picked_up_at;
}

export function getChecklistItems(reg: Partial<CIPFRegistration>) {
  return [
    { label: 'CPF', ok: toDigits(reg.cpf || '').length === 11 },
    { label: 'Cartão SUS', ok: !reg.cns || toDigits(reg.cns).length === 15 },
    { label: 'Telefone', ok: toDigits(reg.phone || '').length >= 10 },
    { label: 'Foto', ok: Boolean(reg.photoFileId || reg.photoUrl) },
    { label: 'Documento', ok: Boolean(reg.documentFileId || reg.documentUrl) },
    { label: 'Comprovante', ok: Boolean(reg.proofOfResidenceFileId || reg.proofOfResidenceUrl) },
    { label: 'Laudo', ok: Boolean(reg.medicalReportFileId || reg.medicalReportUrl) },
    { label: 'CID', ok: Boolean(reg.cid) },
    { label: 'CRM', ok: Boolean(reg.crm) }
  ];
}

export function getNextOperationalAction(reg: CIPFRegistration): string {
  const status = normalizeRegistrationStatus(reg.status);
  const issues = getDocumentIssues(reg);
  if (status === 'under_review') return issues.length ? 'Revisar documentos antes de aprovar' : 'Conferir e aprovar cadastro';
  if (status === 'approved' && !reg.patient_notified_at) return 'Avisar paciente sobre aprovação';
  if (isReadyToPrint(reg)) return 'Aguardando emissão pelo administrador';
  if (status === 'issued' && !reg.picked_up_at) return 'Aguardando retirada presencial';
  if (status === 'expired') return 'Orientar renovação';
  if (status === 'cancelled') return 'Registro arquivado';
  return 'Sem ação pendente';
}

export function buildSafeRegistrationSummary(reg: CIPFRegistration): string {
  const issues = getDocumentIssues(reg);
  return [
    `Titular: ${reg.fullName}`,
    `CPF: ${maskCpf(reg.cpf)}`,
    `Status: ${getStatusLabel(reg.status)}`,
    `Validade: ${reg.expiryDate || '-'}`,
    `Telefone: ${formatPhone(reg.phone || '') || '-'}`,
    `Pendências: ${issues.length ? issues.join('; ') : 'sem pendências documentais'}`,
    `Próxima ação: ${getNextOperationalAction(reg)}`
  ].join('\n');
}

export function buildWhatsAppMessage(reg: CIPFRegistration, template: WhatsAppTemplate): string {
  const firstName = reg.fullName.trim().split(/\s+/)[0] || 'paciente';
  const messages: Record<WhatsAppTemplate, string> = {
    approved: `Olá, ${firstName}. Sua Carteirinha de Fibromialgia foi aprovada. A Secretaria de Saúde orientará a retirada presencial.`,
    pickup: `Olá, ${firstName}. Sua Carteirinha de Fibromialgia está pronta para retirada na Secretaria de Saúde.`,
    pending: `Olá, ${firstName}. A Secretaria de Saúde precisa conferir pendências do seu cadastro da Carteirinha de Fibromialgia. Por favor, compareça ao atendimento presencial.`,
    renewal: `Olá, ${firstName}. Sua Carteirinha de Fibromialgia está próxima do vencimento. Procure a Secretaria de Saúde para orientações de renovação.`
  };
  return messages[template];
}

export function buildWhatsAppUrl(phone = '', message = ''): string {
  const digits = toDigits(phone);
  if (!digits) return '';
  const phoneWithCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}

export function getDaysSinceIso(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

export function getStaleAlerts(reg: CIPFRegistration): string[] {
  const alerts: string[] = [];
  const status = normalizeRegistrationStatus(reg.status);
  const createdDays = getDaysSinceIso((reg as any).created_at);
  const notifiedDays = getDaysSinceIso(reg.patient_notified_at);
  const issuedDays = daysSinceBRDate(reg.issueDate);
  if (status === 'under_review' && createdDays !== null && createdDays > 7) alerts.push(`Em análise há ${createdDays} dias`);
  if (status === 'approved' && !reg.patient_notified_at && createdDays !== null && createdDays > 3) alerts.push(`Aprovada sem aviso há ${createdDays} dias`);
  if (status === 'approved' && notifiedDays !== null && notifiedDays > 3) alerts.push(`Avisada há ${notifiedDays} dias, aguardando emissão`);
  if (status === 'issued' && !reg.picked_up_at && issuedDays !== null && issuedDays > 7) alerts.push(`Emitida sem retirada há ${issuedDays} dias`);
  return alerts;
}

export function buildMonthlyReport(registrations: CIPFRegistration[], date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  const inCurrentMonth = (value?: string | null) => {
    if (!value) return false;
    const parsed = value.includes('/') ? parseBRDate(value) : new Date(value);
    return Boolean(parsed && parsed.getMonth() === month && parsed.getFullYear() === year);
  };
  const issued = registrations.filter((reg) => inCurrentMonth(reg.issueDate));
  const approved = registrations.filter((reg) => normalizeRegistrationStatus(reg.status) === 'approved');
  const pickedUp = registrations.filter((reg) => inCurrentMonth(reg.picked_up_at));
  const expired = registrations.filter((reg) => normalizeRegistrationStatus(reg.status) === 'expired');
  return {
    monthLabel: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    issued: issued.length,
    approved: approved.length,
    pickedUp: pickedUp.length,
    expired: expired.length,
    documentIssues: registrations.filter((reg) => getDocumentIssues(reg).length > 0).length,
    bairroStats: buildBairroStats(issued.length ? issued : registrations)
  };
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[a.length][b.length];
}

export function findLikelyRegistrations(registrations: CIPFRegistration[], rawTerm: string, limit = 5): CIPFRegistration[] {
  const term = rawTerm.trim().toLowerCase();
  const digits = toDigits(rawTerm);
  if (!term && !digits) return [];

  return registrations
    .map((reg) => {
      const name = reg.fullName.toLowerCase();
      const cpf = toDigits(reg.cpf);
      const cns = toDigits(reg.cns || '');
      let score = 0;
      if (digits && (cpf.includes(digits) || cns.includes(digits))) score += 80;
      if (name.includes(term)) score += 70;
      if (term.length >= 4) {
        const firstName = name.split(/\s+/)[0] || '';
        const termFirst = term.split(/\s+/)[0] || '';
        if (firstName === termFirst) score += 35;
        if (levenshtein(firstName, termFirst) <= 2) score += 25;
      }
      return { reg, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.reg);
}

export function todayBR() {
  return new Date().toLocaleDateString('pt-BR');
}

export function datePlusYearsBR(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toLocaleDateString('pt-BR');
}

export function buildEditForm(reg: CIPFRegistration): EditRegistrationForm {
  return {
    fullName: reg.fullName || '',
    cns: formatCNS(reg.cns || ''),
    phone: formatPhone(reg.phone || ''),
    birthDate: reg.birthDate || '',
    legalGuardian: reg.legalGuardian || '',
    cep: reg.cep || '',
    logradouro: reg.logradouro || '',
    bairro: reg.bairro || '',
    cidade: reg.cidade || '',
    estado: reg.estado || '',
    cid: reg.cid || '',
    justificativaCid: reg.justificativaCid || '',
    crm: reg.crm || '',
    proofOfResidenceDate: reg.proofOfResidenceDate || '',
    medicalReportDate: reg.medicalReportDate || '',
    issueDate: reg.issueDate || '',
    expiryDate: reg.expiryDate || '',
    status: normalizeRegistrationStatus(reg.status)
  };
}

export function filterDashboardRegistrations(
  registrations: CIPFRegistration[],
  filters: {
    searchTerm: string;
    cidFilter: string;
    bairroFilter: string;
    statusFilter: StatusFilter;
    expiryFilter: 'all' | 'expiring30';
    reviewFilter: ReviewFilter;
  }
) {
  const term = filters.searchTerm.trim().toLowerCase();
  return registrations.filter((reg) => {
    const normalizedStatus = normalizeRegistrationStatus(reg.status);
    const nameMatch = reg.fullName.toLowerCase().includes(term);
    const cpfMatch = toDigits(reg.cpf).includes(toDigits(term));
    const cnsMatch = toDigits(reg.cns || '').includes(toDigits(term));
    const cidMatch = (reg.cid || '').toLowerCase().includes(term);
    const bairroMatch = (reg.bairro || '').toLowerCase().includes(term);
    const matchesSearch = !term || nameMatch || cpfMatch || cnsMatch || cidMatch || bairroMatch;
    const matchesCid = filters.cidFilter === 'all' || (reg.cid || '') === filters.cidFilter;
    const matchesBairro = filters.bairroFilter === 'all' || (reg.bairro || '') === filters.bairroFilter;
    const matchesStatus =
      filters.statusFilter === 'all'
        ? normalizedStatus !== 'cancelled' || filters.reviewFilter === 'archived'
        : statusMatchesFilter(reg.status, filters.statusFilter);
    const matchesExpiry =
      filters.expiryFilter === 'all' || (normalizedStatus === 'issued' && isExpiringInDays(reg.expiryDate, 30));
    const matchesReview =
      filters.reviewFilter === 'all' ||
      (filters.reviewFilter === 'document_issues' && getDocumentIssues(reg).length > 0) ||
      (filters.reviewFilter === 'archived' && normalizedStatus === 'cancelled');
    return matchesSearch && matchesCid && matchesBairro && matchesStatus && matchesExpiry && matchesReview;
  });
}

export function buildStats(registrations: CIPFRegistration[], filteredRegistrations: CIPFRegistration[]) {
  const byStatus = (status: RegistrationStatus) =>
    registrations.filter((registration) => normalizeRegistrationStatus(registration.status) === status).length;
  return {
    total: registrations.length,
    underReview: byStatus('under_review'),
    approved: byStatus('approved'),
    issued: byStatus('issued'),
    expired: byStatus('expired'),
    cancelled: byStatus('cancelled'),
    documentIssues: registrations.filter((registration) => getDocumentIssues(registration).length > 0).length,
    expiring30: registrations.filter(
      (registration) => normalizeRegistrationStatus(registration.status) === 'issued' && isExpiringInDays(registration.expiryDate, 30)
    ).length,
    filtered: filteredRegistrations.length
  };
}

export function buildBairroStats(registrations: CIPFRegistration[]) {
  return registrations.reduce((acc, reg) => {
    const bairro = reg.bairro || 'Não informado';
    acc[bairro] = (acc[bairro] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export function buildAgeStats(registrations: CIPFRegistration[]) {
  return registrations.reduce((acc, reg) => {
    const age = getAgeFromBRDate(reg.birthDate);
    if (age === null) return acc;
    const bucket = getAgeBucket(age);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
