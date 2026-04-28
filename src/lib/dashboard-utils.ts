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
    emissao: reg.issueDate
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
  if (!reg.medicalReportFileId && !reg.medicalReportUrl) issues.push('Laudo medico ausente');
  if (!reg.photoFileId && !reg.photoUrl) issues.push('Foto ausente');

  const proofDays = daysSinceBRDate(reg.proofOfResidenceDate);
  if (proofDays !== null && proofDays > 90) issues.push('Comprovante com mais de 90 dias');

  const reportDays = daysSinceBRDate(reg.medicalReportDate);
  if (reportDays !== null && reportDays > 183) issues.push('Laudo com mais de 6 meses');

  return issues;
}

export function isReadyToPrint(reg: CIPFRegistration): boolean {
  return normalizeRegistrationStatus(reg.status) === 'approved' && getDocumentIssues(reg).length === 0;
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
    const bairro = reg.bairro || 'Nao Informado';
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
