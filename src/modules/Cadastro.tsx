import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { formatCPF, formatDate, formatPhone, validateCPF } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const schema = z.object({
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').transform(val => val.toUpperCase().replace(/\s+/g, ' ').trim()),
  cpf: z.string().min(14, 'CPF inválido').refine(val => validateCPF(val), 'CPF inválido matematicamente'),
  phone: z.string().min(14, 'Telefone inválido'),
  birthDate: z.string().min(10, 'Data inválida').refine(dateStr => {
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return false;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();
    if (date > today) return false; // No future dates
    const age = today.getFullYear() - date.getFullYear();
    if (age > 120) return false; // Age <= 120
    return true;
  }, "Data de nascimento inválida (futura ou idade > 120 anos)."),
  legalGuardian: z.string().optional().transform(val => val ? val.toUpperCase().replace(/\s+/g, ' ').trim() : undefined),
  cep: z.string().min(9, 'CEP inválido'),
  logradouro: z.string().min(3, 'Logradouro obrigatório'),
  bairro: z.string().min(2, 'Bairro obrigatório'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  estado: z.string().length(2, 'Estado (UF) deve ter 2 letras').toUpperCase(),
  documentFile: z.any().refine((files) => files?.length == 1, "Documento é obrigatório."),
  proofOfResidenceFile: z.any().refine((files) => files?.length == 1, "Comprovante é obrigatório."),
  proofOfResidenceDate: z.string().min(10, 'Data do comprovante inválida').refine(dateStr => {
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return false;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return date >= ninetyDaysAgo;
  }, "O comprovante não pode ter mais de 90 dias."),
  medicalReportFile: z.any().refine((files) => files?.length == 1, "Laudo é obrigatório."),
  medicalReportDate: z.string().min(10, 'Data do laudo inválida').refine(dateStr => {
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return false;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return date >= sixMonthsAgo;
  }, "O laudo não pode ter mais de 6 meses de emissão."),
  cid: z.string().toUpperCase().min(3, 'CID obrigatório'),
  justificativaCid: z.string().optional(),
  crm: z.string().min(4, 'CRM inválido'),
  photoFile: z.any().refine((files) => files?.length == 1, "Foto é obrigatória.")
}).superRefine((data, ctx) => {
  if (data.cid !== 'M79.7' && (!data.justificativaCid || data.justificativaCid.length < 10)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Justificativa médica é obrigatória e deve ter pelo menos 10 caracteres quando o CID não for M79.7",
      path: ["justificativaCid"]
    });
  }
});

type FormData = z.infer<typeof schema>;

