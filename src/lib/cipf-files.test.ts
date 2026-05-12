import { beforeEach, describe, expect, it, vi } from 'vitest';

const cipfFileMocks = vi.hoisted(() => ({
  createCipfSignedUrl: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn()
}));

vi.mock('@/lib/storage-files', () => ({
  createCipfSignedUrl: cipfFileMocks.createCipfSignedUrl
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: cipfFileMocks.from
  }
}));

const query = {
  select: cipfFileMocks.select,
  eq: cipfFileMocks.eq,
  maybeSingle: cipfFileMocks.maybeSingle,
  order: cipfFileMocks.order
};

describe('CIPF file loading', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(cipfFileMocks).forEach((mock) => mock.mockReset());
    cipfFileMocks.from.mockReturnValue(query);
    cipfFileMocks.select.mockReturnValue(query);
    cipfFileMocks.eq.mockReturnValue(query);
    cipfFileMocks.order.mockResolvedValue({ data: [{ data: 'data:app/' }, { data: 'pdf;base64,AA==' }], error: null });
  });

  it('prefers private Storage signed URL for new files', async () => {
    cipfFileMocks.createCipfSignedUrl.mockResolvedValueOnce('https://signed.test/private.pdf');
    const { loadCipfFileDataUri } = await import('@/lib/cipf-files');

    await expect(loadCipfFileDataUri('storage-id')).resolves.toBe('https://signed.test/private.pdf');
    expect(cipfFileMocks.from).not.toHaveBeenCalledWith('cipf_files');
  });

  it('keeps legacy Base64 chunk fallback', async () => {
    cipfFileMocks.createCipfSignedUrl.mockResolvedValueOnce('');
    cipfFileMocks.maybeSingle.mockResolvedValueOnce({ data: { total_chunks: 2 }, error: null });
    const { loadCipfFileDataUri } = await import('@/lib/cipf-files');

    await expect(loadCipfFileDataUri('legacy-id')).resolves.toBe('data:app/pdf;base64,AA==');
    expect(cipfFileMocks.from).toHaveBeenCalledWith('cipf_files');
    expect(cipfFileMocks.from).toHaveBeenCalledWith('cipf_file_chunks');
  });
});
