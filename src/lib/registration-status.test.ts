import { describe, expect, it } from 'vitest';
import {
  canApproveStatus,
  canCancelStatus,
  canIssueStatus,
  canReissueStatus,
  canRenewStatus,
  getStatusLabel,
  isCpfBlockedByStatus,
  isPrintableStatus,
  isPubliclyValidStatus,
  normalizeRegistrationStatus,
  statusMatchesFilter
} from '@/lib/registration-status';

describe('registration status', () => {
  it('normalizes legacy and invalid statuses', () => {
    expect(normalizeRegistrationStatus('active')).toBe('issued');
    expect(normalizeRegistrationStatus('pending')).toBe('under_review');
    expect(normalizeRegistrationStatus('bad')).toBe('under_review');
    expect(getStatusLabel('issued')).toBe('Emitida');
  });

  it('enforces workflow gates', () => {
    expect(isPubliclyValidStatus('issued')).toBe(true);
    expect(isPubliclyValidStatus('approved')).toBe(false);
    expect(isPrintableStatus('approved')).toBe(true);
    expect(canApproveStatus('under_review')).toBe(true);
    expect(canIssueStatus('approved')).toBe(true);
    expect(canCancelStatus('cancelled')).toBe(false);
    expect(canRenewStatus('expired')).toBe(true);
    expect(canReissueStatus('issued')).toBe(true);
  });

  it('matches filters and duplicate blocking rules', () => {
    expect(statusMatchesFilter('active', 'issued')).toBe(true);
    expect(statusMatchesFilter('cancelled', 'all')).toBe(true);
    expect(isCpfBlockedByStatus('issued')).toBe(true);
    expect(isCpfBlockedByStatus('cancelled')).toBe(false);
  });
});
