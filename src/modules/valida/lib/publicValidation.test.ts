import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  return {
    maybeSingleMock,
    rpcMock: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
    fromMock: vi.fn()
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpcMock,
    from: mocks.fromMock
  }
}));

import {
  fetchPublicValidation,
  formatDisplaySignature,
  getValiditySummary,
  isRateLimitError,
  normalizeManualRegistryCode,
  normalizeSignature
} from '@/modules/valida/lib/publicValidation';
import { extractValidationParamsFromQrText } from '@/modules/valida/lib/qrScanner';

describe('public validation helpers', () => {
  beforeEach(() => {
    mocks.rpcMock.mockClear();
    mocks.fromMock.mockClear();
    mocks.maybeSingleMock.mockReset();
  });

  it('normalizes manual registry codes and signatures', () => {
    expect(normalizeSignature(' f9k2-m8qz ')).toBe('F9K2M8QZ');
    expect(formatDisplaySignature('f9k2m8qz')).toBe('F9K2-M8QZ');
    expect(normalizeManualRegistryCode('a1b2c3d4/2026')).toBe('A1B2C3D4');
    expect(normalizeManualRegistryCode('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('extracts id and signature from QR URLs', () => {
    expect(extractValidationParamsFromQrText('https://example.test/valida?id=abc&sig=xyz')).toEqual({ id: 'abc', sig: 'xyz' });
    expect(extractValidationParamsFromQrText('https://example.test/valida?id=abc')).toBeNull();
  });

  it('summarizes missing and invalid validity dates', () => {
    expect(getValiditySummary(null)).toBe('Validade nao informada.');
    expect(getValiditySummary({ id: '1', fullName: 'A', cpfMasked: '***', issueDate: 'x', expiryDate: 'bad', status: 'issued' })).toBe(
      'Validade em formato invalido.'
    );
  });

  it('detects backend rate limit errors', () => {
    expect(isRateLimitError({ message: 'RATE_LIMITED: muitas consultas' })).toBe(true);
    expect(isRateLimitError({ details: 'RATE_LIMITED' })).toBe(true);
    expect(isRateLimitError({ message: 'other error' })).toBe(false);
  });

  it('uses only validate_cipf_public RPC for public validation', async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fullName: 'Pessoa Teste',
        cpfMasked: '***.123.***-**',
        issueDate: '01/01/2026',
        expiryDate: '01/01/2028',
        status: 'issued',
        visualSignature: 'F9K2M8QZ'
      },
      error: null
    });

    const result = await fetchPublicValidation('A1B2C3D4', 'F9K2M8QZ');

    expect(result.signatureCheckedByDb).toBe(true);
    expect(result.data?.fullName).toBe('Pessoa Teste');
    expect(mocks.rpcMock).toHaveBeenCalledTimes(1);
    expect(mocks.rpcMock).toHaveBeenCalledWith('validate_cipf_public', { p_registry: 'A1B2C3D4', p_sig: 'F9K2M8QZ' });
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it('fails closed when validate_cipf_public is unavailable', async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'function not found' }
    });

    await expect(fetchPublicValidation('A1B2C3D4', 'F9K2M8QZ')).rejects.toThrow('Serviço de validação indisponível');
    expect(mocks.rpcMock).toHaveBeenCalledTimes(1);
    expect(mocks.rpcMock).toHaveBeenCalledWith('validate_cipf_public', { p_registry: 'A1B2C3D4', p_sig: 'F9K2M8QZ' });
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it('keeps rate limit errors explicit', async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'RATE_LIMITED: muitas consultas' }
    });

    await expect(fetchPublicValidation('A1B2C3D4', 'F9K2M8QZ')).rejects.toThrow('Limite de consultas excedido');
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });
});