export function Cadastro() {
  const [registeredData, setRegisteredData] = useState<{ fullName: string, cpf: string } | null>(null);
  const { currentUser } = useAppStore();

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const birthDateValue = watch('birthDate');
  const documentFileValue = watch('documentFile');
  const proofOfResidenceFileValue = watch('proofOfResidenceFile');
  const medicalReportFileValue = watch('medicalReportFile');
  const photoFileValue = watch('photoFile');

  const isMinor = () => {
    if (!birthDateValue || birthDateValue.length < 10) return false;
    const [day, month, year] = birthDateValue.split('/');
    const birthDate = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  };

  const uploadFile = async (file: File, path: string) => {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const cropImageTo3x4 = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetRatio = 3 / 4;
        const imgRatio = img.width / img.height;
        
        let cropWidth = img.width;
        let cropHeight = img.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > targetRatio) {
          // Image is wider than 3:4, crop sides
          cropWidth = img.height * targetRatio;
          offsetX = (img.width - cropWidth) / 2;
        } else {
          // Image is taller than 3:4, crop top/bottom
          cropHeight = img.width / targetRatio;
          offsetY = (img.height - cropHeight) / 2;
        }

        canvas.width = 300; // Standardize output size
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Failed to get canvas context'));

        ctx.drawImage(img, offsetX, offsetY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Failed to create blob'));
          const croppedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
          resolve(croppedFile);
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const cidValue = watch('cid');

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setValue('logradouro', data.logradouro, { shouldValidate: true });
          setValue('bairro', data.bairro, { shouldValidate: true });
          setValue('cidade', data.localidade, { shouldValidate: true });
          setValue('estado', data.uf, { shouldValidate: true });
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const generateChecksum = async (data: string) => {
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;

    try {
      // Check for duplicate CPF
      const cpfClean = data.cpf.replace(/\D/g, '');
      const q = query(collection(db, 'registrations'), where('cpf', '==', cpfClean), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert('CPF já possui uma carteira ativa. Solicite renovação ou segunda via.');
        return;
      }

      // Upload files
      const documentUrl = await uploadFile(data.documentFile[0], 'documents');
      const proofOfResidenceUrl = await uploadFile(data.proofOfResidenceFile[0], 'proofs');
      const medicalReportUrl = await uploadFile(data.medicalReportFile[0], 'reports');
      
      // Crop and upload photo
      const croppedPhoto = await cropImageTo3x4(data.photoFile[0]);
      const photoUrl = await uploadFile(croppedPhoto, 'photos');

      // Calculate Expiry (exactly 2 years)
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);

      const visualSignature = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const issueDateStr = issueDate.toLocaleDateString('pt-BR');
      const expiryDateStr = expiryDate.toLocaleDateString('pt-BR');

      // Generate Checksum
      const dataToHash = `${cpfClean}${data.fullName}${data.birthDate}${issueDateStr}${visualSignature}`;
      const checksum = await generateChecksum(dataToHash);

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'registrations'), {
        fullName: data.fullName,
        cpf: cpfClean,
        phone: data.phone.replace(/\D/g, ''),
        birthDate: data.birthDate,
        legalGuardian: data.legalGuardian || null,
        cep: data.cep.replace(/\D/g, ''),
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.cidade,
        estado: data.estado,
        documentUrl,
        proofOfResidenceUrl,
        proofOfResidenceDate: data.proofOfResidenceDate,
        medicalReportUrl,
        medicalReportDate: data.medicalReportDate,
        cid: data.cid,
        justificativaCid: data.justificativaCid || null,
        crm: data.crm,
        photoUrl,
        issueDate: issueDateStr,
        expiryDate: expiryDateStr,
        status: 'active',
        visualSignature,
        checksum,
        userId: currentUser.id
      });

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        registrationId: docRef.id,
        userId: currentUser.id,
        userName: currentUser.name,
        ip: 'client', // IP is hard to get reliably from client side without a third-party service
        timestamp: new Date().toISOString(),
        action: 'Cadastro Inicial'
      });

      setRegisteredData({ fullName: data.fullName, cpf: data.cpf });
      reset();
      useAppStore.getState().fetchRegistrations();
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao enviar formulário: ${error.message}`);
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
          <p className="text-[#86868B] mb-8">A Carteira de Identificação da Pessoa com Fibromialgia foi gerada e já está ativa.</p>

          <div className="bg-gray-50/50 rounded-2xl p-6 text-left mb-8 border border-gray-100/50">
            <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-4">Detalhes do Registro</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#86868B]">Titular</p>
                <p className="font-medium text-[#1D1D1F]">{registeredData.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-[#86868B]">CPF</p>
                <p className="font-medium text-[#1D1D1F]">{registeredData.cpf}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-sm text-[#1D1D1F]">
              <strong className="font-semibold">Próximos passos:</strong> A carteirinha já está disponível para consulta e impressão. Acesse a aba <strong>Carteirinha</strong> e busque pelo nome ou CPF do titular.
            </p>
            <Button
              onClick={() => setRegisteredData(null)}
              className="w-full sm:w-auto rounded-xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98]"
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
        <h2 className="text-3xl font-semibold text-[#1D1D1F] tracking-tight">Nova Emissão de CIPF</h2>
        <p className="text-[#86868B] mt-2 text-lg">
          Preencha os dados abaixo para solicitar a Carteira de Identificação da Pessoa com Fibromialgia.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden">
        <div className="p-8 md:p-12">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
            
            {/* Identificação do Titular */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/50">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Identificação do Titular</h3>
                <p className="mt-2 text-sm text-[#86868B] leading-relaxed">Informações pessoais e de contato do beneficiário.</p>
              </div>
              <div className="md:col-span-2 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName" className="text-[#86868B] ml-1">Nome Completo</Label>
                  <Input id="fullName" {...register('fullName')} placeholder="Ex: MARIA DA SILVA" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.fullName && <p className="text-sm text-red-500 ml-1">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-[#86868B] ml-1">CPF</Label>
                  <Input id="cpf" {...register('cpf')} onChange={(e) => {
                    const val = formatCPF(e.target.value);
                    e.target.value = val;
                    setValue('cpf', val, { shouldValidate: true });
                  }} placeholder="000.000.000-00" maxLength={14} className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.cpf && <p className="text-sm text-red-500 ml-1">{errors.cpf.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[#86868B] ml-1">Telefone</Label>
                  <Input id="phone" {...register('phone')} onChange={(e) => {
                    const val = formatPhone(e.target.value);
                    e.target.value = val;
                    setValue('phone', val, { shouldValidate: true });
                  }} placeholder="(00) 00000-0000" maxLength={15} className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.phone && <p className="text-sm text-red-500 ml-1">{errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate" className="text-[#86868B] ml-1">Data de Nascimento</Label>
                  <Input id="birthDate" {...register('birthDate')} onChange={(e) => {
                    const val = formatDate(e.target.value);
                    e.target.value = val;
                    setValue('birthDate', val, { shouldValidate: true });
                  }} placeholder="DD/MM/AAAA" maxLength={10} className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.birthDate && <p className="text-sm text-red-500 ml-1">{errors.birthDate.message}</p>}
                </div>
                {isMinor() && (
                  <div className="space-y-2 sm:col-span-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="legalGuardian" className="text-[#86868B] ml-1">Nome do Responsável Legal (Obrigatório para menores de 18 anos)</Label>
                    <Input id="legalGuardian" {...register('legalGuardian')} placeholder="Ex: JOÃO DA SILVA" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                    {errors.legalGuardian && <p className="text-sm text-red-500 ml-1">{errors.legalGuardian.message}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/50">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Endereço</h3>
                <p className="mt-2 text-sm text-[#86868B] leading-relaxed">Endereço de residência do beneficiário.</p>
              </div>
              <div className="md:col-span-2 grid gap-5 sm:grid-cols-4">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="cep" className="text-[#86868B] ml-1">CEP</Label>
                  <Input id="cep" {...register('cep')} onBlur={handleCepBlur} onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
                    e.target.value = val;
                    setValue('cep', val, { shouldValidate: true });
                  }} placeholder="00000-000" className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.cep && <p className="text-sm text-red-500 ml-1">{errors.cep.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor="logradouro" className="text-[#86868B] ml-1">Logradouro</Label>
                  <Input id="logradouro" {...register('logradouro')} placeholder="Rua, Avenida, etc." className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.logradouro && <p className="text-sm text-red-500 ml-1">{errors.logradouro.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bairro" className="text-[#86868B] ml-1">Bairro</Label>
                  <Input id="bairro" {...register('bairro')} placeholder="Bairro" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.bairro && <p className="text-sm text-red-500 ml-1">{errors.bairro.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="cidade" className="text-[#86868B] ml-1">Cidade</Label>
                  <Input id="cidade" {...register('cidade')} placeholder="Cidade" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.cidade && <p className="text-sm text-red-500 ml-1">{errors.cidade.message}</p>}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="estado" className="text-[#86868B] ml-1">UF</Label>
                  <Input id="estado" {...register('estado')} placeholder="SP" maxLength={2} className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.estado && <p className="text-sm text-red-500 ml-1">{errors.estado.message}</p>}
                </div>
              </div>
            </div>

            {/* Documentação Digitalizada */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/50">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Documentação</h3>
                <p className="mt-2 text-sm text-[#86868B] leading-relaxed">Anexe os documentos de identificação e residência.</p>
              </div>
              <div className="md:col-span-2 grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="documentFile" className="text-[#86868B]">Documento Oficial com Foto e CPF</Label>
                    {documentFileValue && documentFileValue.length > 0 && <span className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Anexado</span>}
                  </div>
                  <div className="relative group">
                    <Input id="documentFile" type="file" accept=".pdf,image/*" {...register('documentFile')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`flex items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors h-16 ${documentFileValue && documentFileValue.length > 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                      <UploadCloud className={`w-5 h-5 ${documentFileValue && documentFileValue.length > 0 ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                      <span className={`text-sm font-medium ${documentFileValue && documentFileValue.length > 0 ? 'text-green-700' : 'text-gray-500 group-hover:text-blue-600'}`}>
                        {documentFileValue && documentFileValue.length > 0 ? 'Arquivo selecionado' : 'Clique para anexar'}
                      </span>
                    </div>
                  </div>
                  {errors.documentFile && <p className="text-sm text-red-500 ml-1">{errors.documentFile.message as string}</p>}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="proofOfResidenceFile" className="text-[#86868B]">Comprovante de Residência</Label>
                    {proofOfResidenceFileValue && proofOfResidenceFileValue.length > 0 && <span className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Anexado</span>}
                  </div>
                  <div className="relative group">
                    <Input id="proofOfResidenceFile" type="file" accept=".pdf,image/*" {...register('proofOfResidenceFile')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`flex items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors h-16 ${proofOfResidenceFileValue && proofOfResidenceFileValue.length > 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                      <UploadCloud className={`w-5 h-5 ${proofOfResidenceFileValue && proofOfResidenceFileValue.length > 0 ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                      <span className={`text-sm font-medium ${proofOfResidenceFileValue && proofOfResidenceFileValue.length > 0 ? 'text-green-700' : 'text-gray-500 group-hover:text-blue-600'}`}>
                        {proofOfResidenceFileValue && proofOfResidenceFileValue.length > 0 ? 'Arquivo selecionado' : 'Clique para anexar'}
                      </span>
                    </div>
                  </div>
                  {errors.proofOfResidenceFile && <p className="text-sm text-red-500 ml-1">{errors.proofOfResidenceFile.message as string}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proofOfResidenceDate" className="text-[#86868B] ml-1">Data do Comprovante (Máx. 90 dias)</Label>
                  <Input id="proofOfResidenceDate" {...register('proofOfResidenceDate')} onChange={(e) => {
                    const val = formatDate(e.target.value);
                    e.target.value = val;
                    setValue('proofOfResidenceDate', val, { shouldValidate: true });
                  }} placeholder="DD/MM/AAAA" maxLength={10} className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                  {errors.proofOfResidenceDate && <p className="text-sm text-red-500 ml-1">{errors.proofOfResidenceDate.message}</p>}
                </div>
              </div>
            </div>

            {/* Validação Médica */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-gray-100/50">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Validação Médica</h3>
                <p className="mt-2 text-sm text-[#86868B] leading-relaxed">Laudo médico e informações do profissional.</p>
              </div>
              <div className="md:col-span-2">
                <div className="rounded-2xl bg-blue-50/80 backdrop-blur-sm p-4 text-sm text-blue-800 mb-6 flex gap-3 border border-blue-100">
                  <AlertCircle className="h-5 w-5 shrink-0 text-blue-500" />
                  <p>O laudo deve ser assinado por reumatologista, contendo obrigatoriamente o <strong className="font-semibold">CID 10 - M79.7</strong> e CRM do profissional.</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="space-y-3 sm:col-span-3">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="medicalReportFile" className="text-[#86868B]">Laudo Médico</Label>
                      {medicalReportFileValue && medicalReportFileValue.length > 0 && <span className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Anexado</span>}
                    </div>
                    <div className="relative group">
                      <Input id="medicalReportFile" type="file" accept=".pdf,image/*" {...register('medicalReportFile')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className={`flex items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors h-16 ${medicalReportFileValue && medicalReportFileValue.length > 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                        <UploadCloud className={`w-5 h-5 ${medicalReportFileValue && medicalReportFileValue.length > 0 ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                        <span className={`text-sm font-medium ${medicalReportFileValue && medicalReportFileValue.length > 0 ? 'text-green-700' : 'text-gray-500 group-hover:text-blue-600'}`}>
                          {medicalReportFileValue && medicalReportFileValue.length > 0 ? 'Arquivo selecionado' : 'Clique para anexar'}
                        </span>
                      </div>
                    </div>
                    {errors.medicalReportFile && <p className="text-sm text-red-500 ml-1">{errors.medicalReportFile.message as string}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cid" className="text-[#86868B] ml-1">CID 10</Label>
                    <Input id="cid" {...register('cid')} placeholder="M79.7" className="uppercase rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                    {errors.cid && <p className="text-sm text-red-500 ml-1">{errors.cid.message}</p>}
                  </div>
                  {cidValue && cidValue.toUpperCase() !== 'M79.7' && (
                    <div className="space-y-2 sm:col-span-3 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="justificativaCid" className="text-amber-600 font-medium ml-1 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Justificativa Médica (Obrigatório para CID diferente de M79.7)
                      </Label>
                      <Input id="justificativaCid" {...register('justificativaCid')} placeholder="Justificativa para emissão da carteira com este CID" className="rounded-xl bg-amber-50/30 border-amber-200 focus:bg-white transition-colors h-12" />
                      {errors.justificativaCid && <p className="text-sm text-red-500 ml-1">{errors.justificativaCid.message}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="medicalReportDate" className="text-[#86868B] ml-1">Data de Emissão do Laudo</Label>
                    <Input id="medicalReportDate" {...register('medicalReportDate')} onChange={(e) => {
                      const val = formatDate(e.target.value);
                      e.target.value = val;
                      setValue('medicalReportDate', val, { shouldValidate: true });
                    }} placeholder="DD/MM/AAAA" maxLength={10} className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                    {errors.medicalReportDate && <p className="text-sm text-red-500 ml-1">{errors.medicalReportDate.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crm" className="text-[#86868B] ml-1">CRM do Médico</Label>
                    <Input id="crm" {...register('crm')} placeholder="Ex: 12345-SP" className="rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12" />
                    {errors.crm && <p className="text-sm text-red-500 ml-1">{errors.crm.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Foto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-4">
              <div className="md:col-span-1">
                <h3 className="text-lg font-medium text-[#1D1D1F]">Fotografia</h3>
                <p className="mt-2 text-sm text-[#86868B] leading-relaxed">Foto 3x4 recente, colorida e com fundo branco.</p>
              </div>
              <div className="md:col-span-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="photoFile" className="text-[#86868B]">Anexar Foto</Label>
                    {photoFileValue && photoFileValue.length > 0 && <span className="flex items-center text-xs text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1" /> Anexada</span>}
                  </div>
                  <div className="relative group">
                    <Input id="photoFile" type="file" accept="image/*" {...register('photoFile')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`flex items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors h-16 ${photoFileValue && photoFileValue.length > 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                      <UploadCloud className={`w-5 h-5 ${photoFileValue && photoFileValue.length > 0 ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                      <span className={`text-sm font-medium ${photoFileValue && photoFileValue.length > 0 ? 'text-green-700' : 'text-gray-500 group-hover:text-blue-600'}`}>
                        {photoFileValue && photoFileValue.length > 0 ? 'Arquivo selecionado' : 'Clique para anexar'}
                      </span>
                    </div>
                  </div>
                  {errors.photoFile && <p className="text-sm text-red-500 ml-1">{errors.photoFile.message as string}</p>}
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-xl h-12 px-10 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Registrar CIPF'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
