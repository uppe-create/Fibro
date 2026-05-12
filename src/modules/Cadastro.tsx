import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppStore } from '@/store/useAppStore';
import { hasPermission } from '@/lib/permissions';
import { CadastroFormFields } from '@/modules/cadastro/components/CadastroFormFields';
import { CadastroFormActions } from '@/modules/cadastro/components/CadastroFormActions';
import { CadastroHeader } from '@/modules/cadastro/components/CadastroHeader';
import { CadastroReview } from '@/modules/cadastro/components/CadastroReview';
import { CadastroSuccess } from '@/modules/cadastro/components/CadastroSuccess';
import { CadastroWizardProgress } from '@/modules/cadastro/components/CadastroWizardProgress';
import { usePhotoQualityWarnings } from '@/modules/cadastro/hooks/usePhotoQualityWarnings';
import { useCadastroSubmit } from '@/modules/cadastro/hooks/useCadastroSubmit';
import {
  CADASTRO_STEPS,
  buildLiveChecklist,
  buildReviewItems,
  buildReviewWarnings,
  isMinorBirthDate
} from '@/modules/cadastro/lib/review';
import { DRAFT_STORAGE_KEY, cadastroSchema, normalizeLookupText, normalizeText, type FormData } from '@/lib/cadastro-utils';

export function Cadastro() {
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
    resolver: zodResolver(cadastroSchema),
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
  const steps = CADASTRO_STEPS;
  const photoQualityWarnings = usePhotoQualityWarnings(photoFileValue?.[0]);
  const {
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
  } = useCadastroSubmit({
    currentUser,
    registrations,
    fetchRegistrations,
    reset,
    setValue,
    setCurrentStep,
    clearDraftState: () => {
      setDraftSavedAt(null);
      setDraftRestored(false);
    }
  });

  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);
  const isReviewStep = currentStep === steps.length - 1;

  useEffect(() => {
    if (hasPermission(currentUser, 'viewDashboard')) {
      fetchRegistrations().catch(() => null);
    }
  }, [currentUser, fetchRegistrations]);

  useEffect(() => {
    const rawDraft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) return;
    try {
      const parsed = JSON.parse(rawDraft) as Partial<Record<keyof FormData, string>>;
      reset(parsed as Partial<FormData>);
      setDraftRestored(true);
      setDraftSavedAt(Date.now());
    } catch {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [reset]);

  useEffect(() => {
    if (registeredData) return;
    const enableSensitiveDrafts = String((import.meta as any).env?.VITE_ENABLE_SENSITIVE_DRAFTS || '').toLowerCase() === 'true';
    if (!enableSensitiveDrafts) return;
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
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftSavedAt(Date.now());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [formValues, registeredData]);

  const discardDraft = () => {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
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

  const isMinor = () => isMinorBirthDate(birthDateValue);

  const reviewWarnings = useMemo(() =>
    buildReviewWarnings({
      values: formValues,
      possibleDuplicates,
      documentFile: documentFileValue?.[0],
      proofOfResidenceFile: proofOfResidenceFileValue?.[0],
      medicalReportFile: medicalReportFileValue?.[0],
      photoFile: photoFileValue?.[0],
      photoQualityWarnings
    }),
    [possibleDuplicates, formValues, documentFileValue, proofOfResidenceFileValue, medicalReportFileValue, photoFileValue, photoQualityWarnings]
  );

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

  const reviewItems = buildReviewItems({
    values: formValues,
    documentFile: documentFileValue?.[0],
    proofOfResidenceFile: proofOfResidenceFileValue?.[0],
    medicalReportFile: medicalReportFileValue?.[0],
    photoFile: photoFileValue?.[0]
  });

  const liveChecklist = buildLiveChecklist({
    values: formValues,
    documentFile: documentFileValue?.[0],
    proofOfResidenceFile: proofOfResidenceFileValue?.[0],
    medicalReportFile: medicalReportFileValue?.[0],
    photoFile: photoFileValue?.[0]
  });

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
    } catch {}
  };


  if (registeredData) {
    return <CadastroSuccess data={registeredData} onNewRegistration={clearRegisteredData} />;
  }

  return (
    <div className="cipf-page mx-auto max-w-5xl">
      <CadastroHeader draftSavedAt={draftSavedAt} draftRestored={draftRestored} onDiscardDraft={discardDraft} />
      <div className="cipf-panel mt-8 overflow-hidden">
        <div className="p-6 sm:p-8 md:p-12">
          <CadastroWizardProgress
            steps={steps}
            currentStep={currentStep}
            progressPercent={progressPercent}
            onStepClick={setCurrentStep}
          />

          <form onSubmit={handleSubmit(submitCadastro)} className={`cadastro-wizard step-${currentStep} space-y-12`}>
            <CadastroFormFields
              register={register}
              setValue={setValue}
              errors={errors}
              isSubmitting={isSubmitting}
              isMinor={isMinor}
              handleCepBlur={handleCepBlur}
              handleRemoveFile={handleRemoveFile}
              cpfValue={cpfValue}
              cnsValue={cnsValue}
              birthDateValue={birthDateValue}
              cidValue={cidValue}
              documentFileValue={documentFileValue as FileList | null}
              proofOfResidenceFileValue={proofOfResidenceFileValue as FileList | null}
              medicalReportFileValue={medicalReportFileValue as FileList | null}
              photoFileValue={photoFileValue as FileList | null}
              uploadProgress={uploadProgress}
              photoQualityWarnings={photoQualityWarnings}
            />
            <CadastroReview warnings={reviewWarnings} checklist={liveChecklist} items={reviewItems} />

            <CadastroFormActions
              submitError={submitError}
              isSubmitting={isSubmitting}
              uploadStep={uploadStep}
              overallUploadProgress={overallUploadProgress}
              currentStep={currentStep}
              isReviewStep={isReviewStep}
              onPrevious={goToPreviousStep}
              onNext={goToNextStep}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
