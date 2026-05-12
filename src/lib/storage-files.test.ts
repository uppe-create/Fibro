import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  in: vi.fn(),
  delete: vi.fn(),
  fromTable: vi.fn(),
  fromStorage: vi.fn(),
  assertSupabaseConfigured: vi.fn()
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  assertSupabaseConfigured: supabaseMock.assertSupabaseConfigured,
  supabase: {
    storage: {
      from: supabaseMock.fromStorage
    },
    from: supabaseMock.fromTable
  }
}));

const storageBucket = {
  upload: supabaseMock.upload,
  remove: supabaseMock.remove,
  createSignedUrl: supabaseMock.createSignedUrl
};

const tableQuery = {
  insert: supabaseMock.insert,
  select: supabaseMock.select,
  eq: supabaseMock.eq,
  maybeSingle: supabaseMock.maybeSingle,
  in: supabaseMock.in,
  delete: supabaseMock.delete
};

const pdfFile = (name = 'documento.pdf') => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: 'application/pdf' });
const uuid = '33333333-3333-4333-8333-333333333333' as `${string}-${string}-${string}-${string}-${string}`;

describe('private storage files', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(supabaseMock).forEach((mock) => mock.mockReset());
    supabaseMock.fromStorage.mockReturnValue(storageBucket);
    supabaseMock.assertSupabaseConfigured.mockImplementation(() => undefined);
    supabaseMock.fromTable.mockReturnValue(tableQuery);
    supabaseMock.upload.mockResolvedValue({ error: null });
    supabaseMock.insert.mockResolvedValue({ error: null });
    supabaseMock.select.mockReturnValue(tableQuery);
    supabaseMock.eq.mockReturnValue(tableQuery);
    supabaseMock.maybeSingle.mockResolvedValue({ data: { storage_path: 'registrations/reg/document/file.pdf' }, error: null });
    supabaseMock.in.mockResolvedValue({ data: [{ storage_path: 'registrations/reg/document/file.pdf' }], error: null });
    supabaseMock.delete.mockReturnValue(tableQuery);
    supabaseMock.remove.mockResolvedValue({ error: null });
    supabaseMock.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.test/file.pdf' }, error: null });
  });

  it('builds a safe path without CPF or patient name', async () => {
    const { buildCipfStoragePath } = await import('@/lib/storage-files');
    const path = buildCipfStoragePath('reg-123', 'document', pdfFile('MARIA-12345678900.pdf'), uuid);

    expect(path).toBe(`registrations/reg-123/document/${uuid}.pdf`);
    expect(path).not.toContain('MARIA');
    expect(path).not.toContain('12345678900');
  });

  it('uploads with private bucket and stores metadata', async () => {
    const { uploadCipfStorageFile } = await import('@/lib/storage-files');
    const id = await uploadCipfStorageFile({
      registrationId: '11111111-1111-4111-8111-111111111111',
      kind: 'medical_report',
      file: pdfFile('laudo.pdf'),
      createdBy: '22222222-2222-4222-8222-222222222222'
    });

    expect(id).toMatch(/[0-9a-f-]{36}/);
    expect(supabaseMock.fromStorage).toHaveBeenCalledWith('cipf-documents');
    expect(supabaseMock.upload).toHaveBeenCalledWith(expect.stringContaining('/medical_report/'), expect.any(File), expect.objectContaining({ upsert: false }));
    expect(supabaseMock.insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'medical_report', mime_type: 'application/pdf' }));
  });

  it('fails upload when Supabase is not configured', async () => {
    const { uploadCipfStorageFile } = await import('@/lib/storage-files');
    supabaseMock.assertSupabaseConfigured.mockImplementationOnce(() => {
      throw new Error('Supabase não configurado.');
    });

    await expect(
      uploadCipfStorageFile({
        registrationId: '11111111-1111-4111-8111-111111111111',
        kind: 'document',
        file: pdfFile()
      })
    ).rejects.toThrow('Supabase não configurado.');
  });

  it('creates a short signed URL', async () => {
    const { createCipfSignedUrl, SIGNED_URL_TTL_SECONDS } = await import('@/lib/storage-files');

    await expect(createCipfSignedUrl('file-id')).resolves.toBe('https://signed.test/file.pdf');
    expect(supabaseMock.createSignedUrl).toHaveBeenCalledWith('registrations/reg/document/file.pdf', SIGNED_URL_TTL_SECONDS);
  });

  it('removes uploaded object when metadata insert fails', async () => {
    const { uploadCipfStorageFile } = await import('@/lib/storage-files');
    supabaseMock.insert.mockResolvedValueOnce({ error: new Error('metadata failed') });

    await expect(
      uploadCipfStorageFile({
        registrationId: '11111111-1111-4111-8111-111111111111',
        kind: 'document',
        file: pdfFile()
      })
    ).rejects.toThrow('metadados');
    expect(supabaseMock.remove).toHaveBeenCalledWith([expect.stringContaining('/document/')]);
  });

  it('removes storage objects and metadata on rollback', async () => {
    const { cleanupStorageFiles } = await import('@/lib/storage-files');

    await cleanupStorageFiles(['file-id']);

    expect(supabaseMock.remove).toHaveBeenCalledWith(['registrations/reg/document/file.pdf']);
    expect(supabaseMock.delete).toHaveBeenCalled();
    expect(supabaseMock.in).toHaveBeenCalledWith('id', ['file-id']);
  });
});
