import { describe, expect, it } from 'vitest';
import { resolveInitialActiveTab } from '@/lib/app-bootstrap';

describe('resolveInitialActiveTab', () => {
  it('normaliza alias publicos e internos validos', () => {
    expect(resolveInitialActiveTab('/valida')).toBe('validar');
    expect(resolveInitialActiveTab('/cadastros')).toBe('pessoas');
    expect(resolveInitialActiveTab('/dashboard')).toBe('dashboard');
  });

  it('cai para inicio quando rota vier invalida', () => {
    expect(resolveInitialActiveTab('/nao-existe')).toBe('inicio');
    expect(resolveInitialActiveTab('')).toBe('inicio');
  });
});
