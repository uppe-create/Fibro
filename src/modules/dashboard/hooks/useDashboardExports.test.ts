import { describe, expect, it } from 'vitest';
import { safeCsvCell } from '@/modules/dashboard/hooks/useDashboardExports';

describe('dashboard CSV export safety', () => {
  it('escapes formulas and quotes', () => {
    expect(safeCsvCell('=cmd')).toBe('"\'=cmd"');
    expect(safeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(safeCsvCell('-10')).toBe('"\'-10"');
    expect(safeCsvCell('@link')).toBe('"\'@link"');
    expect(safeCsvCell('A "normal" value')).toBe('"A ""normal"" value"');
  });
});
