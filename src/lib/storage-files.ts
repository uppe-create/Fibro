import { getFileExtension, validateFileSecurity, type FileSecurityProfile } from '@/lib/file-security';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

export const CIPF_DOCUMENTS_BUCKET = 'cipf-documents';
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export type CipfStorageKind = 'document' | 'proof_of_residence' | 'medical_report' | 'photo';

const KIND_PROFILE: Record<CipfStorageKind, FileSecurityProfile> = {
  document: 'document',
  proof_of_residence: 'document',
  medical_report: 'document',
  photo: 'photo'
};

export type CipfStorageFile = {
  id: string;
  registration_id: string;
  kind: CipfStorageKind;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  original_name: string;
};

const safeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'arquivo';

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function buildCipfStoragePath(registrationId: string, kind: CipfStorageKind, file: File, fileId = crypto.randomUUID()): string {
  const extension = getFileExtension(file.name);
  return `registrations/${registrationId}/${kind}/${fileId}.${extension}`;
}

export async function uploadCipfStorageFile({
  registrationId,
  kind,
  file,
  createdBy,
  onProgress = () => undefined
}: {
  registrationId: string;
  kind: CipfStorageKind;
  file: File;
  createdBy?: string | null;
  onProgress?: (value: number) => void;
}): Promise<string> {
  assertSupabaseConfigured();
  await validateFileSecurity(file, KIND_PROFILE[kind]);

  const fileId = crypto.randomUUID();
  const storagePath = buildCipfStoragePath(registrationId, kind, file, fileId);
  const { error: uploadError } = await supabase.storage.from(CIPF_DOCUMENTS_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  });
  if (uploadError) throw new Error('Falha ao enviar arquivo privado.');
  onProgress(85);

  const { error: metadataError } = await supabase.from('cipf_storage_files').insert({
    id: fileId,
    registration_id: registrationId,
    kind,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    original_name: safeName(file.name),
    created_by: createdBy && isUuid(createdBy) ? createdBy : null
  });

  if (metadataError) {
    await supabase.storage.from(CIPF_DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error('Falha ao registrar metadados do arquivo.');
  }

  onProgress(100);
  return fileId;
}

export async function createCipfSignedUrl(fileId?: string | null, ttlSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
  if (!fileId) return '';
  assertSupabaseConfigured();

  const { data: fileRow, error: fileError } = await supabase
    .from('cipf_storage_files')
    .select('storage_path')
    .eq('id', fileId)
    .maybeSingle();

  if (fileError || !fileRow?.storage_path) return '';

  const { data, error } = await supabase.storage.from(CIPF_DOCUMENTS_BUCKET).createSignedUrl(fileRow.storage_path, ttlSeconds);
  if (error || !data?.signedUrl) throw new Error('Falha ao gerar acesso temporário ao arquivo.');
  return data.signedUrl;
}

export async function cleanupStorageFiles(ids: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return;

  const { data } = await supabase.from('cipf_storage_files').select('id,storage_path').in('id', uniqueIds);
  const paths = (data || []).map((item: { storage_path?: string }) => item.storage_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(CIPF_DOCUMENTS_BUCKET).remove(paths);
  await supabase.from('cipf_storage_files').delete().in('id', uniqueIds);
}

export function dataUriToFile(dataUri: string, name: string): File {
  const [meta, base64 = ''] = dataUri.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
