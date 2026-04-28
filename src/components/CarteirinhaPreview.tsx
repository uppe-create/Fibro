import React, { forwardRef, useState } from 'react';
import { BadgeCheck, Image as ImageIcon, Loader2, QrCode, ShieldCheck, Stamp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CIPFRegistration } from '@/store/useAppStore';
import { getAppBaseUrl } from '@/lib/app-url';
import { formatCNS } from '@/lib/utils';
import prefeituraLogo from '@/assets/prefeitura-logo.png';

interface CarteirinhaPreviewProps {
  registration: CIPFRegistration;
  photoDataUri: string;
  onImageLoad?: () => void;
}

const CARD_SIZE = 'w-[8.5cm] h-[5.4cm]';

// Print layout uses physical dimensions. Be careful changing CARD_SIZE or font
// sizes: the PNG export and real-world print depend on this balance.
function formatRegistro(id: string) {
  return id.substring(0, 8).toUpperCase();
}

function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function getSusNumber(registration: CIPFRegistration) {
  const extraData = registration as CIPFRegistration & { cns?: string; cartaoSus?: string; sus?: string };
  const rawNumber = extraData.cns || extraData.cartaoSus || extraData.sus || '';
  return rawNumber ? formatCNS(rawNumber) : 'Nao informado';
}

