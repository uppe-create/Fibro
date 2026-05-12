import { getAgeFromBRDate } from '@/lib/date';
import { CID_DEFAULT, type FormData } from '@/lib/cadastro-utils';
import type { CIPFRegistration } from '@/store/useAppStore';

export type CadastroStep = {
  title: string;
  description: string;
  fields: Array<keyof FormData>;
};

export type ReviewItem = [label: string, value: string];

type BuildReviewState = {
  values: Partial<FormData>;
  documentFile?: File;
  proofOfResidenceFile?: File;
  medicalReportFile?: File;
  photoFile?: File;
};

type BuildWarningsState = BuildReviewState & {
  possibleDuplicates: CIPFRegistration[];
  photoQualityWarnings: string[];
};

export const CADASTRO_STEPS: CadastroStep[] = [
  {
    title: 'Dados pessoais',
    description: 'Identificação e contato do titular.',
    fields: ['fullName', 'cpf', 'cns', 'phone', 'birthDate', 'legalGuardian']
  },
  {
    title: 'Endereço',
    description: 'Residência do beneficiário.',
    fields: ['cep', 'logradouro', 'bairro', 'cidade', 'estado']
  },
  {
    title: 'Dados médicos',
    description: 'Laudo, CID e CRM.',
    fields: ['medicalReportFile', 'medicalReportDate', 'cid', 'justificativaCid', 'crm']
  },
  {
    title: 'Documentos',
    description: 'Identificação, residência e foto.',
    fields: ['documentFile', 'proofOfResidenceFile', 'proofOfResidenceDate', 'photoFile']
  },
  {
    title: 'Revisão',
    description: 'Confira antes de salvar.',
    fields: []
  }
];

export function isMinorBirthDate(birthDate?: string) {
  if (!birthDate || birthDate.length < 10) return false;
  const age = getAgeFromBRDate(birthDate);
  return age !== null && age < 18;
}

export function buildReviewWarnings({
  values,
  possibleDuplicates,
  documentFile,
  proofOfResidenceFile,
  medicalReportFile,
  photoFile,
  photoQualityWarnings
}: BuildWarningsState) {
  const warnings: string[] = [];
  if (possibleDuplicates.length) {
    warnings.push(`Possível duplicidade: ${possibleDuplicates.map((reg) => reg.fullName).join(', ')}`);
  }
  if ((values.cid || '').toUpperCase() !== CID_DEFAULT) {
    warnings.push('CID diferente de M79.7 exige justificativa médica consistente.');
  }
  if (isMinorBirthDate(values.birthDate)) {
    warnings.push('Titular menor de idade: confira responsável legal e documento.');
  }
  if (!values.cns) {
    warnings.push('Cartão SUS não informado. O campo é opcional, mas confira se a Secretaria deseja registrar.');
  }
  if (!documentFile || !proofOfResidenceFile || !medicalReportFile || !photoFile) {
    warnings.push('Confira todos os anexos antes de salvar.');
  }
  warnings.push(...photoQualityWarnings);
  return warnings;
}

export function buildReviewItems({
  values,
  documentFile,
  proofOfResidenceFile,
  medicalReportFile,
  photoFile
}: BuildReviewState): ReviewItem[] {
  return [
    ['Nome', values.fullName || '-'],
    ['CPF', values.cpf || '-'],
    ['Cartão SUS', values.cns || 'Não informado'],
    ['Nascimento', values.birthDate || '-'],
    ['Telefone', values.phone || '-'],
    ['Endereço', [values.logradouro, values.bairro, values.cidade, values.estado].filter(Boolean).join(', ') || '-'],
    ['CID', values.cid || '-'],
    ['CRM', values.crm || '-'],
    ['Data do laudo', values.medicalReportDate || '-'],
    ['Data do comprovante', values.proofOfResidenceDate || '-'],
    ['Documento oficial', documentFile?.name || 'Não anexado'],
    ['Comprovante', proofOfResidenceFile?.name || 'Não anexado'],
    ['Laudo médico', medicalReportFile?.name || 'Não anexado'],
    ['Foto', photoFile?.name || 'Não anexada']
  ];
}

export function buildLiveChecklist({
  values,
  documentFile,
  proofOfResidenceFile,
  medicalReportFile,
  photoFile
}: BuildReviewState) {
  return [
    { label: 'CPF', ok: String(values.cpf || '').replace(/\D/g, '').length === 11 },
    { label: 'Cartão SUS', ok: !values.cns || String(values.cns).replace(/\D/g, '').length === 15 },
    { label: 'Telefone', ok: String(values.phone || '').replace(/\D/g, '').length >= 10 },
    { label: 'Foto', ok: Boolean(photoFile) },
    { label: 'Documento', ok: Boolean(documentFile) },
    { label: 'Comprovante', ok: Boolean(proofOfResidenceFile) },
    { label: 'Laudo', ok: Boolean(medicalReportFile) },
    { label: 'CID', ok: Boolean(values.cid) },
    { label: 'CRM', ok: Boolean(values.crm) }
  ];
}
