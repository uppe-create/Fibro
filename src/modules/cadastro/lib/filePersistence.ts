import { CHUNK_SIZE } from '@/lib/cadastro-utils';
import { supabase } from '@/lib/supabase';

export async function saveDataUriToDb(
  dataUri: string,
  type: string,
  name: string,
  onProgress: (value: number) => void
): Promise<string> {
  // Keep paired with loadCipfFileDataUri in src/lib/cipf-files.ts.
  const totalChunks = Math.ceil(dataUri.length / CHUNK_SIZE);
  const { data: fileRow, error: fileError } = await supabase
    .from('cipf_files')
    .insert({ type, name, total_chunks: totalChunks, created_at: new Date().toISOString() })
    .select('id')
    .single();

  if (fileError || !fileRow?.id) throw new Error(fileError?.message || 'Falha ao salvar arquivo no banco.');

  const chunks = Array.from({ length: totalChunks }, (_, index) => ({
    file_id: fileRow.id,
    chunk_index: index,
    data: dataUri.substring(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
  }));

  const batchSize = 12;
  let uploaded = 0;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const { error: chunkError } = await supabase.from('cipf_file_chunks').insert(batch);
    if (chunkError) throw chunkError;
    uploaded += batch.length;
    onProgress((uploaded / chunks.length) * 100);
  }

  return fileRow.id;
}

export async function cleanupOrphanFiles(ids: string[]) {
  if (!ids.length) return;
  const uniqueIds = Array.from(new Set(ids));
  await supabase.from('cipf_files').delete().in('id', uniqueIds);
}
