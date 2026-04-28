import React, { useEffect, useMemo, useState } from 'react';
import { useForm, type FieldError, type UseFormRegister } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { formatCNS, formatCPF, formatDate, formatPhone, validateCPF } from '@/lib/utils';
import { getAgeFromBRDate, parseBRDate } from '@/lib/date';
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X, File as FileIcon, Eye } from 'lucide-react';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { hasPermission } from '@/lib/permissions';
import { isCpfBlockedByStatus } from '@/lib/registration-status';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CHUNK_SIZE = 700000;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const CID_DEFAULT = 'M79.7';
const DRAFT_STORAGE_KEY = 'cipf_registration_draft_v1';

type UploadField = 'documentFile' | 'proofOfResidenceFile' | 'medicalReportFile' | 'photoFile';

const INITIAL_UPLOAD_PROGRESS: Record<UploadField, number> = {
  documentFile: 0,
  proofOfResidenceFile: 0,
  medicalReportFile: 0,
  photoFile: 0
};

const normalizeText = (value: string) => value.toUpperCase().replace(/\s+/g, ' ').trim();
const normalizeLookupText = (value = '') =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

// Shared validation for required uploads. Uploaded files are converted to
// Base64 and stored in Supabase chunks to avoid oversized single-row payloads.
const makeFileSchema = (label: string, acceptedTypes: string[]) =>
  z
    .any()
    .refine((files) => files && files.length === 1, `${label} é obrigatório.`)
    .refine((files) => !files?.[0] || files[0].size <= MAX_FILE_SIZE, 'O arquivo deve ter no máximo 5MB')
    .refine(
      (files) => !files?.[0] || acceptedTypes.includes(files[0].type),
      `Formato inválido para ${label.toLowerCase()}.`
    );

// Main business-rules gate before any Supabase write. Keep user-facing
// validation messages here when adding mandatory fields.
const schema = z
  .object({
    fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').transform(normalizeText),
    cpf: z
      .string()
      .min(14, 'CPF inválido')
      .refine((value) => validateCPF(value), 'CPF inválido matematicamente'),
    cns: z
      .string()
      .optional()
      .transform((value) => (value ? value.replace(/\D/g, '') : ''))
      .refine((value) => !value || value.length === 15, 'Cartao SUS deve ter 15 digitos'),
    phone: z.string().min(14, 'Telefone inválido'),
    birthDate: z
      .string()
      .min(10, 'Data inválida')
      .refine((value) => {
        const date = parseBRDate(value);
        if (!date) return false;
        const now = new Date();
        const age = getAgeFromBRDate(value, now);
        return date <= now && age !== null && age >= 0 && age <= 120;
      }, 'Data de nascimento inválida (futura ou idade > 120 anos).'),
    legalGuardian: z.string().optional().transform((value) => (value ? normalizeText(value) : undefined)),
    cep: z.string().min(9, 'CEP inválido'),
    logradouro: z.string().min(3, 'Logradouro obrigatório').transform(normalizeText),
    bairro: z.string().min(2, 'Bairro obrigatório').transform(normalizeText),
    cidade: z.string().min(2, 'Cidade obrigatória').transform(normalizeText),
    estado: z.string().length(2, 'Estado (UF) deve ter 2 letras').transform((value) => value.toUpperCase()),
    documentFile: makeFileSchema('Documento oficial', ACCEPTED_DOC_TYPES),
    proofOfResidenceFile: makeFileSchema('Comprovante de residência', ACCEPTED_DOC_TYPES),
    proofOfResidenceDate: z
      .string()
      .min(10, 'Data do comprovante inválida')
      .refine((value) => {
        const date = parseBRDate(value);
        if (!date) return false;
        const now = new Date();
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setHours(0, 0, 0, 0);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return date <= now && date >= ninetyDaysAgo;
      }, 'O comprovante não pode ter mais de 90 dias.'),
    medicalReportFile: makeFileSchema('Laudo médico', ACCEPTED_DOC_TYPES),
    medicalReportDate: z
      .string()
      .min(10, 'Data do laudo inválida')
      .refine((value) => {
        const date = parseBRDate(value);
        if (!date) return false;
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return date <= now && date >= sixMonthsAgo;
      }, 'O laudo não pode ter mais de 6 meses de emissão.'),
    cid: z.string().min(3, 'CID obrigatório').transform((value) => value.toUpperCase()),
    justificativaCid: z.string().optional(),
    crm: z.string().min(4, 'CRM inválido'),
    photoFile: makeFileSchema('Foto', ACCEPTED_IMAGE_TYPES)
  })
  .superRefine((data, ctx) => {
    if (data.cid !== CID_DEFAULT && (!data.justificativaCid || data.justificativaCid.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Justificativa médica é obrigatória e deve ter pelo menos 10 caracteres quando o CID não for M79.7',
        path: ['justificativaCid']
      });
    }

    const age = getAgeFromBRDate(data.birthDate);
    if (age !== null && age < 18 && (!data.legalGuardian || data.legalGuardian.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nome do responsável legal é obrigatório para menores de 18 anos',
        path: ['legalGuardian']
      });
    }
  });

