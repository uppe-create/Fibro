import { getAuthMode } from '@/lib/auth-mode';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export type AdminWorkflowAction = 'approve' | 'issue' | 'cancel' | 'renew' | 'reissue' | 'archive';
export type AdminExportKind = 'dashboard_csv' | 'dashboard_pdf' | 'monthly_pdf';

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

export async function authorizeAdminExport(kind: AdminExportKind, filters?: Record<string, unknown>): Promise<void> {
  if (!isSecureAdminBackendEnabled()) return;

  assertSupabaseConfigured();

  const { error } = await supabase.rpc('admin_request_export', {
    p_export_kind: kind,
    p_filters_json: filters || {}
  });

  if (error) mapRpcError(error, 'admin_request_export');
}
