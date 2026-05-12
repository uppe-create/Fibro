import { describe, expect, it } from 'vitest';
import { normalizeAuditEntry } from '@/lib/audit-events';
import { filterAuditEntries, normalizeAuditEntries } from '@/lib/audit-history';

describe('audit history adapters', () => {
  it('normalizes legacy rows and strips user-agent from details', () => {
    const entry = normalizeAuditEntry({
      id: 1,
      action: 'Carteirinha Emitida',
      reason: 'Download PNG | ua=Browser Test',
      userName: 'ADMIN',
      registrationId: '11111111-1111-4111-8111-111111111111',
      timestamp: '2026-05-08T10:00:00.000Z'
    });

    expect(entry.eventCode).toBe('card.issued');
    expect(entry.details).toBe('Download PNG');
    expect(entry.metadata).toEqual({ userAgent: 'Browser Test' });
  });

  it('filters structured events by category and search', () => {
    const rows = [
      {
        id: 1,
        userName: 'ADMIN',
        timestamp: '2026-05-08T10:00:00.000Z',
        action: 'Cadastro aprovado',
        event_code: 'registration.approved',
        category: 'workflow',
        severity: 'info',
        target_type: 'registration',
        registrationId: 'a',
        target_id: 'a',
        target_label: 'Maria',
        summary: 'Cadastro aprovado'
      },
      {
        id: 2,
        userName: 'ADMIN',
        timestamp: '2026-05-08T11:00:00.000Z',
        action: 'Documento sensivel visualizado',
        event_code: 'document.sensitive_viewed',
        category: 'document',
        severity: 'sensitive',
        target_type: 'file',
        registrationId: 'b',
        target_id: 'b',
        target_label: 'Joao',
        summary: 'Documento sensivel visualizado',
        details: 'Laudo medico'
      }
    ];

    const entries = normalizeAuditEntries(rows as any);
    const filtered = filterAuditEntries({
      entries,
      search: 'laudo',
      category: 'document',
      severity: 'all',
      mode: 'all',
      actor: '',
      targetId: ''
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].eventCode).toBe('document.sensitive_viewed');
  });
});
