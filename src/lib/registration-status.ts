export type LegacyRegistrationStatus = 'active' | 'pending';

export type RegistrationStatus =
  | 'under_review'
  | 'approved'
  | 'issued'
  | 'expired'
  | 'cancelled'
  | LegacyRegistrationStatus;

export const WORKFLOW_STATUS_OPTIONS: Array<{ value: RegistrationStatus; label: string }> = [
  { value: 'under_review', label: 'Em analise' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'issued', label: 'Emitida' },
  { value: 'expired', label: 'Vencida' },
  { value: 'cancelled', label: 'Cancelada' }
];

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  under_review: 'Em analise',
  approved: 'Aprovada',
  issued: 'Emitida',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  active: 'Emitida',
  pending: 'Em analise'
};

const STATUS_BADGES: Record<RegistrationStatus, string> = {
  under_review: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-blue-200 bg-blue-50 text-blue-700',
  issued: 'border-green-200 bg-green-50 text-green-700',
  expired: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  active: 'border-green-200 bg-green-50 text-green-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700'
};

export function normalizeRegistrationStatus(status?: string | null): RegistrationStatus {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'active') return 'issued';
  if (value === 'pending') return 'under_review';
  if (value === 'approved') return 'approved';
  if (value === 'issued') return 'issued';
  if (value === 'expired') return 'expired';
  if (value === 'cancelled') return 'cancelled';
  return 'under_review';
}

export function getStatusLabel(status?: string | null): string {
  return STATUS_LABELS[normalizeRegistrationStatus(status)];
}

export function getStatusBadgeClass(status?: string | null): string {
  return STATUS_BADGES[normalizeRegistrationStatus(status)];
}

export function statusMatchesFilter(status: string | null | undefined, filter: RegistrationStatus | 'all'): boolean {
  if (filter === 'all') return true;
  return normalizeRegistrationStatus(status) === filter;
}

export function isPubliclyValidStatus(status?: string | null): boolean {
  const normalized = normalizeRegistrationStatus(status);
  return normalized === 'issued';
}

export function isPrintableStatus(status?: string | null): boolean {
  const normalized = normalizeRegistrationStatus(status);
  return normalized === 'approved' || normalized === 'issued';
}

export function canApproveStatus(status?: string | null): boolean {
  return normalizeRegistrationStatus(status) === 'under_review';
}

export function canIssueStatus(status?: string | null): boolean {
  return isPrintableStatus(status);
}

export function canCancelStatus(status?: string | null): boolean {
  return normalizeRegistrationStatus(status) !== 'cancelled';
}

export function canRenewStatus(status?: string | null): boolean {
  const normalized = normalizeRegistrationStatus(status);
  return normalized === 'issued' || normalized === 'expired';
}

export function canReissueStatus(status?: string | null): boolean {
  return normalizeRegistrationStatus(status) === 'issued';
}

export function isCpfBlockedByStatus(status?: string | null): boolean {
  return normalizeRegistrationStatus(status) !== 'cancelled';
}
