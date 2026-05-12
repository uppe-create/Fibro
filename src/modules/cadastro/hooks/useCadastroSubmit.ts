import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { UseFormReset, UseFormSetValue } from 'react-hook-form';
import { logAuditEvent } from '@/lib/audit';
import { buildAuditEvent } from '@/lib/audit-events';
import {
  DRAFT_STORAGE_KEY,
  INITIAL_UPLOAD_PROGRESS,
  cropImageTo3x4DataUri,
  generateChecksum,
  type FormData,
  type UploadField
} from '@/lib/cadastro-utils';
import { hasPermission } from '@/lib/permissions';
import { isCpfBlockedByStatus } from '@/lib/registration-status';
import { cleanupStorageFiles, dataUriToFile, uploadCipfStorageFile } from '@/lib/storage-files';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatCNS, generateSecureToken, getSafeErrorMessage } from '@/lib/utils';
import { cleanupOrphanFiles } from '@/modules/cadastro/lib/filePersistence';
import type { AppUser, CIPFRegistration } from '@/store/useAppStore';

type RegisteredData = {
  fullName: string;
  cpf: string;
  cns?: string;
};

type UseCadastroSubmitOptions = {
  currentUser: AppUser | null;
  registrations: CIPFRegistration[];
  fetchRegistrations: () => Promise<void>;
  reset: UseFormReset<FormData>;
  setValue: UseFormSetValue<FormData>;
  setCurrentStep: Dispatch<SetStateAction<number>>;
  clearDraftState: () => void;
};

type UseCadastroSubmitResult = {
  registeredData: RegisteredData | null;
  uploadStep: string;
  submitError: string;
  uploadProgress: Record<UploadField, number>;
  overallUploadProgress: number;
  clearRegisteredData: () => void;
  setSubmitError: Dispatch<SetStateAction<string>>;
  resetUploadProgress: () => void;
  handleRemoveFile: (fieldName: keyof FormData) => void;
  submitCadastro: (data: FormData) => Promise<void>;
};

function maskCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**');
}

