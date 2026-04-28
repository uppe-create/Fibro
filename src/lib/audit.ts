import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuditPayload = {
  action: string;
  registrationId?: string | null;
  userId?: string | null;
  userName?: string | null;
  reason?: string;
};

export async function logAuditEvent({
  action,
  registrationId = null,
  userId = null,
  userName = null,
  reason
}: AuditPayload): Promise<void> {
  if (!action || !isSupabaseConfigured) return;

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const details = reason ? `${reason} | ua=${userAgent}` : `ua=${userAgent}`;

  const { error } = await supabase.from('audit_logs').insert({
    registrationId,
    userId,
    userName,
    ip: 'client',
    timestamp: new Date().toISOString(),
    action,
    reason: details
  });

  if (error) {
    // Auditoria nao deve derrubar fluxo principal.
    console.error('Falha ao gravar auditoria:', error.message);
  }
}
