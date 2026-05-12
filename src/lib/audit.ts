import { toAuditRpcPayload, type AuditEventInput } from '@/lib/audit-events';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  if ((!input.action && !input.eventCode && !input.summary) || !isSupabaseConfigured) return;

  const payload = toAuditRpcPayload({
    ...input,
    metadata: {
      ...(input.metadata || {}),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }
  });

  const { error } = await supabase.rpc('log_audit_event', payload);
  if (!error) return;

  const message = String((error as any)?.message || '');
  const code = String((error as any)?.code || '');
  const supportsLegacyFallback =
    code === 'PGRST202' ||
    code === '42883' ||
    /log_audit_event/i.test(message) ||
    /Could not find the function/i.test(message);

  if (!supportsLegacyFallback) {
    console.error('Falha ao gravar auditoria segura:', message || error);
    return;
  }

  const { error: legacyError } = await supabase.rpc('log_audit_event', {
    p_action: payload.p_action,
    p_registration_id: payload.p_registration_id,
    p_reason: payload.p_details
  });

  if (legacyError) {
    console.error('Falha ao gravar auditoria legada:', legacyError.message || legacyError);
  }
}