export function useCadastroSubmit({
  currentUser,
  registrations,
  fetchRegistrations,
  reset,
  setValue,
  setCurrentStep,
  clearDraftState
}: UseCadastroSubmitOptions): UseCadastroSubmitResult {
  const [registeredData, setRegisteredData] = useState<RegisteredData | null>(null);
  const [uploadStep, setUploadStep] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(INITIAL_UPLOAD_PROGRESS);

  const overallUploadProgress = useMemo(() => {
    const total = (Object.values(uploadProgress) as number[]).reduce((sum, value) => sum + value, 0);
    return Math.round(total / 4);
  }, [uploadProgress]);

  const resetUploadProgress = () => setUploadProgress(INITIAL_UPLOAD_PROGRESS);

  const updateUploadProgress = (field: UploadField, value: number) => {
    setUploadProgress((previous) => ({
      ...previous,
      [field]: Math.max(0, Math.min(100, value))
    }));
  };

  const handleRemoveFile = (fieldName: keyof FormData) => {
    setValue(fieldName, null, { shouldValidate: true });
    if (fieldName in INITIAL_UPLOAD_PROGRESS) {
      updateUploadProgress(fieldName as UploadField, 0);
    }
  };

  const clearRegisteredData = () => setRegisteredData(null);

  const submitCadastro = async (data: FormData) => {
    if (!currentUser) {
      setSubmitError('Usuário não autenticado. Faça login novamente.');
      return;
    }

    if (!hasPermission(currentUser, 'createRegistration')) {
      setSubmitError('Seu perfil não permite criar novas carteirinhas.');
      return;
    }

    if (
      !window.confirm(
        `Enviar o cadastro de ${data.fullName} para análise?\n\nConfirme somente se você revisou os dados pessoais, endereço, laudo e documentos anexados.`
      )
    ) {
      return;
    }

    setSubmitError('');
    resetUploadProgress();

    const uploadedFileIds: string[] = [];
    const uploadedStorageFileIds: string[] = [];

    try {
      assertSupabaseConfigured();
      const cpfClean = data.cpf.replace(/\D/g, '');
      const cnsClean = data.cns?.replace(/\D/g, '') || '';
      const registrationId = crypto.randomUUID();
      const deletedBy =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser.id)
          ? currentUser.id
          : null;

      setUploadStep('Validando regras de negócio...');
      const existingIndexResult = await supabase
        .from('registration_index')
        .select('cpf,status')
        .eq('cpf', cpfClean)
        .maybeSingle();
      if (existingIndexResult.error) throw existingIndexResult.error;
      if (existingIndexResult.data?.status && isCpfBlockedByStatus(existingIndexResult.data.status)) {
        throw new Error('CPF_DUPLICATE_ACTIVE');
      }

      const shouldReuseCancelledCpf = Boolean(
        existingIndexResult.data?.status && !isCpfBlockedByStatus(existingIndexResult.data.status)
      );

      setUploadStep('Upload do documento oficial...');
      const documentFileId = await uploadCipfStorageFile({
        registrationId,
        kind: 'document',
        file: data.documentFile[0],
        createdBy: currentUser.id,
        onProgress: (value) => updateUploadProgress('documentFile', value)
      });
      uploadedStorageFileIds.push(documentFileId);

      setUploadStep('Upload do comprovante de residência...');
      const proofOfResidenceFileId = await uploadCipfStorageFile({
        registrationId,
        kind: 'proof_of_residence',
        file: data.proofOfResidenceFile[0],
        createdBy: currentUser.id,
        onProgress: (value) => updateUploadProgress('proofOfResidenceFile', value)
      });
      uploadedStorageFileIds.push(proofOfResidenceFileId);

      setUploadStep('Upload do laudo médico...');
      const medicalReportFileId = await uploadCipfStorageFile({
        registrationId,
        kind: 'medical_report',
        file: data.medicalReportFile[0],
        createdBy: currentUser.id,
        onProgress: (value) => updateUploadProgress('medicalReportFile', value)
      });
      uploadedStorageFileIds.push(medicalReportFileId);

      setUploadStep('Processando e enviando foto 3x4...');
      const croppedPhotoDataUri = await cropImageTo3x4DataUri(data.photoFile[0]);
      const photoFileId = await uploadCipfStorageFile({
        registrationId,
        kind: 'photo',
        file: dataUriToFile(croppedPhotoDataUri, 'photo.jpg'),
        createdBy: currentUser.id,
        onProgress: (value) => updateUploadProgress('photoFile', value)
      });
      uploadedStorageFileIds.push(photoFileId);

      setUploadStep('Gerando registro e checksum...');
      const issueDate = new Date();
      const expiryDate = new Date(issueDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);
      const issueDateStr = issueDate.toLocaleDateString('pt-BR');
      const expiryDateStr = expiryDate.toLocaleDateString('pt-BR');
      const visualSignature = generateSecureToken(8);
      const checksum = await generateChecksum(
        `${cpfClean}|${data.fullName}|${data.birthDate}|${issueDateStr}|${visualSignature}`
      );

      const archiveDraftRegistration = async () => {
        await supabase
          .from('registrations')
          .update({ status: 'cancelled', deleted_at: new Date().toISOString(), deleted_by: deletedBy })
          .eq('id', registrationId);
      };

      setUploadStep('Gravando cadastro no banco...');
      const registrationResult = await supabase.from('registrations').insert({
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
      if (registrationResult.error) throw registrationResult.error;

      if (shouldReuseCancelledCpf) {
        const deleteOldIndexResult = await supabase.from('registration_index').delete().eq('cpf', cpfClean);
        if (deleteOldIndexResult.error) throw deleteOldIndexResult.error;
      }

      const registrationIndexResult = await supabase.from('registration_index').insert({
        cpf: cpfClean,
        registration_id: registrationId,
        status: 'under_review',
        updated_at: new Date().toISOString()
      });
      if (registrationIndexResult.error) {
        await archiveDraftRegistration();
        if ((registrationIndexResult.error as any)?.code === '23505') throw new Error('CPF_DUPLICATE_ACTIVE');
        throw registrationIndexResult.error;
      }

      const publicValidationResult = await supabase.from('public_validations').upsert({
        id: registrationId,
        fullName: data.fullName,
        cpfMasked: maskCpf(cpfClean),
        issueDate: issueDateStr,
        expiryDate: expiryDateStr,
        status: 'under_review',
        visualSignature,
        checksum
      });
      if (publicValidationResult.error) {
        await archiveDraftRegistration();
        await supabase.from('registration_index').delete().eq('cpf', cpfClean);
        throw publicValidationResult.error;
      }

      await logAuditEvent(
        buildAuditEvent('registration.created', {
          registrationId,
          userId: currentUser.id,
          userName: currentUser.name,
          targetLabel: data.fullName,
          details: `cid=${data.cid}; bairro=${data.bairro}; cns=${cnsClean ? 'informado' : 'nao informado'}; origem=modulo-cadastro`
        })
      );

      setUploadStep('Cadastro finalizado com sucesso.');
      setRegisteredData({
        fullName: data.fullName,
        cpf: data.cpf,
        cns: cnsClean ? formatCNS(cnsClean) : undefined
      });
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      clearDraftState();
      reset();
      setCurrentStep(0);
      resetUploadProgress();
      await fetchRegistrations();
    } catch (error: any) {
      setUploadStep('');
      await cleanupOrphanFiles(uploadedFileIds);
      await cleanupStorageFiles(uploadedStorageFileIds);
      setSubmitError(getSafeErrorMessage(error, 'Erro ao enviar formulario. Verifique os dados e tente novamente.'));
    }
  };

  return {
    registeredData,
    uploadStep,
    submitError,
    uploadProgress,
    overallUploadProgress,
    clearRegisteredData,
    setSubmitError,
    resetUploadProgress,
    handleRemoveFile,
    submitCadastro
  };
}
