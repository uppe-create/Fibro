export type AuditCategory = 'auth' | 'registration' | 'workflow' | 'document' | 'export' | 'system';
export type AuditSeverity = 'info' | 'warning' | 'sensitive';
export type AuditTargetType = 'registration' | 'system' | 'file' | 'session';
export type AuditMode = 'all' | 'sensitive' | 'registration';

export type AuditEventInput = {
  action?: string;
  details?: string;
  eventCode?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  targetType?: AuditTargetType;
  targetLabel?: string | null;
  summary?: string;
  metadata?: Record<string, unknown> | null;
  registrationId?: string | null;
  userId?: string | null;
  userName?: string | null;
};

export type AuditEntryRow = {
  id?: string | number | null;
  userId?: string | null;
  userName?: string | null;
  registrationId?: string | null;
  action?: string | null;
  reason?: string | null;
  timestamp?: string | null;
  ip?: string | null;
  event_code?: string | null;
  category?: AuditCategory | null;
  severity?: AuditSeverity | null;
  target_type?: AuditTargetType | null;
  target_id?: string | null;
  target_label?: string | null;
  summary?: string | null;
  details?: string | null;
  metadata_json?: Record<string, unknown> | string | null;
};

export type AuditTimelineEntry = {
  id: string;
  actor: string;
  actorId?: string | null;
  eventCode: string;
  category: AuditCategory;
  severity: AuditSeverity;
  targetType: AuditTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  summary: string;
  details?: string | null;
  timestamp: string;
  ip?: string | null;
  metadata: Record<string, unknown> | null;
  legacyAction?: string | null;
};

type AuditEventDefinition = {
  eventCode: string;
  category: AuditCategory;
  severity: AuditSeverity;
  targetType: AuditTargetType;
  summary: string;
};

const AUDIT_EVENT_DEFINITIONS: Record<string, AuditEventDefinition> = {
  'auth.login.supabase': { eventCode: 'auth.login.supabase', category: 'auth', severity: 'info', targetType: 'session', summary: 'Login com Supabase Auth' },
  'auth.login.local': { eventCode: 'auth.login.local', category: 'auth', severity: 'warning', targetType: 'session', summary: 'Login com credencial local' },
  'auth.login_failed': { eventCode: 'auth.login_failed', category: 'auth', severity: 'warning', targetType: 'session', summary: 'Falha de login' },
  'auth.lockout_enabled': { eventCode: 'auth.lockout_enabled', category: 'auth', severity: 'warning', targetType: 'session', summary: 'Bloqueio temporario de login ativado' },
  'auth.logout': { eventCode: 'auth.logout', category: 'auth', severity: 'info', targetType: 'session', summary: 'Logout' },
  'registration.created': { eventCode: 'registration.created', category: 'registration', severity: 'info', targetType: 'registration', summary: 'Cadastro enviado para analise' },
  'registration.edited': { eventCode: 'registration.edited', category: 'registration', severity: 'info', targetType: 'registration', summary: 'Cadastro editado' },
  'registration.approved': { eventCode: 'registration.approved', category: 'workflow', severity: 'info', targetType: 'registration', summary: 'Cadastro aprovado' },
  'card.issued': { eventCode: 'card.issued', category: 'workflow', severity: 'sensitive', targetType: 'registration', summary: 'Carteirinha emitida' },
  'card.print_accessed': { eventCode: 'card.print_accessed', category: 'workflow', severity: 'sensitive', targetType: 'registration', summary: 'Acesso a impressao' },
  'registration.cancelled': { eventCode: 'registration.cancelled', category: 'workflow', severity: 'warning', targetType: 'registration', summary: 'Carteirinha cancelada' },
  'registration.renewed': { eventCode: 'registration.renewed', category: 'workflow', severity: 'info', targetType: 'registration', summary: 'Renovacao iniciada' },
  'card.reissued': { eventCode: 'card.reissued', category: 'workflow', severity: 'sensitive', targetType: 'registration', summary: 'Segunda via registrada' },
  'patient.notified': { eventCode: 'patient.notified', category: 'workflow', severity: 'info', targetType: 'registration', summary: 'Paciente avisado' },
  'card.picked_up': { eventCode: 'card.picked_up', category: 'workflow', severity: 'sensitive', targetType: 'registration', summary: 'Carteirinha retirada' },
  'registration.archived': { eventCode: 'registration.archived', category: 'workflow', severity: 'warning', targetType: 'registration', summary: 'Registro arquivado' },
  'note.internal_added': { eventCode: 'note.internal_added', category: 'registration', severity: 'info', targetType: 'registration', summary: 'Observacao interna registrada' },
  'document.sensitive_viewed': { eventCode: 'document.sensitive_viewed', category: 'document', severity: 'sensitive', targetType: 'file', summary: 'Documento sensivel visualizado' },
  'export.summary_copied': { eventCode: 'export.summary_copied', category: 'export', severity: 'sensitive', targetType: 'registration', summary: 'Resumo operacional copiado' },
  'export.dashboard_csv': { eventCode: 'export.dashboard_csv', category: 'export', severity: 'sensitive', targetType: 'system', summary: 'Exportacao CSV do dashboard' },
  'export.dashboard_pdf': { eventCode: 'export.dashboard_pdf', category: 'export', severity: 'sensitive', targetType: 'system', summary: 'Exportacao PDF do dashboard' },
  'export.monthly_pdf': { eventCode: 'export.monthly_pdf', category: 'export', severity: 'sensitive', targetType: 'system', summary: 'Relatorio mensal PDF exportado' },
  'export.card_vendor_pdf': { eventCode: 'export.card_vendor_pdf', category: 'export', severity: 'sensitive', targetType: 'system', summary: 'PDF tecnico da grafica exportado' },
  'system.backup_downloaded': { eventCode: 'system.backup_downloaded', category: 'system', severity: 'sensitive', targetType: 'system', summary: 'Backup guiado baixado' },
  'system.database_archived': { eventCode: 'system.database_archived', category: 'system', severity: 'warning', targetType: 'system', summary: 'Base arquivada logicamente' }
};