type FormData = z.infer<typeof schema>;

type FileUploadFieldProps = {
  id: string;
  label: string;
  accept: string;
  error?: FieldError;
  fileValue: FileList | null | undefined;
  fieldName: keyof FormData;
  register: UseFormRegister<FormData>;
  onRemove: (fieldName: keyof FormData) => void;
  progress: number;
  isSubmitting: boolean;
};

const formatFileSize = (size = 0) => `${(size / 1024 / 1024).toFixed(2)} MB`;

function FileUploadField({
  id,
  label,
  accept,
  error,
  fileValue,
  fieldName,
  register,
  onRemove,
  progress,
  isSubmitting
}: FileUploadFieldProps) {
  const file = fileValue?.[0];
  const hasFile = Boolean(file);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const isImage = Boolean(file?.type?.startsWith('image/'));
  const canPreview = hasFile && Boolean(previewUrl);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between ml-1">
        <Label htmlFor={id} className="text-[#5E6B7A]">
          {label}
        </Label>
        {hasFile && (
          <span className="flex items-center text-xs text-green-700 font-medium animate-in fade-in slide-in-from-right-2">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Selecionado
          </span>
        )}
      </div>

      <div className="relative group">
        {!hasFile ? (
          <>
            <Input
              id={id}
              type="file"
              accept={accept}
              {...register(fieldName)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 transition-all group-hover:border-blue-300 group-hover:bg-blue-50/30 h-24">
              <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600 transition-colors">
                Clique para anexar arquivo
              </span>
            </div>
          </>
        ) : (
          <div className="rounded-xl border-2 border-green-200 bg-green-50/40 p-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg shrink-0">
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-green-900 truncate max-w-[170px] sm:max-w-[240px]">{file?.name}</p>
                  <p className="text-[10px] text-green-700 font-medium uppercase tracking-wider">{formatFileSize(file?.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                    className="h-8 w-8 rounded-full text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                    title="Pré-visualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(fieldName)}
                  className="h-8 w-8 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isImage && previewUrl && (
              <div className="mt-3 rounded-lg overflow-hidden border border-green-200 bg-white max-h-36">
                <img src={previewUrl} alt={`Prévia ${label}`} className="w-full h-36 object-cover" />
              </div>
            )}

            {isSubmitting && (
              <div className="mt-3">
                <div className="h-2 rounded-full bg-green-100 overflow-hidden">
                  <div
                    className="h-2 bg-green-600 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-semibold text-green-700 uppercase tracking-wider">
                  Upload: {Math.round(progress)}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 ml-1">{error.message}</p>}
    </div>
  );
}

function maskCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**');
}

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
  });
}

