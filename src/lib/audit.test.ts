import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logAuditEvent } from '@/lib/audit';
import { buildAuditEvent } from '@/lib/audit-events';

const auditMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn()
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: auditMock
}));

describe('secure audit logging', () => {
  beforeEach(() => {
    auditMock.rpc.mockReset();
    auditMock.from.mockReset();
    auditMock.rpc.mockResolvedValue({ error: null });
  });

  it('logs only through RPC, never direct audit_logs insert', async () => {
    await logAuditEvent(buildAuditEvent('registration.approved', {
      registrationId: '11111111-1111-4111-8111-111111111111',
      userId: 'client-controlled',
      userName: 'CLIENTE',
      targetLabel: 'Pessoa Teste',
      details: 'Fluxo aprovado'
    }));

    expect(auditMock.rpc).toHaveBeenCalledWith('log_audit_event', expect.objectContaining({
      p_event_code: 'registration.approved',
      p_category: 'workflow',
      p_summary: 'Cadastro aprovado'
    }));
    expect(auditMock.from).not.toHaveBeenCalled();
  });
});
