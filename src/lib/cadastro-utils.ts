import { z } from 'zod';
import { getAgeFromBRDate, parseBRDate } from '@/lib/date';
import { validateCPF } from '@/lib/utils';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const CHUNK_SIZE = 700000;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ACCEPTED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const CID_DEFAULT = 'M79.7';
export const DRAFT_STORAGE_KEY = 'cipf_registration_draft_v1';

export type UploadField = 'documentFile' | 'proofOfResidenceFile' | 'medicalReportFile' | 'photoFile';

export const INITIAL_UPLOAD_PROGRESS: Record<UploadField, number> = {
  documentFile: 0,
  proofOfResidenceFile: 0,
  medicalReportFile: 0,
  photoFile: 0
};

export const normalizeText = (value: string) => value.toUpperCase().replace(/\s+/g, ' ').trim();

export const normalizeLookupText = (value = '') =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const makeFileSchema = (label: string, acceptedTypes: string[]) =>
  z
    .any()
    .refine((files) => files && files.length === 1, `${label} e obrigatorio.`)
    .refine((files) => !files?.[0] || files[0].size <= MAX_FILE_SIZE, 'O arquivo deve ter no maximo 5MB')
    .refine(
      (files) => !files?.[0] || acceptedTypes.includes(files[0].type),
      `Formato invalido para ${label.toLowerCase()}.`
    );

// Main business-rules gate before any Supabase write. Keep user-facing
// validation messages here when adding mandatory fields.
export const cadastroSchema = z
  .object({
    fullName: z.string().min(3, 'Nome deve ter no minimo 3 caracteres').transform(normalizeText),
    cpf: z
      .string()
      .min(14, 'CPF invalido')
      .refine((value) => validateCPF(value), 'CPF invalido matematicamente'),
    cns: z
      .string()
      .optional()
      .transform((value) => (value ? value.replace(/\D/g, '') : ''))
      .refine((value) => !value || value.length === 15, 'Cartao SUS deve ter 15 digitos'),
    phone: z.string().min(14, 'Telefone invalido'),
    birthDate: z
      .string()
      .min(10, 'Data invalida')
      .refine((value) => {
        const date = parseBRDate(value);
        if (!date) return false;
        const now = new Date();
        const age = getAgeFromBRDate(value, now);
        return date <= now && age !== null && age >= 0 && age <= 120;
      }, 'Data de nascimento invalida (futura ou idade > 120 anos).'),
    legalGuardian: z.string().optional().transform((value) => (value ? normalizeText(value) : undefined)),
    cep: z.string().min(9, 'CEP invalido'),
    logradouro: z.string().min(3, 'Logradouro obrigatorio').transform(normalizeText),
    bairro: z.string().min(2, 'Bairro obrigatorio').transform(normalizeText),
    cidade: z.string().min(2, 'Cidade obrigatoria').transform(normalizeText),
    estado: z.string().length(2, 'Estado (UF) deve ter 2 letras').transform((value) => value.toUpperCase()),
    documentFile: makeFileSchema('Documento oficial', ACCEPTED_DOC_TYPES),
    proofOfResidenceFile: makeFileSchema('Comprovante de residencia', ACCEPTED_DOC_TYPES),
    proofOfResidenceDate: z
      .string()
      .min(10, 'Data do comprovante invalida')
      .refine((value) => {
        const date = parseBRDate(value);
        if (!date) return false;
        const now = new Date();
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setHours(0, 0, 0, 0);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return date <= now && date >= ninetyDaysAgo;
      }, 'O comprovante nao pode ter mais de 90 dias.'),
    medicalReportFile: makeFileSchema('Laudo medico', ACCEPTED_DOC_TYPES),
    medicalReportDate: z
      .string()
      .min(10, 'Data do laudo invalida')
      .refine((value) => {
        const date = parseBRDate(value);
        if (!date) return false;
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return date <= now && date >= sixMonthsAgo;
      }, 'O laudo nao pode ter mais de 6 meses de emissao.'),
    cid: z.string().min(3, 'CID obrigatorio').transform((value) => value.toUpperCase()),
    justificativaCid: z.string().optional(),
    crm: z.string().min(4, 'CRM invalido'),
    photoFile: makeFileSchema('Foto', ACCEPTED_IMAGE_TYPES)
  })
  .superRefine((data, ctx) => {
    if (data.cid !== CID_DEFAULT && (!data.justificativaCid || data.justificativaCid.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Justificativa medica e obrigatoria e deve ter pelo menos 10 caracteres quando o CID nao for M79.7',
        path: ['justificativaCid']
      });
    }

    const age = getAgeFromBRDate(data.birthDate);
    if (age !== null && age < 18 && (!data.legalGuardian || data.legalGuardian.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nome do responsavel legal e obrigatorio para menores de 18 anos',
        path: ['legalGuardian']
      });
    }
  });

export type FormData = z.infer<typeof cadastroSchema>;

export const formatFileSize = (size = 0) => `${(size / 1024 / 1024).toFixed(2)} MB`;

export async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
  });
}

export async function cropImageTo3x4DataUri(file: File): Promise<string> {
  const imageDataUri = await fileToDataUri(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetRatio = 3 / 4;
      const sourceRatio = img.width / img.height;
      let cropWidth = img.width;
      let cropHeight = img.height;
      let offsetX = 0;
      let offsetY = 0;

      if (sourceRatio > targetRatio) {
        cropWidth = img.height * targetRatio;
        offsetX = (img.width - cropWidth) / 2;
      } else {
        cropHeight = img.width / targetRatio;
        offsetY = (img.height - cropHeight) / 2;
      }

      canvas.width = 300;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Falha ao processar foto.'));
      ctx.drawImage(img, offsetX, offsetY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => reject(new Error('Falha ao carregar foto.'));
    img.src = imageDataUri;
  });
}

export async function generateChecksum(data: string): Promise<string> {
  if (!crypto?.subtle) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