async function cropImageTo3x4DataUri(file: File): Promise<string> {
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

async function generateChecksum(data: string): Promise<string> {
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

export function Cadastro() {
  const [registeredData, setRegisteredData] = useState<{ fullName: string; cpf: string; cns?: string } | null>(null);
  const [uploadStep, setUploadStep] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(INITIAL_UPLOAD_PROGRESS);
  const [currentStep, setCurrentStep] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const { currentUser, registrations, fetchRegistrations } = useAppStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
    trigger
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange'
  });

  const formValues = watch();
  const cpfValue = watch('cpf');
  const cnsValue = watch('cns');
  const birthDateValue = watch('birthDate');
  const cidValue = watch('cid');
  const documentFileValue = watch('documentFile');
  const proofOfResidenceFileValue = watch('proofOfResidenceFile');
  const medicalReportFileValue = watch('medicalReportFile');
  const photoFileValue = watch('photoFile');

  const overallUploadProgress = useMemo(() => {
    const total = (Object.values(uploadProgress) as number[]).reduce((sum, value) => sum + value, 0);
    return Math.round(total / 4);
  }, [uploadProgress]);

  const steps: Array<{ title: string; description: string; fields: Array<keyof FormData> }> = [
    {
      title: 'Dados pessoais',
      description: 'Identificacao e contato do titular.',
      fields: ['fullName', 'cpf', 'cns', 'phone', 'birthDate', 'legalGuardian']
    },
    {
      title: 'Endereco',
      description: 'Residencia do beneficiario.',
      fields: ['cep', 'logradouro', 'bairro', 'cidade', 'estado']
    },
    {
      title: 'Dados medicos',
      description: 'Laudo, CID e CRM.',
      fields: ['medicalReportFile', 'medicalReportDate', 'cid', 'justificativaCid', 'crm']
    },
    {
      title: 'Documentos',
      description: 'Identificacao, residencia e foto.',
      fields: ['documentFile', 'proofOfResidenceFile', 'proofOfResidenceDate', 'photoFile']
    },
    {
      title: 'Revisao',
      description: 'Confira antes de salvar.',
      fields: []
    }
  ];

  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);
  const isReviewStep = currentStep === steps.length - 1;

  useEffect(() => {
    if (hasPermission(currentUser, 'viewDashboard')) {
      fetchRegistrations().catch(() => null);
    }
  }, [currentUser, fetchRegistrations]);

  useEffect(() => {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) return;
    try {
      const parsed = JSON.parse(rawDraft) as Partial<Record<keyof FormData, string>>;
      reset(parsed as Partial<FormData>);
      setDraftRestored(true);
      setDraftSavedAt(Date.now());
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [reset]);

  useEffect(() => {
    if (registeredData) return;
    const draft = {
      fullName: formValues.fullName || '',
      cpf: formValues.cpf || '',
      cns: formValues.cns || '',
      phone: formValues.phone || '',
      birthDate: formValues.birthDate || '',
      legalGuardian: formValues.legalGuardian || '',
      cep: formValues.cep || '',
      logradouro: formValues.logradouro || '',
      bairro: formValues.bairro || '',
      cidade: formValues.cidade || '',
      estado: formValues.estado || '',
      proofOfResidenceDate: formValues.proofOfResidenceDate || '',
      medicalReportDate: formValues.medicalReportDate || '',
      cid: formValues.cid || '',
      justificativaCid: formValues.justificativaCid || '',
      crm: formValues.crm || ''
    };
    const hasDraftContent = Object.values(draft).some((value) => String(value || '').trim());
    if (!hasDraftContent) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftSavedAt(Date.now());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [formValues, registeredData]);

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraftSavedAt(null);
    setDraftRestored(false);
    reset();
    resetUploadProgress();
    setCurrentStep(0);
  };

  const possibleDuplicates = useMemo(() => {
    const name = normalizeLookupText(formValues.fullName || '');
    const cpfDigits = String(formValues.cpf || '').replace(/\D/g, '');
    if (name.length < 8 || !formValues.birthDate) return [];
    return registrations
      .filter((reg) => {
        const sameBirth = reg.birthDate === formValues.birthDate;
        const differentCpf = cpfDigits && reg.cpf !== cpfDigits;
        const regName = normalizeLookupText(reg.fullName);
        const nameLooksSimilar = regName.includes(name) || name.includes(regName) || regName.split(' ')[0] === name.split(' ')[0];
        return sameBirth && differentCpf && nameLooksSimilar;
      })
      .slice(0, 3);
  }, [registrations, formValues.fullName, formValues.birthDate, formValues.cpf]);

  const isMinor = () => {
    if (!birthDateValue || birthDateValue.length < 10) return false;
    const age = getAgeFromBRDate(birthDateValue);
    return age !== null && age < 18;
  };

  const reviewWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (possibleDuplicates.length) warnings.push(`Possivel duplicidade: ${possibleDuplicates.map((reg) => reg.fullName).join(', ')}`);
    if ((formValues.cid || '').toUpperCase() !== CID_DEFAULT) warnings.push('CID diferente de M79.7 exige justificativa medica consistente.');
    if (isMinor()) warnings.push('Titular menor de idade: confira responsavel legal e documento.');
    if (!formValues.cns) warnings.push('Cartao SUS nao informado. O campo e opcional, mas confira se a Secretaria deseja registrar.');
    if (!documentFileValue?.[0] || !proofOfResidenceFileValue?.[0] || !medicalReportFileValue?.[0] || !photoFileValue?.[0]) {
      warnings.push('Confira todos os anexos. Rascunhos recuperam campos de texto, mas nao recuperam arquivos selecionados.');
    }
    return warnings;
  }, [possibleDuplicates, formValues.cid, formValues.cns, documentFileValue, proofOfResidenceFileValue, medicalReportFileValue, photoFileValue, birthDateValue]);

  const goToNextStep = async () => {
    const fields = steps[currentStep].fields;
    const isStepValid = fields.length === 0 || (await trigger(fields, { shouldFocus: true }));
    if (!isStepValid) return;
    setSubmitError('');
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    setSubmitError('');
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const reviewItems = [
    ['Nome', formValues.fullName || '-'],
    ['CPF', formValues.cpf || '-'],
    ['Cartao SUS', formValues.cns || 'Nao informado'],
    ['Nascimento', formValues.birthDate || '-'],
    ['Telefone', formValues.phone || '-'],
    ['Endereco', [formValues.logradouro, formValues.bairro, formValues.cidade, formValues.estado].filter(Boolean).join(', ') || '-'],
    ['CID', formValues.cid || '-'],
    ['CRM', formValues.crm || '-'],
    ['Data do laudo', formValues.medicalReportDate || '-'],
    ['Data do comprovante', formValues.proofOfResidenceDate || '-'],
    ['Documento oficial', documentFileValue?.[0]?.name || 'Nao anexado'],
    ['Comprovante', proofOfResidenceFileValue?.[0]?.name || 'Nao anexado'],
    ['Laudo medico', medicalReportFileValue?.[0]?.name || 'Nao anexado'],
    ['Foto', photoFileValue?.[0]?.name || 'Nao anexada']
  ];

  const resetUploadProgress = () => setUploadProgress(INITIAL_UPLOAD_PROGRESS);
  const updateUploadProgress = (field: UploadField, value: number) => {
    setUploadProgress((prev) => ({ ...prev, [field]: Math.max(0, Math.min(100, value)) }));
  };

  const handleRemoveFile = (fieldName: keyof FormData) => {
    setValue(fieldName, null, { shouldValidate: true });
    if (fieldName in INITIAL_UPLOAD_PROGRESS) updateUploadProgress(fieldName as UploadField, 0);
  };

  const handleCepBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    const cep = event.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data?.erro) return;
      setValue('logradouro', normalizeText(data.logradouro || ''), { shouldValidate: true });
      setValue('bairro', normalizeText(data.bairro || ''), { shouldValidate: true });
      setValue('cidade', normalizeText(data.localidade || ''), { shouldValidate: true });
      setValue('estado', String(data.uf || '').toUpperCase(), { shouldValidate: true });
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const saveDataUriToDb = async (
    dataUri: string,
    type: string,
    name: string,
    onProgress: (value: number) => void
  ): Promise<string> => {
    // Pair this with loadCipfFileDataUri in src/lib/cipf-files.ts. If chunk size
    // changes here, old files still load because chunks are ordered by index.
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
  };

  const cleanupOrphanFiles = async (ids: string[]) => {
    if (!ids.length) return;
    const uniqueIds = Array.from(new Set(ids));
    const { error } = await supabase.from('cipf_files').delete().in('id', uniqueIds);
    if (error) console.error('Falha ao limpar arquivos órfãos:', error.message);
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) {
      setSubmitError('Usuário não autenticado. Faça login novamente.');
      return;
    }
    if (!hasPermission(currentUser, 'createRegistration')) {
      setSubmitError('Seu perfil nao permite criar novas carteirinhas.');
      return;
    }

    setSubmitError('');
    resetUploadProgress();
    const uploadedFileIds: string[] = [];

    try {
      assertSupabaseConfigured();
      const cpfClean = data.cpf.replace(/\D/g, '');
      const cnsClean = data.cns?.replace(/\D/g, '') || '';
      setUploadStep('Validando regras de negócio...');

      // CPF uniqueness is enforced by registration_index. The final index
      // insert still catches concurrent submissions that pass this pre-check.
      const { data: existingIndex, error: indexLookupError } = await supabase
        .from('registration_index')
        .select('cpf,status')
        .eq('cpf', cpfClean)
        .maybeSingle();
      if (indexLookupError) throw indexLookupError;
      if (existingIndex?.status && isCpfBlockedByStatus(existingIndex.status)) throw new Error('CPF_DUPLICATE_ACTIVE');
      const shouldReuseCancelledCpf = Boolean(existingIndex?.status && !isCpfBlockedByStatus(existingIndex.status));

      setUploadStep('Upload do documento oficial...');
      const documentDataUri = await fileToDataUri(data.documentFile[0]);
      const documentFileId = await saveDataUriToDb(documentDataUri, 'document', data.documentFile[0].name, (value) =>
        updateUploadProgress('documentFile', value)
      );
      uploadedFileIds.push(documentFileId);

      setUploadStep('Upload do comprovante de residência...');
      const proofDataUri = await fileToDataUri(data.proofOfResidenceFile[0]);
      const proofOfResidenceFileId = await saveDataUriToDb(proofDataUri, 'proofOfResidence', data.proofOfResidenceFile[0].name, (value) =>
        updateUploadProgress('proofOfResidenceFile', value)
      );
      uploadedFileIds.push(proofOfResidenceFileId);

      setUploadStep('Upload do laudo médico...');
      const reportDataUri = await fileToDataUri(data.medicalReportFile[0]);
      const medicalReportFileId = await saveDataUriToDb(reportDataUri, 'medicalReport', data.medicalReportFile[0].name, (value) =>
        updateUploadProgress('medicalReportFile', value)
      );
      uploadedFileIds.push(medicalReportFileId);

      setUploadStep('Processando e enviando foto 3x4...');
      const croppedPhotoDataUri = await cropImageTo3x4DataUri(data.photoFile[0]);
      const photoFileId = await saveDataUriToDb(croppedPhotoDataUri, 'photo', 'photo.jpg', (value) =>
        updateUploadProgress('photoFile', value)
      );
      uploadedFileIds.push(photoFileId);

      setUploadStep('Gerando registro e checksum...');
      const issueDate = new Date();
      const expiryDate = new Date(issueDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);
      const issueDateStr = issueDate.toLocaleDateString('pt-BR');
      const expiryDateStr = expiryDate.toLocaleDateString('pt-BR');
      const visualSignature = Math.random().toString(36).slice(2, 8).toUpperCase();
      const checksum = await generateChecksum(`${cpfClean}|${data.fullName}|${data.birthDate}|${issueDateStr}|${visualSignature}`);
      const registrationId = crypto.randomUUID();

      // Write order matters: private registration, CPF index, then the minimal
      // public row used by QR Code validation.
      setUploadStep('Gravando cadastro no banco...');
      const { error: registrationError } = await supabase.from('registrations').insert({
        id: registrationId,
        fullName: data.fullName,
        cpf: cpfClean,
        cns: cnsClean || null,
        phone: data.phone.replace(/\D/g, ''),
        birthDate: data.birthDate,
        legalGuardian: data.legalGuardian || null,
        cep: data.cep.replace(/\D/g, ''),
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        documentFileId,
        proofOfResidenceFileId,
        proofOfResidenceDate: data.proofOfResidenceDate,
        medicalReportFileId,
        medicalReportDate: data.medicalReportDate,
        cid: data.cid,
        justificativaCid: data.justificativaCid || null,
        crm: data.crm,
        photoFileId,
        issueDate: issueDateStr,
        expiryDate: expiryDateStr,
        status: 'under_review',
        visualSignature,
        checksum,
        userId: currentUser.id
      });
      if (registrationError) throw registrationError;

      if (shouldReuseCancelledCpf) {
        const { error: deleteOldIndexError } = await supabase.from('registration_index').delete().eq('cpf', cpfClean);
        if (deleteOldIndexError) throw deleteOldIndexError;
      }

      const { error: registrationIndexError } = await supabase.from('registration_index').insert({
        cpf: cpfClean,
        registration_id: registrationId,
        status: 'under_review',
        updated_at: new Date().toISOString()
      });
      if (registrationIndexError) {
        await supabase.from('registrations').delete().eq('id', registrationId);
        if ((registrationIndexError as any)?.code === '23505') throw new Error('CPF_DUPLICATE_ACTIVE');
        throw registrationIndexError;
      }

      const { error: publicValidationError } = await supabase.from('public_validations').upsert({
        id: registrationId,
        fullName: data.fullName,
        cpfMasked: maskCpf(cpfClean),
        issueDate: issueDateStr,
        expiryDate: expiryDateStr,
        status: 'under_review',
        visualSignature,
        checksum
      });
      if (publicValidationError) throw publicValidationError;

      await logAuditEvent({
        action: 'Cadastro Enviado para Analise',
        registrationId,
        userId: currentUser.id,
        userName: currentUser.name,
        reason: `cid=${data.cid}; bairro=${data.bairro}; cns=${cnsClean ? 'informado' : 'nao-informado'}; origem=modulo-cadastro`
      });

      setUploadStep('Cadastro finalizado com sucesso.');
      setRegisteredData({ fullName: data.fullName, cpf: data.cpf, cns: cnsClean ? formatCNS(cnsClean) : undefined });
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftSavedAt(null);
      setDraftRestored(false);
      reset();
      setCurrentStep(0);
      resetUploadProgress();
      await useAppStore.getState().fetchRegistrations();
    } catch (error: any) {
      console.error(error);
      setUploadStep('');
      await cleanupOrphanFiles(uploadedFileIds);
      if (error?.message === 'CPF_DUPLICATE_ACTIVE') {
        setSubmitError('CPF ja possui cadastro em andamento ou carteirinha existente. Use renovacao, segunda via ou cancelamento operacional.');
        return;
      }
      if (error?.code === 'PGRST205' || String(error?.message || '').includes('schema cache')) {
        setSubmitError('Supabase sem schema pronto para o app. Rode o arquivo supabase-schema.sql no SQL Editor.');
        return;
      }
      setSubmitError(`Erro ao enviar formulário: ${error?.message || 'erro desconhecido'}`);
    }
  };

  if (registeredData) {
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden p-10 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight mb-2">Cadastro Realizado com Sucesso!</h2>
          <p className="text-[#5E6B7A] mb-8">
            A solicitação da Carteirinha de Fibromialgia foi registrada e enviada para análise.
          </p>
          <div className="bg-gray-50/50 rounded-2xl p-6 text-left mb-8 border border-gray-100/50">
            <h3 className="text-sm font-semibold text-[#5E6B7A] uppercase tracking-wider mb-4">Detalhes do Registro</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#5E6B7A]">Titular</p>
                <p className="font-medium text-[#1D1D1F]">{registeredData.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-[#5E6B7A]">CPF</p>
                <p className="font-medium text-[#1D1D1F]">{registeredData.cpf}</p>
              </div>
              {registeredData.cns && (
                <div>
                  <p className="text-xs text-[#5E6B7A]">Cartao SUS</p>
                  <p className="font-medium text-[#1D1D1F]">{registeredData.cns}</p>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <p className="text-sm text-[#1D1D1F]">
              <strong className="font-semibold">Próximos passos:</strong> um atendente ou administrador deve aprovar o cadastro.
              Apenas o administrador poderá emitir e imprimir a carteirinha depois da aprovação.
            </p>
            <Button
              onClick={() => setRegisteredData(null)}
              className="w-full sm:w-auto rounded-xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Cadastrar Novo Beneficiário
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-10">
        <h2 className="text-3xl font-semibold text-[#163B66] tracking-tight">Nova Emissão de CIPF</h2>
        <p className="text-[#5E6B7A] mt-2 text-lg">
          Preencha os dados para solicitar a Carteira de Identificação da Pessoa com Fibromialgia.
        </p>
        {(draftSavedAt || draftRestored) && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">{draftRestored ? 'Rascunho recuperado automaticamente' : 'Rascunho salvo automaticamente'}</p>
              <p className="mt-1">
                Campos de texto ficam salvos neste computador. Por segurança do navegador, arquivos anexados precisam ser selecionados novamente.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={discardDraft} className="h-10 shrink-0 border-amber-300 bg-white">
              Descartar rascunho
            </Button>
          </div>
        )}
      </div>
      <div className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/30 overflow-hidden">
        <div className="p-6 sm:p-8 md:p-12">
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#17324d]">
                Etapa {currentStep + 1} de {steps.length}: {steps[currentStep].title}
              </span>
              <span className="font-semibold text-[#617184]">{progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e3e9ef]">
              <div className="h-2 rounded-full bg-[#1f8a58] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => index < currentStep && setCurrentStep(index)}
                  className={`border px-3 py-2 text-left ${
                    index === currentStep
                      ? 'border-[#155c9c] bg-[#eaf3fb] text-[#17324d]'
                      : index < currentStep
                        ? 'border-[#b9d7c7] bg-[#edf7f1] text-[#166534]'
                        : 'border-[#d9e1ea] bg-white text-[#617184]'
                  }`}
                >
                  <span className="block text-xs font-black uppercase tracking-wide">{step.title}</span>
                  <span className="hidden text-[11px] sm:block">{step.description}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className={`cadastro-wizard step-${currentStep} space-y-12`}>
            <div className="wizard-section wizard-step-0 grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/60">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Identificação do Titular</h3>
                <p className="mt-2 text-sm text-[#5E6B7A] leading-relaxed">Informações pessoais e contato do beneficiário.</p>
              </div>
              <div className="md:col-span-2 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName" className="text-[#5E6B7A] ml-1">Nome Completo</Label>
                  <Input id="fullName" {...register('fullName')} placeholder="Ex: MARIA DA SILVA" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                  {errors.fullName && <p className="text-sm text-red-500 ml-1">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-[#5E6B7A] ml-1">CPF</Label>
                  <div className="relative">
                    <Input
                      id="cpf"
                      {...register('cpf')}
                      onChange={(event) => {
                        const value = formatCPF(event.target.value);
                        event.target.value = value;
                        setValue('cpf', value, { shouldValidate: true });
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className={`rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12 ${cpfValue?.length === 14 && !errors.cpf ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
                    />
                    {cpfValue?.length === 14 && !errors.cpf && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                  {errors.cpf && <p className="text-sm text-red-500 ml-1">{errors.cpf.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cns" className="text-[#5E6B7A] ml-1">Cartao SUS</Label>
                  <div className="relative">
                    <Input
                      id="cns"
                      {...register('cns')}
                      onChange={(event) => {
                        const value = formatCNS(event.target.value);
                        event.target.value = value;
                        setValue('cns', value, { shouldValidate: true });
                      }}
                      placeholder="000 0000 0000 0000"
                      maxLength={18}
                      className={`rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12 ${cnsValue?.replace(/\D/g, '').length === 15 && !errors.cns ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
                    />
                    {cnsValue?.replace(/\D/g, '').length === 15 && !errors.cns && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                  {errors.cns && <p className="text-sm text-red-500 ml-1">{errors.cns.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[#5E6B7A] ml-1">Telefone</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    onChange={(event) => {
                      const value = formatPhone(event.target.value);
                      event.target.value = value;
                      setValue('phone', value, { shouldValidate: true });
                    }}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12"
                  />
                  {errors.phone && <p className="text-sm text-red-500 ml-1">{errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="text-[#5E6B7A] ml-1">Data de Nascimento</Label>
                  <div className="relative">
                    <Input
                      id="birthDate"
                      {...register('birthDate')}
                      onChange={(event) => {
                        const value = formatDate(event.target.value);
                        event.target.value = value;
                        setValue('birthDate', value, { shouldValidate: true });
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className={`rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12 ${birthDateValue?.length === 10 && !errors.birthDate ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
                    />
                    {birthDateValue?.length === 10 && !errors.birthDate && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                  {errors.birthDate && <p className="text-sm text-red-500 ml-1">{errors.birthDate.message}</p>}
                </div>
                {isMinor() && (
                  <div className="space-y-2 sm:col-span-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="legalGuardian" className="text-[#5E6B7A] ml-1">Nome do Responsável Legal (obrigatório para menores de 18 anos)</Label>
                    <Input id="legalGuardian" {...register('legalGuardian')} placeholder="Ex: JOÃO DA SILVA" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                    {errors.legalGuardian && <p className="text-sm text-red-500 ml-1">{errors.legalGuardian.message}</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="wizard-section wizard-step-1 grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/60">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Endereço</h3>
                <p className="mt-2 text-sm text-[#5E6B7A] leading-relaxed">Endereço de residência do beneficiário.</p>
              </div>
              <div className="md:col-span-2 grid gap-5 sm:grid-cols-4">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="cep" className="text-[#5E6B7A] ml-1">CEP</Label>
                  <Input
                    id="cep"
                    {...register('cep')}
                    onBlur={handleCepBlur}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
                      event.target.value = value;
                      setValue('cep', value, { shouldValidate: true });
                    }}
                    placeholder="00000-000"
                    className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12"
                  />
                  {errors.cep && <p className="text-sm text-red-500 ml-1">{errors.cep.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor="logradouro" className="text-[#5E6B7A] ml-1">Logradouro</Label>
                  <Input id="logradouro" {...register('logradouro')} placeholder="Rua, avenida, etc." className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                  {errors.logradouro && <p className="text-sm text-red-500 ml-1">{errors.logradouro.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bairro" className="text-[#5E6B7A] ml-1">Bairro</Label>
                  <Input id="bairro" {...register('bairro')} placeholder="Bairro" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                  {errors.bairro && <p className="text-sm text-red-500 ml-1">{errors.bairro.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="cidade" className="text-[#5E6B7A] ml-1">Cidade</Label>
                  <Input id="cidade" {...register('cidade')} placeholder="Cidade" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                  {errors.cidade && <p className="text-sm text-red-500 ml-1">{errors.cidade.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="estado" className="text-[#5E6B7A] ml-1">UF</Label>
                  <Input id="estado" {...register('estado')} placeholder="SP" maxLength={2} className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                  {errors.estado && <p className="text-sm text-red-500 ml-1">{errors.estado.message}</p>}
                </div>
              </div>
            </div>

            <div className="wizard-section wizard-step-3 grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/60">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Documentação</h3>
                <p className="mt-2 text-sm text-[#5E6B7A] leading-relaxed">Anexe os documentos de identificação e residência.</p>
              </div>
              <div className="md:col-span-2 grid gap-6 sm:grid-cols-2">
                <FileUploadField id="documentFile" label="Documento Oficial com Foto e CPF (PDF/JPG/PNG até 5MB)" accept=".pdf,image/*" error={errors.documentFile as FieldError | undefined} fileValue={documentFileValue as FileList | null} fieldName="documentFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.documentFile} isSubmitting={isSubmitting} />
                <FileUploadField id="proofOfResidenceFile" label="Comprovante de Residência (PDF/JPG/PNG até 5MB)" accept=".pdf,image/*" error={errors.proofOfResidenceFile as FieldError | undefined} fileValue={proofOfResidenceFileValue as FileList | null} fieldName="proofOfResidenceFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.proofOfResidenceFile} isSubmitting={isSubmitting} />
                <div className="space-y-2">
                  <Label htmlFor="proofOfResidenceDate" className="text-[#5E6B7A] ml-1">Data do Comprovante (máx. 90 dias)</Label>
                  <Input
                    id="proofOfResidenceDate"
                    {...register('proofOfResidenceDate')}
                    onChange={(event) => {
                      const value = formatDate(event.target.value);
                      event.target.value = value;
                      setValue('proofOfResidenceDate', value, { shouldValidate: true });
                    }}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12"
                  />
                  {errors.proofOfResidenceDate && <p className="text-sm text-red-500 ml-1">{errors.proofOfResidenceDate.message}</p>}
                </div>
              </div>
            </div>

            <div className="wizard-section wizard-step-2 grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/60">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Validação Médica</h3>
                <p className="mt-2 text-sm text-[#5E6B7A] leading-relaxed">Laudo médico e informações do profissional.</p>
              </div>
              <div className="md:col-span-2">
                <div className="rounded-2xl bg-blue-50/80 p-4 text-sm text-blue-800 mb-6 flex gap-3 border border-blue-100">
                  <AlertCircle className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
                  <p>O laudo deve ser assinado por reumatologista, contendo obrigatoriamente o <strong className="font-semibold">CID 10 - M79.7</strong> e CRM do profissional.</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <FileUploadField id="medicalReportFile" label="Laudo Médico (PDF/JPG/PNG até 5MB)" accept=".pdf,image/*" error={errors.medicalReportFile as FieldError | undefined} fileValue={medicalReportFileValue as FileList | null} fieldName="medicalReportFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.medicalReportFile} isSubmitting={isSubmitting} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cid" className="text-[#5E6B7A] ml-1">CID 10</Label>
                    <Input
                      id="cid"
                      list="cid-options"
                      {...register('cid')}
                      onChange={(event) => {
                        let value = event.target.value.toUpperCase();
                        if (value.includes(' - ')) value = value.split(' - ')[0].trim();
                        event.target.value = value;
                        setValue('cid', value, { shouldValidate: true });
                      }}
                      placeholder="M79.7"
                      className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12"
                    />
                    <datalist id="cid-options">
                      <option value="M79.7 - Fibromialgia" />
                      <option value="M79.0 - Reumatismo não especificado" />
                      <option value="M79.1 - Mialgia" />
                      <option value="R52.9 - Dor não especificada" />
                      <option value="F45.4 - Transtorno doloroso somatoforme" />
                    </datalist>
                    {errors.cid && <p className="text-sm text-red-500 ml-1">{errors.cid.message}</p>}
                  </div>
                  {cidValue && cidValue.toUpperCase() !== CID_DEFAULT && (
                    <div className="space-y-2 sm:col-span-3 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="justificativaCid" className="text-amber-700 font-medium ml-1 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Justificativa Médica (obrigatório para CID diferente de M79.7)
                      </Label>
                      <Input id="justificativaCid" {...register('justificativaCid')} placeholder="Justificativa para emissão da carteira com este CID" className="rounded-xl bg-amber-50/30 border-amber-200 focus:bg-white h-12" />
                      {errors.justificativaCid && <p className="text-sm text-red-500 ml-1">{errors.justificativaCid.message}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="medicalReportDate" className="text-[#5E6B7A] ml-1">Data de Emissão do Laudo</Label>
                    <Input
                      id="medicalReportDate"
                      {...register('medicalReportDate')}
                      onChange={(event) => {
                        const value = formatDate(event.target.value);
                        event.target.value = value;
                        setValue('medicalReportDate', value, { shouldValidate: true });
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12"
                    />
                    {errors.medicalReportDate && <p className="text-sm text-red-500 ml-1">{errors.medicalReportDate.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crm" className="text-[#5E6B7A] ml-1">CRM do Médico</Label>
                    <Input id="crm" {...register('crm')} placeholder="Ex: 12345-SP" className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12" />
                    {errors.crm && <p className="text-sm text-red-500 ml-1">{errors.crm.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="wizard-section wizard-step-3 grid grid-cols-1 md:grid-cols-3 gap-8 pb-4">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Fotografia</h3>
                <p className="mt-2 text-sm text-[#5E6B7A] leading-relaxed">Foto 3x4 recente, colorida e com fundo claro.</p>
              </div>
              <div className="md:col-span-2">
                <FileUploadField id="photoFile" label="Anexar Foto" accept="image/*" error={errors.photoFile as FieldError | undefined} fileValue={photoFileValue as FileList | null} fieldName="photoFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.photoFile} isSubmitting={isSubmitting} />
              </div>
            </div>

            <div className="wizard-section wizard-step-4 pb-4">
              <div className="mb-6 rounded-2xl border border-[#b9d7c7] bg-[#edf7f1] p-4 text-sm text-[#166534]">
                Confira os dados antes de salvar. Se algo estiver errado, volte para a etapa correspondente.
              </div>
              {reviewWarnings.length > 0 && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="mb-2 font-black">Pontos para conferência antes de salvar</p>
                  <ul className="space-y-1">
                    {reviewWarnings.map((warning) => (
                      <li key={warning} className="flex gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {reviewItems.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-[#617184]">{label}</p>
                    <p className="mt-1 break-words font-semibold text-[#17324d]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 flex flex-col items-end gap-4">
              {submitError && (
                <div className="w-full p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-left animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-800">Erro ao salvar</h4>
                    <p className="text-sm text-red-600 mt-1">{submitError}</p>
                  </div>
                </div>
              )}
              {isSubmitting && (
                <div className="w-full rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex items-center justify-between text-xs text-blue-700 font-semibold uppercase tracking-wider">
                    <span>{uploadStep || 'Processando cadastro...'}</span>
                    <span>{overallUploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-600 transition-all duration-300" style={{ width: `${overallUploadProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" disabled={isSubmitting || currentStep === 0} onClick={goToPreviousStep} className="h-12 rounded-xl px-8">
                  Voltar
                </Button>
                {!isReviewStep ? (
                  <Button type="button" onClick={goToNextStep} className="h-12 rounded-xl bg-blue-600 px-10 text-white hover:bg-blue-700">
                    Continuar
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="h-12 rounded-xl bg-blue-600 px-10 font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Enviando...
                      </div>
                    ) : (
                      'Confirmar e registrar CIPF'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
