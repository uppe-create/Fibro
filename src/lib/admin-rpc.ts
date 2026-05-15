import { getAuthMode } from '@/lib/auth-mode';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export type AdminWorkflowAction = 'approve' | 'issue' | 'cancel' | 'renew' | 'reissue' | 'archive';
export type AdminExportKind = 'dashboard_csv' | 'dashboard_pdf' | 'monthly_pdf' | 'card_vendor_pdf';
export type AdminExportAuthorizeOptions = {
  allowLegacyKindFallback?: boolean;
  allowForbiddenFallback?: boolean;
};
export type AdminRegistrationEditPayload = {
  fullName: string;
  cns: string | null;
  phone: string;
  birthDate: string;
  legalGuardian: string | null;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cid: string;
  justificativaCid: string | null;
  crm: string;
  proofOfResidenceDate: string | null;
  medicalReportDate: string | null;
  issueDate: string;
  expiryDate: string;
  status: string;
};

export type GovernanceRequestInput = {
  requestType: string;
  dataSubjectName: string;
  dataSubjectCpf: string;
  channel: string;
  dueAt: string;
  legalNotes: string;
  ownerName: string;
};

export type GovernanceRequestUpdateInput = {
  status: string;
  responseSummary: string;
  legalNotes: string;
  ownerName: string;
};

export type SecurityIncidentInput = {
  title: string;
  severity: string;
  occurredAt: string | null;
  summary: string;
  affectedData: string;
  affectedSubjects: number;
  containmentActions: string;
  notificationRequired: boolean;
  ownerName: string;
};

export type SecurityIncidentUpdateInput = {
  status: string;
  summary: string;
  containmentActions: string;
  notificationRequired: boolean;
  notifiedAnpdAt: string | null;
  notifiedSubjectsAt: string | null;
  ownerName: string;
};

const env = (import.meta as any).env || {};

export const isSecureAdminBackendEnabled = (): boolean => getAuthMode(env) === 'supabase';

const isMissingRpcError = (error: unknown, rpcName: string): boolean => {
  const message = String((error as any)?.message || '');
  const code = String((error as any)?.code || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes(rpcName) ||
    message.includes('Could not find the function')
  );
};

const mapRpcError = (error: unknown, rpcName: string): never => {
  if (isMissingRpcError(error, rpcName)) {
    throw new Error(`Supabase sem ${rpcName}. Aplique a migracao versionada antes de usar este fluxo.`);
  }

  const message = String((error as any)?.message || '').trim();
  if (message === 'FORBIDDEN') throw new Error('Permissao insuficiente para esta acao.');
  if (message === 'AUTH_REQUIRED') throw new Error('Sessao expirada. Entre novamente.');
  if (message === 'NOT_FOUND') throw new Error('Cadastro nao encontrado.');
  if (message === 'REASON_REQUIRED') throw new Error('Informe o motivo para concluir esta acao.');
  if (message === 'INVALID_EXPORT_KIND') throw new Error('Tipo de exportacao ainda nao liberado no banco remoto.');

  throw new Error(message || 'Falha na operacao administrativa segura.');
};

export async function runAdminWorkflowRpc(
  registrationId: string,
  action: AdminWorkflowAction,
  reason?: string
): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_transition_registration', {
    p_registration_id: registrationId,
    p_action: action,
    p_reason: reason || null
  });

  if (error) mapRpcError(error, 'admin_transition_registration');
}

export async function authorizeAdminExport(
  kind: AdminExportKind,
  filters?: Record<string, unknown>,
  options?: AdminExportAuthorizeOptions
): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_request_export', {
    p_export_kind: kind,
    p_filters_json: filters || {}
  });

  if (!error) return;

  const message = String((error as any)?.message || '').trim();
  if (
    options?.allowLegacyKindFallback &&
    kind === 'card_vendor_pdf' &&
    (isMissingRpcError(error, 'admin_request_export') || message === 'INVALID_EXPORT_KIND')
  ) {
    return;
  }

  if (options?.allowForbiddenFallback && kind === 'card_vendor_pdf' && message === 'FORBIDDEN') {
    return;
  }

  mapRpcError(error, 'admin_request_export');
}

export async function updateRegistrationSecure(
  registrationId: string,
  payload: AdminRegistrationEditPayload,
  reason: string
): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_update_registration', {
    p_registration_id: registrationId,
    p_changes_json: payload,
    p_reason: reason
  });

  if (error) mapRpcError(error, 'admin_update_registration');
}

export async function recordPatientContactSecure(registrationId: string, channel: string): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_record_patient_contact', {
    p_registration_id: registrationId,
    p_channel: channel || 'Aviso registrado'
  });

  if (error) mapRpcError(error, 'admin_record_patient_contact');
}

export async function recordPickupSecure(registrationId: string, note: string): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_record_pickup', {
    p_registration_id: registrationId,
    p_note: note || 'Retirada registrada'
  });

  if (error) mapRpcError(error, 'admin_record_pickup');
}

export async function archiveDatabaseSecure(reason: string): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_archive_registrations', {
    p_reason: reason || 'Arquivamento administrativo da base'
  });

  if (error) mapRpcError(error, 'admin_archive_registrations');
}

export async function createGovernanceRequestSecure(payload: GovernanceRequestInput): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_create_lgpd_request', {
    p_request_type: payload.requestType,
    p_data_subject_name: payload.dataSubjectName,
    p_data_subject_cpf: payload.dataSubjectCpf,
    p_channel: payload.channel,
    p_due_at: payload.dueAt || null,
    p_legal_notes: payload.legalNotes || null,
    p_owner_name: payload.ownerName || null
  });

  if (error) mapRpcError(error, 'admin_create_lgpd_request');
}

export async function updateGovernanceRequestSecure(requestId: string, payload: GovernanceRequestUpdateInput): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_update_lgpd_request', {
    p_request_id: requestId,
    p_status: payload.status,
    p_response_summary: payload.responseSummary || null,
    p_legal_notes: payload.legalNotes || null,
    p_owner_name: payload.ownerName || null
  });

  if (error) mapRpcError(error, 'admin_update_lgpd_request');
}

export async function createSecurityIncidentSecure(payload: SecurityIncidentInput): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_create_security_incident', {
    p_title: payload.title,
    p_severity: payload.severity,
    p_occurred_at: payload.occurredAt,
    p_summary: payload.summary,
    p_affected_data: payload.affectedData,
    p_affected_subjects: payload.affectedSubjects,
    p_containment_actions: payload.containmentActions,
    p_notification_required: payload.notificationRequired,
    p_owner_name: payload.ownerName || null
  });

  if (error) mapRpcError(error, 'admin_create_security_incident');
}

export async function updateSecurityIncidentSecure(incidentId: string, payload: SecurityIncidentUpdateInput): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_update_security_incident', {
    p_incident_id: incidentId,
    p_status: payload.status,
    p_summary: payload.summary,
    p_containment_actions: payload.containmentActions,
    p_notification_required: payload.notificationRequired,
    p_notified_anpd_at: payload.notifiedAnpdAt,
    p_notified_subjects_at: payload.notifiedSubjectsAt,
    p_owner_name: payload.ownerName || null
  });

  if (error) mapRpcError(error, 'admin_update_security_incident');
}
