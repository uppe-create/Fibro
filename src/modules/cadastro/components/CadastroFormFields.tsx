import type { FocusEvent } from 'react';
import type { FieldError, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCNS, formatCPF, formatDate, formatPhone } from '@/lib/utils';
import { CID_DEFAULT, type FormData, type UploadField } from '@/lib/cadastro-utils';
import { FileUploadField } from '@/modules/cadastro/components/FileUploadField';

type CadastroFormFieldsProps = {
  register: UseFormRegister<FormData>;
  setValue: UseFormSetValue<FormData>;
  errors: FieldErrors<FormData>;
  isSubmitting: boolean;
  isMinor: () => boolean;
  handleCepBlur: (event: FocusEvent<HTMLInputElement>) => void;
  handleRemoveFile: (fieldName: keyof FormData) => void;
  cpfValue?: string;
  cnsValue?: string;
  birthDateValue?: string;
  cidValue?: string;
  documentFileValue?: FileList | null;
  proofOfResidenceFileValue?: FileList | null;
  medicalReportFileValue?: FileList | null;
  photoFileValue?: FileList | null;
  uploadProgress: Record<UploadField, number>;
  photoQualityWarnings: string[];
};

const inputClass = 'rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white h-12';
const labelClass = 'text-[#5E6B7A] ml-1';

