export type FileSecurityProfile = 'publicQr' | 'document' | 'photo';

export class FileSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileSecurityError';
  }
}

export const FILE_SECURITY_PROFILES: Record<
  FileSecurityProfile,
  {
    maxBytes: number;
    extensions: string[];
    mimeTypes: string[];
    signatures: Array<'pdf' | 'png' | 'jpeg' | 'webp'>;
  }
> = {
  publicQr: {
    maxBytes: 8 * 1024 * 1024,
    extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
    mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    signatures: ['pdf', 'png', 'jpeg', 'webp']
  },
  document: {
    maxBytes: 5 * 1024 * 1024,
    extensions: ['pdf', 'png', 'jpg', 'jpeg'],
    mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
    signatures: ['pdf', 'png', 'jpeg']
  },
  photo: {
    maxBytes: 5 * 1024 * 1024,
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    signatures: ['png', 'jpeg', 'webp']
  }
};

const EXTENSION_TO_SIGNATURE: Record<string, 'pdf' | 'png' | 'jpeg' | 'webp'> = {
  pdf: 'pdf',
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp'
};

export function getFileExtension(name = '') {
  const extension = name.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}

export function detectFileSignature(bytes: Uint8Array): 'pdf' | 'png' | 'jpeg' | 'webp' | 'unknown' {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return 'unknown';
}

export function validateFileMetadata(file: File, profile: FileSecurityProfile): void {
  const config = FILE_SECURITY_PROFILES[profile];
  if (!file) throw new FileSecurityError('Arquivo obrigatório.');
  if (file.size <= 0) throw new FileSecurityError('Arquivo vazio ou inválido.');
  if (file.size > config.maxBytes) throw new FileSecurityError(`Arquivo maior que ${Math.floor(config.maxBytes / 1024 / 1024)} MB.`);

  const extension = getFileExtension(file.name);
  if (!config.extensions.includes(extension)) throw new FileSecurityError('Formato de arquivo não permitido.');

  if (!config.mimeTypes.includes(String(file.type || '').toLowerCase())) throw new FileSecurityError('Tipo de arquivo não permitido.');
}

export async function validateFileSecurity(file: File, profile: FileSecurityProfile): Promise<void> {
  validateFileMetadata(file, profile);

  const config = FILE_SECURITY_PROFILES[profile];
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const signature = detectFileSignature(header);
  const extensionSignature = EXTENSION_TO_SIGNATURE[getFileExtension(file.name)];

  if (signature === 'unknown' || !config.signatures.includes(signature)) throw new FileSecurityError('Assinatura do arquivo não permitida.');
  if (extensionSignature && extensionSignature !== signature) throw new FileSecurityError('Extensão não confere com o conteúdo do arquivo.');
}

export function getSafeFileSecurityMessage(error: unknown) {
  if (error instanceof FileSecurityError) return error.message;
  return 'Arquivo inválido. Verifique o formato e tente novamente.';
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new FileSecurityError(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  });
}