function Field({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[4.7px] font-black uppercase leading-none text-[#47617d]">{label}</p>
      <div className="mt-[1px] flex h-[15px] items-center border border-[#cbd8e3] bg-white px-1">
        <p className="truncate text-[7px] font-bold leading-none text-[#17324d]">{value || '-'}</p>
      </div>
    </div>
  );
}

export const CarteirinhaPreview = forwardRef<HTMLDivElement, CarteirinhaPreviewProps>(
  ({ registration, photoDataUri, onImageLoad }, ref) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    // QR Code carries only id + visual signature. Sensitive registration fields
    // never travel in the public URL.
    const validationUrl = `${getAppBaseUrl()}/valida?id=${registration.id}&sig=${registration.visualSignature || ''}`;
    const registryNumber = `${formatRegistro(registration.id)}/${new Date().getFullYear()}`;

    const handleImageLoad = () => {
      setIsImageLoaded(true);
      onImageLoad?.();
    };

    return (
      <div ref={ref} className="flex flex-col gap-6 bg-white p-3 print-clean">
        <div
          className={`${CARD_SIZE} print-clean relative flex overflow-hidden border border-[#9fb3c8] bg-[#f8fbfd] shadow-lg print:mx-auto print:mb-[1cm] print:border-gray-400 print:shadow-none`}
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#155c9c_0%,#155c9c_42%,#1f8a58_42%,#1f8a58_76%,#f2c94c_76%,#f2c94c_100%)]" />
          <div className="absolute bottom-0 left-0 top-2 w-[0.42cm] bg-[#155c9c]" />
          <div className="absolute bottom-0 left-[0.42cm] top-2 w-[0.12cm] bg-[#1f8a58]" />
          <div className="pointer-events-none absolute -right-5 bottom-4 text-[48px] font-black tracking-[-0.08em] text-[#17324d]/[0.05]">
            CIPF
          </div>

          <div className="relative flex h-full flex-1 flex-col pl-[0.72cm]">
            <header className="flex h-[0.92cm] shrink-0 items-center justify-between border-b border-[#d7e2ed] bg-white px-2.5 pt-1.5">
              <div className="flex items-center gap-1.5">
                <img src={prefeituraLogo} alt="Prefeitura de Ipero" className="h-[0.55cm] w-[1.22cm] object-contain" />
                <div>
                  <p className="text-[4.6px] font-black uppercase leading-none text-[#1f8a58]">Prefeitura Municipal de Ipero</p>
                  <h2 className="mt-[1px] text-[7.7px] font-black uppercase leading-[1.02] text-[#17324d]">
                    Carteira de Identificacao
                    <br />
                    Pessoa com Fibromialgia
                  </h2>
                </div>
              </div>
              <div className="border border-[#f2c94c] bg-[#fff8dc] px-1.5 py-0.5 text-right">
                <p className="text-[4.4px] font-black uppercase leading-none text-[#7a5a00]">Registro</p>
                <p className="mt-[1px] text-[6.5px] font-black leading-none text-[#17324d]">{registryNumber}</p>
              </div>
            </header>

            <main className="grid h-[3.96cm] shrink-0 grid-cols-[1.88cm_1fr] gap-1.5 px-2.5 py-1.5">
              <div className="flex flex-col gap-1">
                <div className="relative h-[2.35cm] overflow-hidden border-2 border-white bg-[#e9eef5] shadow-sm outline outline-1 outline-[#b7c7d8]">
                  {!isImageLoaded && photoDataUri && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#eaf3fb] text-[#155c9c]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {photoDataUri ? (
                    <img
                      src={photoDataUri}
                      alt="Foto"
                      loading="lazy"
                      onLoad={handleImageLoad}
                      onError={handleImageLoad}
                      className={`h-full w-full object-cover transition-opacity duration-300 ${
                        isImageLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-7 w-7 text-[#9fb3c8]" />
                    </div>
                  )}
                </div>
                <div className="bg-[#155c9c] px-1 py-0.5 text-center text-white">
                  <p className="text-[4.8px] font-black uppercase leading-none">CID {registration.cid || 'M79.7'}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <div>
                  <p className="text-[4.7px] font-black uppercase leading-none text-[#47617d]">Nome do titular</p>
                  <div className="mt-[1px] flex h-[21px] items-center border-l-4 border-[#1f8a58] bg-white px-1.5 shadow-sm">
                    <p className="truncate text-[8.1px] font-black uppercase leading-none text-[#17324d]">{registration.fullName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <Field label="CPF" value={formatCpf(registration.cpf)} />
                  <Field label="Cartao SUS" value={getSusNumber(registration)} />
                </div>

                <div className="border border-[#cbd8e3] bg-[#f6fafc] px-1.5 py-1">
                  <p className="text-[4.7px] font-black uppercase leading-none text-[#47617d]">Municipio emissor</p>
                  <p className="mt-[2px] truncate text-[7.5px] font-black uppercase leading-none text-[#17324d]">
                    {`${registration.cidade || 'IPERO'}${registration.estado ? `/${registration.estado}` : ''}`}
                  </p>
                </div>

                <div className="border-l-4 border-[#f2c94c] bg-[#fff8dc] px-1.5 py-1">
                  <p className="flex items-center gap-1 text-[5.3px] font-bold leading-[1.15] text-[#4a3a08]">
                    <Stamp className="h-2 w-2 shrink-0" />
                    Atendimento prioritario. Datas de emissao e validade no verso.
                  </p>
                </div>
              </div>
            </main>

            <footer className="flex h-[0.44cm] shrink-0 items-center justify-between border-t border-[#d7e2ed] bg-[#eef6f0] px-2.5">
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-2.5 w-2.5 text-[#1f8a58]" />
                <p className="text-[4.8px] font-black uppercase leading-none text-[#17324d]">Documento oficial municipal</p>
              </div>
              <p className="text-[4.7px] font-bold leading-none text-[#47617d]">Secretaria Municipal de Saude</p>
            </footer>
          </div>
        </div>

        <div
          className={`${CARD_SIZE} print-clean relative flex flex-col overflow-hidden border border-[#9fb3c8] bg-white shadow-lg print:mx-auto print:border-gray-400 print:shadow-none`}
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="h-[0.72cm] bg-[linear-gradient(90deg,#17324d_0%,#155c9c_55%,#1f8a58_100%)] px-4 py-2 text-white">
            <p className="text-[8px] font-black uppercase">Validacao digital da CIPF</p>
            <p className="text-[5px] font-semibold uppercase opacity-85">Documento pessoal e intransferivel</p>
          </div>

          <div className="grid flex-1 grid-cols-[1fr_2.3cm] gap-3 px-4 py-3">
            <div className="flex flex-col justify-between">
              <div className="space-y-2">
                <div>
                  <p className="text-[5px] font-black uppercase text-[#47617d]">Registro CIPF</p>
                  <p className="mt-0.5 inline-block border border-[#cbd8e3] bg-[#f6fafc] px-2 py-1 text-[10px] font-black text-[#17324d]">
                    {formatRegistro(registration.id)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Emissao" value={registration.issueDate} />
                  <Field label="Validade" value={registration.expiryDate} />
                </div>

                <div className="border border-[#d7e2ed] bg-[#f8fbfd] p-2">
                  <p className="text-[5px] font-black uppercase text-[#47617d]">Assinatura visual</p>
                  <p className="mt-1 break-all font-mono text-[6.5px] font-black tracking-wide text-[#17324d]">
                    {registration.visualSignature || '------'}
                  </p>
                </div>
              </div>

              <div className="border-l-4 border-[#f2c94c] bg-[#fff8dc] p-2">
                <p className="flex items-start gap-1 text-[6px] font-bold leading-[1.35] text-[#4a3a08]">
                  <ShieldCheck className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                  Apresente esta carteira para identificacao e validacao de prioridade, conforme legislacao municipal vigente.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border border-[#cbd8e3] bg-[#f8fbfd] p-1.5">
              <div className="mb-1 flex items-center gap-1 text-[5px] font-black uppercase text-[#17324d]">
                <QrCode className="h-2.5 w-2.5 text-[#155c9c]" />
                QR oficial
              </div>
              <div className="border border-[#d7e2ed] bg-white p-1.5">
                <QRCodeSVG value={validationUrl} size={74} level="Q" includeMargin={false} />
              </div>
              <p className="mt-2 text-center text-[5px] font-black uppercase leading-tight text-[#47617d]">
                Validar
                <br />
                autenticidade
              </p>
            </div>
          </div>

          <div className="grid h-[0.18cm] grid-cols-3">
            <div className="bg-[#155c9c]" />
            <div className="bg-[#1f8a58]" />
            <div className="bg-[#f2c94c]" />
          </div>
        </div>
      </div>
    );
  }
);

CarteirinhaPreview.displayName = 'CarteirinhaPreview';
