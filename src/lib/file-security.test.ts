import { describe, expect, it } from 'vitest';
import { detectFileSignature, validateFileSecurity } from '@/lib/file-security';

const file = (name: string, type: string, bytes: number[]) => new File([new Uint8Array(bytes)], name, { type });

describe('file security', () => {
  it('detects supported file signatures', () => {
    expect(detectFileSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe('pdf');
    expect(detectFileSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('png');
    expect(detectFileSignature(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('jpeg');
    expect(detectFileSignature(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('webp');
  });

  it('accepts PDF, PNG, JPEG and WebP with matching metadata', async () => {
    await expect(validateFileSecurity(file('doc.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46]), 'document')).resolves.toBeUndefined();
    await expect(validateFileSecurity(file('img.png', 'image/png', [0x89, 0x50, 0x4e, 0x47]), 'photo')).resolves.toBeUndefined();
    await expect(validateFileSecurity(file('img.jpg', 'image/jpeg', [0xff, 0xd8, 0xff]), 'photo')).resolves.toBeUndefined();
    await expect(
      validateFileSecurity(file('img.webp', 'image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'photo')
    ).resolves.toBeUndefined();
  });

  it('rejects extension, MIME and magic byte mismatch', async () => {
    await expect(validateFileSecurity(file('doc.exe', 'application/pdf', [0x25, 0x50, 0x44, 0x46]), 'document')).rejects.toThrow('Formato');
    await expect(validateFileSecurity(file('doc.pdf', 'text/plain', [0x25, 0x50, 0x44, 0x46]), 'document')).rejects.toThrow('Tipo');
    await expect(validateFileSecurity(file('doc.pdf', 'application/pdf', [0x89, 0x50, 0x4e, 0x47]), 'document')).rejects.toThrow('Extensão');
  });

  it('rejects oversized files', async () => {
    const bigFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'doc.pdf', { type: 'application/pdf' });
    await expect(validateFileSecurity(bigFile, 'document')).rejects.toThrow('maior que 5 MB');
  });

  it('rejects PDFs without PDF signature', async () => {
    await expect(validateFileSecurity(file('doc.pdf', 'application/pdf', [0x00, 0x01, 0x02, 0x03]), 'document')).rejects.toThrow('Assinatura');
  });
});
