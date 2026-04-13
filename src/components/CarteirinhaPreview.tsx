import React, { useState, forwardRef } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CIPFRegistration } from '@/store/useAppStore';

interface CarteirinhaPreviewProps {
  registration: CIPFRegistration;
  photoDataUri: string;
  onImageLoad?: () => void;
}

export const CarteirinhaPreview = forwardRef<HTMLDivElement, CarteirinhaPreviewProps>(
  ({ registration, photoDataUri, onImageLoad }, ref) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    const handleImageLoad = () => {
      setIsImageLoaded(true);
      if (onImageLoad) onImageLoad();
    };

    // Format the ID to look like a registration number (e.g., first 8 chars)
    const formatRegistro = (id: string) => {
      return id.substring(0, 8).toUpperCase();
    };

    // Helper to get a valid, publicly accessible URL for the QR Code
    const getBaseUrl = () => {
      try {
        const origin = window.location.origin;
        
        // If running in a sandboxed iframe where origin is null
        if (!origin || origin === 'null') {
          return 'https://ais-pre-geuns4xwjglsjownoqyjdq-511970797741.us-east1.run.app';
        }
        
        // Convert AI Studio private dev URL to public shared URL so phones can access it
        if (origin.includes('ais-dev-')) {
          return origin.replace('ais-dev-', 'ais-pre-');
        }
        
        return origin;
      } catch (e) {
        return 'https://ais-pre-geuns4xwjglsjownoqyjdq-511970797741.us-east1.run.app';
      }
    };

    const validationUrl = registration ? `${getBaseUrl()}/valida?id=${registration.id}&sig=${registration.visualSignature || ''}` : '';

    return (
      <div ref={ref} className="flex flex-col gap-8 p-4 bg-[#ffffff]">
        {/* Frente da Carteirinha */}
        <div className="w-[8.5cm] h-[5.4cm] rounded-lg border border-gray-300 bg-white shadow-2xl relative flex flex-col print:shadow-none print:border-gray-400 print:mb-[1cm] print:mx-auto overflow-hidden" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          
          {/* Background Pattern / Watermark */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center overflow-hidden">
            <div className="w-64 h-64 border-[40px] border-blue-900 rounded-full absolute -right-16 -bottom-16"></div>
            <div className="w-48 h-48 border-[20px] border-indigo-900 rounded-full absolute -left-12 -top-12"></div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100/50 relative z-10">
            {/* Logo Left */}
            <div className="flex flex-col items-center justify-center w-12">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center mb-0.5 relative overflow-hidden shadow-sm border border-blue-200">
                <div className="absolute bottom-0 w-full h-2.5 bg-green-500"></div>
                <div className="w-3.5 h-3.5 bg-yellow-400 rounded-sm z-10 shadow-sm"></div>
              </div>
              <span className="text-[4px] font-extrabold uppercase leading-tight text-center text-blue-950 tracking-wider">Prefeitura de<br/>Iperó</span>
            </div>

            {/* Center Title */}
            <div className="flex-1 text-center px-1">
              <h2 className="text-[8.5px] font-extrabold text-blue-950 leading-tight uppercase tracking-wide">Carteira de Identificação<br/>Pessoa com Fibromialgia</h2>
              <div className="inline-block bg-indigo-100/80 px-2 py-0.5 rounded-full mt-0.5 border border-indigo-200/50">
                <p className="text-[5.5px] font-bold text-indigo-800 uppercase tracking-widest">CID. {registration.cid || 'M79.7'}</p>
              </div>
            </div>

            {/* Right Info */}
            <div className="w-16 text-right flex flex-col items-end">
              <p className="text-[5px] font-bold text-gray-500 uppercase tracking-widest">Nº Registro</p>
              <p className="text-[7.5px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 mt-0.5">{formatRegistro(registration.id)}/{new Date().getFullYear()}</p>
            </div>
          </div>

          {/* Colored Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 relative z-10 shadow-sm"></div>

          {/* Body */}
          <div className="flex-1 flex flex-col px-3 py-2 gap-1.5 relative z-10 bg-gradient-to-b from-white to-gray-50/50">
            
            {/* Nome Row */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[6px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">Nome do Titular</span>
              <div className="w-full bg-white border border-gray-200 shadow-sm h-5 rounded px-1.5 flex items-center">
                <span className="text-[8.5px] font-bold text-gray-900 truncate">{registration.fullName}</span>
              </div>
            </div>

            {/* Photo and Details Row */}
            <div className="flex gap-2.5 flex-1 mt-0.5">
              {/* Photo */}
              <div className="w-[1.9cm] h-[2.5cm] bg-white border border-gray-300 shadow-sm rounded overflow-hidden relative flex-shrink-0 p-0.5">
                <div className="w-full h-full rounded-sm overflow-hidden relative bg-gray-50">
                  {!isImageLoaded && photoDataUri && (
                    <div className="absolute inset-0 flex items-center justify-center text-blue-300 bg-blue-50/50 z-10">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                  {photoDataUri ? (
                    <img 
                      src={photoDataUri} 
                      alt="Foto" 
                      loading="lazy"
                      onLoad={handleImageLoad}
                      onError={handleImageLoad}
                      className={`w-full h-full object-cover transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`} 
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 flex flex-col justify-between py-0.5">
                {/* DN and CPF */}
                <div className="flex gap-1.5">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[5.5px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">Data Nasc.</span>
                    <div className="flex-1 bg-white border border-gray-200 shadow-sm h-4.5 rounded px-1 flex items-center">
                      <span className="text-[7.5px] font-bold text-gray-900">{registration.birthDate}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[5.5px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">CPF</span>
                    <div className="flex-1 bg-white border border-gray-200 shadow-sm h-4.5 rounded px-1 flex items-center">
                      <span className="text-[7.5px] font-bold text-gray-900">{registration.cpf}</span>
                    </div>
                  </div>
                </div>

                {/* CNS */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[5.5px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">Cartão Nacional de Saúde (CNS)</span>
                  <div className="w-full bg-white border border-gray-200 shadow-sm h-4.5 rounded px-1 flex items-center">
                    <span className="text-[7.5px] font-bold text-gray-900"></span>
                  </div>
                </div>

                {/* Emissão e Validade */}
                <div className="flex gap-1.5">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[5.5px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">Emissão</span>
                    <div className="flex-1 bg-white border border-gray-200 shadow-sm h-4.5 rounded px-1 flex items-center">
                      <span className="text-[7.5px] font-bold text-gray-900">{registration.issueDate}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[5.5px] font-bold text-gray-500 uppercase tracking-widest ml-0.5">Validade</span>
                    <div className="flex-1 bg-white border border-gray-200 shadow-sm h-4.5 rounded px-1 flex items-center">
                      <span className="text-[7.5px] font-bold text-gray-900">{registration.expiryDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="h-7 flex items-center justify-between px-4 relative pb-1 bg-gray-100/50 border-t border-gray-200/50 z-10">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></div>
              <p className="text-[5px] font-bold text-gray-600 uppercase tracking-widest">Válido em todo território municipal</p>
            </div>
            <div className="text-right">
              <p className="text-[6px] font-bold text-gray-800">Secretaria Municipal de Saúde</p>
              <p className="text-[5px] font-bold text-gray-500">Lei Municipal nº 2.690/2026</p>
            </div>
          </div>
        </div>

        {/* Verso da Carteirinha */}
        <div className="w-[8.5cm] h-[5.4cm] rounded-lg border border-gray-300 bg-white shadow-2xl relative flex flex-col p-0 print:shadow-none print:border-gray-400 print:mx-auto overflow-hidden" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          
          {/* Magnetic Stripe Fake */}
          <div className="w-full h-8 bg-gray-900 mt-3 mb-2"></div>

          <div className="flex-1 flex flex-col px-4 pb-3">
            <div className="flex justify-between items-start z-10 flex-1">
              <div className="space-y-2.5 flex-1 pr-4">
                <div>
                  <p className="text-[6px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Registro CIPF</p>
                  <p className="text-[10px] font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 inline-block">{formatRegistro(registration.id)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[6px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Emissão</p>
                    <p className="text-[8px] font-bold text-gray-800">{registration.issueDate}</p>
                  </div>
                  <div>
                    <p className="text-[6px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Validade</p>
                    <p className="text-[8px] font-bold text-gray-800">{registration.expiryDate}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-[5px] text-gray-500 uppercase tracking-widest mb-0.5">Assinatura Digital (Hash)</p>
                  <p className="text-[6px] font-mono font-bold tracking-widest text-gray-700 break-all">{registration.visualSignature || '------'}</p>
                </div>
              </div>

              <div className="flex flex-col items-end justify-start pt-1">
                <div className="p-1.5 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                  <QRCodeSVG 
                    value={validationUrl} 
                    size={60}
                    level="Q"
                    className="text-gray-900"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center mt-1.5 w-full">
                  <p className="text-[5px] text-gray-500 uppercase tracking-widest font-bold">Validar Autenticidade</p>
                </div>
              </div>
            </div>
            
            <div className="text-[6px] text-gray-600 text-justify leading-[1.5] mt-2 z-10 bg-gray-50 p-1.5 rounded border border-gray-100">
              <span className="font-bold text-gray-800">ATENÇÃO:</span> Esta carteira é de uso pessoal e intransferível, válida em todo o território municipal. 
              Garante atendimento prioritário em órgãos públicos, empresas públicas, empresas concessionárias 
              de serviços públicos e empresas privadas, conforme Lei Municipal nº 2.690/2026. Em caso de perda ou roubo, comunicar imediatamente à Secretaria de Saúde.
            </div>

            {/* Fake Barcode at bottom */}
            <div className="mt-2 w-full h-4 flex items-center justify-center opacity-40">
              <div className="w-full h-full" style={{ backgroundImage: 'repeating-linear-gradient(to right, #000, #000 1px, transparent 1px, transparent 3px, #000 3px, #000 4px, transparent 4px, transparent 5px, #000 5px, #000 7px, transparent 7px, transparent 8px)' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CarteirinhaPreview.displayName = 'CarteirinhaPreview';
