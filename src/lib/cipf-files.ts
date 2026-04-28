import { supabase } from '@/lib/supabase';

/**
 * Rehydrates file payloads stored as chunked Base64 in Supabase.
 * Falls back to the legacy inline `data` field when available.
 */
export async function loadCipfFileDataUri(fileId?: string, fallback = ''): Promise<string> {
  if (!fileId) return fallback;

  try {
    const { data: fileData, error: fileError } = await supabase
      .from('cipf_files')
      .select('data,total_chunks')
      .eq('id', fileId)
      .maybeSingle();

    if (fileError || !fileData) return fallback;
    if (fileData.data) return fileData.data;
    if (!fileData.total_chunks || fileData.total_chunks < 1) return fallback;

    const { data: chunks, error: chunkError } = await supabase
      .from('cipf_file_chunks')
      .select('chunk_index,data')
      .eq('file_id', fileId)
      .order('chunk_index', { ascending: true });

    if (chunkError || !chunks?.length) return fallback;
    return chunks.map((chunk) => chunk.data || '').join('');
  } catch (error) {
    console.error('Error loading CIPF file data:', error);
    return fallback;
  }
}

/**
 * Opens a URL or data-uri in a new tab and automatically revokes temporary `blob:` URLs.
 */
export function openInNewTab(dataUriOrUrl: string): void {
  if (!dataUriOrUrl) return;

  if (!dataUriOrUrl.startsWith('data:')) {
    window.open(dataUriOrUrl, '_blank');
    return;
  }

  const [meta, base64 = ''] = dataUriOrUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

