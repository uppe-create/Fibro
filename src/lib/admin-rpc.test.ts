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

  it('autoriza exportacao tecnica da grafica', async () => {
    const mod = await import('@/lib/admin-rpc');

    await mod.authorizeAdminExport('card_vendor_pdf', {
      count: 2,
      registrationIds: ['reg-1', 'reg-2']
    });

    expect(rpc).toHaveBeenCalledWith('admin_request_export', expect.objectContaining({
      p_export_kind: 'card_vendor_pdf'
    }));
  });

  it('aceita fallback legado para card_vendor_pdf quando banco ainda nao conhece tipo novo', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'INVALID_EXPORT_KIND' } });
    vi.doMock('@/lib/supabase', () => ({
      assertSupabaseConfigured: vi.fn(),
      supabase: { rpc }
    }));

    const mod = await import('@/lib/admin-rpc');
    await expect(
      mod.authorizeAdminExport('card_vendor_pdf', { count: 1 }, { allowLegacyKindFallback: true })
    ).resolves.toBeUndefined();
  });

  it('aceita fallback restrito quando RPC negar card_vendor_pdf mas tela ja liberou impressao', async () => {
    rpc.mockResolvedValue({ error: { message: 'FORBIDDEN' } });
    const mod = await import('@/lib/admin-rpc');

    await expect(
      mod.authorizeAdminExport('card_vendor_pdf', { count: 1 }, { allowForbiddenFallback: true })
    ).resolves.toBeUndefined();
  });
});
