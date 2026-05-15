import { describe, expect, it } from 'vitest';
import {
  buildCardVendorPdfRows,
  formatManualSignature,
  formatRegistro,
  getCardVendorPdfFileName,
  getCardVendorPdfTargets
} from '@/lib/card-vendor-pdf';
import type { CIPFRegistration } from '@/store/useAppStore';

const baseRegistration = (overrides: Partial<CIPFRegistration> = {}): CIPFRegistration => ({
  id: 'abcd1234-ffff-eeee-dddd-ccccbbbb0001',
  fullName: 'MARIA TESTE',
  cpf: '12345678901',
  cns: '123456789012345',
  birthDate: '01/01/1990',
  photoUrl: '',
  issueDate: '02/03/2026',
  expiryDate: '02/03/2028',
  status: 'approved',
  cid: 'M79.7',
  visualSignature: 'abcd1234',
  ...overrides
});

describe('card-vendor-pdf', () => {
  it('monta targets na ordem do lote', () => {
    const one = baseRegistration({ id: 'reg-1' });
    const two = baseRegistration({ id: 'reg-2', fullName: 'ANA TESTE' });

    const targets = getCardVendorPdfTargets([one, two], one, ['reg-2', 'reg-1']);

    expect(targets.map((item) => item.id)).toEqual(['reg-2', 'reg-1']);
  });

  it('ignora status fora de approved/issued', () => {
    const one = baseRegistration({ id: 'reg-1', status: 'under_review' });
    const two = baseRegistration({ id: 'reg-2', status: 'issued' });

    const targets = getCardVendorPdfTargets([one, two], one, ['reg-1', 'reg-2']);

    expect(targets.map((item) => item.id)).toEqual(['reg-2']);
  });

  it('monta ficha com campos esperados', () => {
    const rows = buildCardVendorPdfRows([{ registration: baseRegistration(), photoDataUri: 'data:image/png;base64,abc' }], 2026);

    expect(rows[0]).toMatchObject({
      fullName: 'MARIA TESTE',
      cpfDigits: '12345678901',
      cns: '123456789012345',
      registryNumber: 'ABCD1234/2026',
      statusLabel: 'Aprovada'
    });
  });

  it('gera nome de arquivo individual e lote', () => {
    const single = [{ registration: baseRegistration(), photoDataUri: '' }];
    const batch = [
      { registration: baseRegistration(), photoDataUri: '' },
      { registration: baseRegistration({ id: 'reg-2', cpf: '98765432100' }), photoDataUri: '' }
    ];

    expect(getCardVendorPdfFileName(single, new Date('2026-05-15T10:00:00Z'))).toBe('ficha_grafica_12345678901.pdf');
    expect(getCardVendorPdfFileName(batch, new Date('2026-05-15T10:00:00Z'))).toBe('fichas_grafica_lote_2026-05-15.pdf');
  });

  it('formata registro e codigo manual', () => {
    expect(formatRegistro('abcd1234-ffff', 2027)).toBe('ABCD1234/2027');
    expect(formatManualSignature('ab-cd 1234 xyz')).toBe('ABCD-1234');
  });
});