export function CadastroFormFields({
  register,
  setValue,
  errors,
  isSubmitting,
  isMinor,
  handleCepBlur,
  handleRemoveFile,
  cpfValue,
  cnsValue,
  birthDateValue,
  cidValue,
  documentFileValue,
  proofOfResidenceFileValue,
  medicalReportFileValue,
  photoFileValue,
  uploadProgress,
  photoQualityWarnings
}: CadastroFormFieldsProps) {
  return (
    <>
      <div className="wizard-section wizard-step-0 grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/60">
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium text-[#1D1D1F]">Identificação do Titular</h3>
          <p className="mt-2 text-sm text-[#5E6B7A] leading-relaxed">Informações pessoais e contato do beneficiário.</p>
        </div>
        <div className="md:col-span-2 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullName" className={labelClass}>Nome Completo</Label>
            <Input id="fullName" {...register('fullName')} placeholder="Ex: MARIA DA SILVA" className={`uppercase ${inputClass}`} />
            {errors.fullName && <p className="text-sm text-red-500 ml-1">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf" className={labelClass}>CPF</Label>
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
                className={`${inputClass} ${cpfValue?.length === 14 && !errors.cpf ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
              />
              {cpfValue?.length === 14 && !errors.cpf && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
              )}
            </div>
            {errors.cpf && <p className="text-sm text-red-500 ml-1">{errors.cpf.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cns" className={labelClass}>Cartão SUS</Label>
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
                className={`${inputClass} ${cnsValue?.replace(/\D/g, '').length === 15 && !errors.cns ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
              />
              {cnsValue?.replace(/\D/g, '').length === 15 && !errors.cns && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
              )}
            </div>
            {errors.cns && <p className="text-sm text-red-500 ml-1">{errors.cns.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className={labelClass}>Telefone</Label>
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
              className={inputClass}
            />
            {errors.phone && <p className="text-sm text-red-500 ml-1">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthDate" className={labelClass}>Data de Nascimento</Label>
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
                className={`${inputClass} ${birthDateValue?.length === 10 && !errors.birthDate ? 'border-green-500 focus:border-green-500 focus:ring-green-500' : ''}`}
              />
              {birthDateValue?.length === 10 && !errors.birthDate && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
              )}
            </div>
            {errors.birthDate && <p className="text-sm text-red-500 ml-1">{errors.birthDate.message}</p>}
          </div>
          {isMinor() && (
            <div className="space-y-2 sm:col-span-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="legalGuardian" className={labelClass}>Nome do Responsável Legal (obrigatório para menores de 18 anos)</Label>
              <Input id="legalGuardian" {...register('legalGuardian')} placeholder="Ex: JOÃO DA SILVA" className={`uppercase ${inputClass}`} />
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
            <Label htmlFor="cep" className={labelClass}>CEP</Label>
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
              className={inputClass}
            />
            {errors.cep && <p className="text-sm text-red-500 ml-1">{errors.cep.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="logradouro" className={labelClass}>Logradouro</Label>
            <Input id="logradouro" {...register('logradouro')} placeholder="Rua, avenida, etc." className={`uppercase ${inputClass}`} />
            {errors.logradouro && <p className="text-sm text-red-500 ml-1">{errors.logradouro.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bairro" className={labelClass}>Bairro</Label>
            <Input id="bairro" {...register('bairro')} placeholder="Bairro" className={`uppercase ${inputClass}`} />
            {errors.bairro && <p className="text-sm text-red-500 ml-1">{errors.bairro.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="cidade" className={labelClass}>Cidade</Label>
            <Input id="cidade" {...register('cidade')} placeholder="Cidade" className={`uppercase ${inputClass}`} />
            {errors.cidade && <p className="text-sm text-red-500 ml-1">{errors.cidade.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="estado" className={labelClass}>UF</Label>
            <Input id="estado" {...register('estado')} placeholder="SP" maxLength={2} className={`uppercase ${inputClass}`} />
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
          <FileUploadField id="documentFile" label="Documento Oficial com Foto e CPF (PDF/JPG/PNG até 5MB)" accept=".pdf,image/*" error={errors.documentFile as FieldError | undefined} fileValue={documentFileValue || null} fieldName="documentFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.documentFile} isSubmitting={isSubmitting} />
          <FileUploadField id="proofOfResidenceFile" label="Comprovante de Residência (PDF/JPG/PNG até 5MB)" accept=".pdf,image/*" error={errors.proofOfResidenceFile as FieldError | undefined} fileValue={proofOfResidenceFileValue || null} fieldName="proofOfResidenceFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.proofOfResidenceFile} isSubmitting={isSubmitting} />
          <div className="space-y-2">
            <Label htmlFor="proofOfResidenceDate" className={labelClass}>Data do Comprovante (máx. 90 dias)</Label>
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
              className={inputClass}
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
              <FileUploadField id="medicalReportFile" label="Laudo Médico (PDF/JPG/PNG até 5MB)" accept=".pdf,image/*" error={errors.medicalReportFile as FieldError | undefined} fileValue={medicalReportFileValue || null} fieldName="medicalReportFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.medicalReportFile} isSubmitting={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cid" className={labelClass}>CID 10</Label>
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
                className={`uppercase ${inputClass}`}
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
                  Justificativa Médica (obrigatória para CID diferente de M79.7)
                </Label>
                <Input id="justificativaCid" {...register('justificativaCid')} placeholder="Justificativa para emissão da carteira com este CID" className="rounded-xl bg-amber-50/30 border-amber-200 focus:bg-white h-12" />
                {errors.justificativaCid && <p className="text-sm text-red-500 ml-1">{errors.justificativaCid.message}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="medicalReportDate" className={labelClass}>Data de Emissão do Laudo</Label>
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
                className={inputClass}
              />
              {errors.medicalReportDate && <p className="text-sm text-red-500 ml-1">{errors.medicalReportDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm" className={labelClass}>CRM do Médico</Label>
              <Input id="crm" {...register('crm')} placeholder="Ex: 12345-SP" className={inputClass} />
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
          <FileUploadField id="photoFile" label="Anexar Foto" accept="image/*" error={errors.photoFile as FieldError | undefined} fileValue={photoFileValue || null} fieldName="photoFile" register={register} onRemove={handleRemoveFile} progress={uploadProgress.photoFile} isSubmitting={isSubmitting} />
          {photoQualityWarnings.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">Conferência da foto</p>
              <ul className="mt-2 space-y-1">
                {photoQualityWarnings.map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