const LEGACY_EVENT_MAP: Record<string, string> = {
  'login com supabase auth': 'auth.login.supabase',
  'login com credencial local': 'auth.login.local',
  'tentativa de login falha': 'auth.login_failed',
  'bloqueio de login ativado': 'auth.lockout_enabled',
  logout: 'auth.logout',
  'cadastro enviado para analise': 'registration.created',
  'edicao de cadastro': 'registration.edited',
  'cadastro aprovado': 'registration.approved',
  'carteirinha emitida': 'card.issued',
  'acesso a impressao': 'card.print_accessed',
  'carteirinha cancelada': 'registration.cancelled',
  'renovacao iniciada': 'registration.renewed',
  'segunda via registrada': 'card.reissued',
  'paciente avisado': 'patient.notified',
  'carteirinha retirada': 'card.picked_up',
  'registro arquivado': 'registration.archived',
  'observacao interna': 'note.internal_added',
  'visualizacao de documento sensivel': 'document.sensitive_viewed',
  'resumo operacional copiado': 'export.summary_copied',
  'exportacao csv dashboard': 'export.dashboard_csv',
  'exportacao pdf dashboard': 'export.dashboard_pdf',
  'relatorio mensal pdf': 'export.monthly_pdf',
  'pdf tecnico grafica': 'export.card_vendor_pdf',
  'backup guiado baixado': 'system.backup_downloaded',
  'backup json exportado': 'system.backup_downloaded',
  'arquivamento geral': 'system.database_archived'
};

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: 'Autenticacao',
  registration: 'Cadastro',
  workflow: 'Fluxo',
  document: 'Documento',
  export: 'Exportacao',
  system: 'Sistema'
};

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: 'Informativo',
  warning: 'Atencao',
  sensitive: 'Sensivel'
};

const normalizePlain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseMetadata = (value: AuditEntryRow['metadata_json']): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const splitLegacyReason = (value?: string | null) => {
  if (!value) return { details: null as string | null, metadata: null as Record<string, unknown> | null };
  const userAgentMatch = value.match(/(?:^|\s)\|\s*ua=(.+)$/i);
  if (!userAgentMatch) return { details: value.trim(), metadata: null };
  const details = value.replace(/\s*\|\s*ua=.+$/i, '').trim() || null;
  return {
    details,
    metadata: { userAgent: userAgentMatch[1].trim() }
  };
};

export const buildAuditEvent = (eventCode: string, overrides: Omit<AuditEventInput, 'eventCode'> = {}): AuditEventInput => {
  const definition = AUDIT_EVENT_DEFINITIONS[eventCode];
  if (!definition) {
    return {
      eventCode,
      summary: overrides.summary || eventCode,
      action: overrides.action || overrides.summary || eventCode,
      category: overrides.category || 'system',
      severity: overrides.severity || 'info',
      targetType: overrides.targetType || 'system',
      ...overrides
    };
  }

  return {
    eventCode: definition.eventCode,
    action: overrides.action || definition.summary,
    summary: overrides.summary || definition.summary,
    category: overrides.category || definition.category,
    severity: overrides.severity || definition.severity,
    targetType: overrides.targetType || definition.targetType,
    ...overrides
  };
};

