import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  supabase: { rpc }
}));

vi.mock('@/lib/auth-mode', () => ({
  getAuthMode: vi.fn(() => 'supabase')
}));

describe('admin-rpc', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it('envia edicao segura para RPC', async () => {
    const mod = await import('@/lib/admin-rpc');

    await mod.updateRegistrationSecure(
      'reg-1',
      {
        fullName: 'TESTE',
        cns: null,
        phone: '15999999999',
        birthDate: '01/01/1990',
        legalGuardian: null,
        cep: '18560000',
        logradouro: 'RUA A',
        bairro: 'CENTRO',
        cidade: 'IPERO',
        estado: 'SP',
        cid: 'M79.7',
        justificativaCid: null,
        crm: '1234',
        proofOfResidenceDate: '01/01/2026',
        medicalReportDate: '01/01/2026',
        issueDate: '01/01/2026',
        expiryDate: '01/01/2028',
        status: 'approved'
      },
      'Ajuste operacional'
    );

    expect(rpc).toHaveBeenCalledWith('admin_update_registration', expect.objectContaining({
      p_registration_id: 'reg-1',
      p_reason: 'Ajuste operacional'
    }));
  });

  it('envia incidente para RPC', async () => {
    const mod = await import('@/lib/admin-rpc');

    await mod.createSecurityIncidentSecure({
      title: 'Teste',
      severity: 'high',
      occurredAt: null,
      summary: 'Resumo',
      affectedData: 'CPF',
      affectedSubjects: 2,
      containmentActions: 'Bloqueio',
      notificationRequired: true,
      ownerName: 'SEC SAUDE'
    });

    expect(rpc).toHaveBeenCalledWith('admin_create_security_incident', expect.objectContaining({
      p_title: 'Teste',
      p_notification_required: true
    }));
  });
});
