import { describe, expect, it } from 'vitest';
import { formatCNS, formatCPF, formatDate, formatPhone, validateCPF } from '@/lib/utils';

describe('formatters and CPF validation', () => {
  it('formats common document fields', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
    expect(formatDate('01022026')).toBe('01/02/2026');
    expect(formatPhone('15999998888')).toBe('(15) 99999-8888');
    expect(formatCNS('123456789012345')).toBe('123 4567 8901 2345');
  });

  it('validates CPF check digits', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
    expect(validateCPF('111.111.111-11')).toBe(false);
    expect(validateCPF('529.982.247-24')).toBe(false);
  });
});
