import { describe, expect, it } from 'vitest';
import { detectBrowser, shouldPreferReducedEffects } from '@/lib/runtime-compat';

describe('runtime-compat', () => {
  it('detecta Firefox pelo user agent', () => {
    expect(detectBrowser('Mozilla/5.0 Firefox/126.0').isFirefox).toBe(true);
    expect(detectBrowser('Mozilla/5.0 Chrome/136.0').isFirefox).toBe(false);
  });

  it('ativa modo reduzido para Firefox, memoria baixa ou reduced motion', () => {
    expect(shouldPreferReducedEffects({ isFirefox: true, deviceMemoryGb: 8, prefersReducedMotion: false })).toBe(true);
    expect(shouldPreferReducedEffects({ isFirefox: false, deviceMemoryGb: 4, prefersReducedMotion: false })).toBe(true);
    expect(shouldPreferReducedEffects({ isFirefox: false, deviceMemoryGb: 8, prefersReducedMotion: true })).toBe(true);
    expect(shouldPreferReducedEffects({ isFirefox: false, deviceMemoryGb: 8, prefersReducedMotion: false })).toBe(false);
  });
});