export const toAuditRpcPayload = (input: AuditEventInput) => {
  const legacyAction = input.action || input.summary || input.eventCode || 'Evento do sistema';
  const definition = input.eventCode ? AUDIT_EVENT_DEFINITIONS[input.eventCode] : undefined;
  const category = input.category || definition?.category || inferLegacyCategory(legacyAction);
  const severity = input.severity || definition?.severity || inferLegacySeverity(legacyAction);
  const targetType = input.targetType || definition?.targetType || (input.registrationId ? 'registration' : 'system');
  const summary = input.summary || definition?.summary || legacyAction;

  return {
    p_action: legacyAction,
    p_registration_id: input.registrationId || null,
    p_reason: input.details || null,
    p_event_code: input.eventCode || inferLegacyCode(legacyAction),
    p_category: category,
    p_severity: severity,
    p_target_type: targetType,
    p_target_label: input.targetLabel || null,
    p_summary: summary,
    p_details: input.details || null,
    p_metadata_json: input.metadata || null
  };
};

export const inferLegacyCode = (action = ''): string => LEGACY_EVENT_MAP[normalizePlain(action)] || 'system.legacy_event';

export const inferLegacyCategory = (action = ''): AuditCategory => {
  const code = inferLegacyCode(action);
  return AUDIT_EVENT_DEFINITIONS[code]?.category || 'system';
};

export const inferLegacySeverity = (action = ''): AuditSeverity => {
  const code = inferLegacyCode(action);
  return AUDIT_EVENT_DEFINITIONS[code]?.severity || 'info';
};

export const normalizeAuditEntry = (row: AuditEntryRow): AuditTimelineEntry => {
  const metadataFromColumn = parseMetadata(row.metadata_json);
  const legacyReason = splitLegacyReason(row.reason);
  const metadata = metadataFromColumn || legacyReason.metadata;
  const eventCode = row.event_code || inferLegacyCode(String(row.action || ''));
  const definition = AUDIT_EVENT_DEFINITIONS[eventCode];
  const summary = row.summary || row.action || definition?.summary || 'Evento do sistema';
  const details = row.details || legacyReason.details;

  return {
    id: String(row.id || `${row.timestamp || 'sem-data'}-${summary}`),
    actor: row.userName || 'Sistema',
    actorId: row.userId || null,
    eventCode,
    category: row.category || definition?.category || inferLegacyCategory(String(row.action || '')),
    severity: row.severity || definition?.severity || inferLegacySeverity(String(row.action || '')),
    targetType: row.target_type || definition?.targetType || (row.registrationId ? 'registration' : 'system'),
    targetId: row.target_id || row.registrationId || null,
    targetLabel: row.target_label || null,
    summary,
    details,
    timestamp: row.timestamp || '',
    ip: row.ip || null,
    metadata,
    legacyAction: row.action || null
  };
};

export const getAuditHistoryFilterKey = (entry: Pick<AuditTimelineEntry, 'eventCode' | 'category'>) => {
  if (entry.eventCode === 'note.internal_added') return 'observacao';
  if (entry.eventCode === 'card.picked_up') return 'retirada';
  if (entry.eventCode === 'patient.notified') return 'contato';
  if (entry.eventCode === 'registration.approved') return 'aprovacao';
  if (entry.eventCode === 'card.issued' || entry.eventCode === 'card.print_accessed') return 'emissao';
  if (entry.eventCode === 'registration.renewed' || entry.eventCode === 'card.reissued') return 'renovacao';
  if (entry.eventCode === 'registration.cancelled' || entry.eventCode === 'registration.archived') return 'cancelamento';
  if (entry.category === 'document') return 'documentos';
  if (entry.eventCode === 'registration.edited') return 'edicao';
  if (entry.category === 'registration') return 'cadastro';
  return 'all';
};

export const matchesAuditMode = (entry: AuditTimelineEntry, mode: AuditMode) => {
  if (mode === 'all') return true;
  if (mode === 'sensitive') return entry.severity === 'sensitive';
  return entry.targetType === 'registration';
};

export const auditSearchText = (entry: AuditTimelineEntry) =>
  [
    entry.summary,
    entry.details,
    entry.actor,
    entry.targetId,
    entry.targetLabel,
    entry.ip,
    entry.eventCode,
    entry.category,
    entry.severity
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
