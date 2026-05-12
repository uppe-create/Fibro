import type { AuditTimelineEntry } from '@/lib/audit-events';
import type { CIPFRegistration } from '@/store/useAppStore';
import type { IssueTargetSection, ReviewFilter, StatusFilter, WhatsAppTemplate } from '@/lib/dashboard-utils';

export type DashboardFiltersState = {
  searchTerm: string;
  cidFilter: string;
  bairroFilter: string;
  statusFilter: StatusFilter;
  expiryFilter: 'all' | 'expiring30';
  reviewFilter: ReviewFilter;
  quickSearchTerm: string;
  isCompactMode: boolean;
};

export type DashboardFiltersActions = {
  setSearchTerm: (value: string) => void;
  setCidFilter: (value: string) => void;
  setBairroFilter: (value: string) => void;
  setStatusFilter: (value: StatusFilter) => void;
  setExpiryFilter: (value: 'all' | 'expiring30') => void;
  setReviewFilter: (value: ReviewFilter) => void;
  setQuickSearchTerm: (value: string) => void;
  clearFilters: () => void;
  toggleCompactMode: () => void;
};

export type DashboardModalState = {
  detailReg: CIPFRegistration | null;
  editReg: CIPFRegistration | null;
  history: { fullName: string; entries: AuditTimelineEntry[] } | null;
  previewReg: CIPFRegistration | null;
  deleteReg: CIPFRegistration | null;
  clearDatabaseOpen: boolean;
  whatsAppDraft: { reg: CIPFRegistration; template: WhatsAppTemplate; message: string } | null;
  pickupDraft: { reg: CIPFRegistration; pickedBy: string; documentChecked: boolean; note: string } | null;
  confirmAction: ConfirmActionConfig | null;
  editFocusSection: IssueTargetSection | null;
};

export type ConfirmActionConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger' | 'success';
  requiresReason?: boolean;
  reasonLabel?: string;
  requiredText?: string;
  onConfirm: (reasonOrText: string) => Promise<void> | void;
};

export type RegistrationAction =
  | 'details'
  | 'edit'
  | 'history'
  | 'preview'
  | 'approve'
  | 'issue'
  | 'cancel'
  | 'renew'
  | 'reissue'
  | 'notify'
  | 'pickup'
  | 'delete';

export type WorkflowActionPayload = {
  registration: CIPFRegistration;
  reason?: string;
};

export type DashboardQueueItem = {
  registration: CIPFRegistration;
  priority: number;
  nextAction: string;
  staleAlerts: string[];
};
