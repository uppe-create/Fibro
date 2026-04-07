import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { Search, Printer, FileBadge2, Loader2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function Carteirinha() {
  const { registrations, fetchRegistrations } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchRegistrations();
      setIsLoading(false);
    };

    if (registrations.length === 0) {
      loadData();
    }
  }, []);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSelectedReg(null);
      return;
    }
    
    const found = registrations.find(r => 
      r.cpf.includes(searchTerm) || r.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (found) {
      setSelectedReg(found);
    } else {
      alert('Nenhum cadastro encontrado com este nome ou CPF.');
      setSelectedReg(null);
    }
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    
    try {
      setIsPrinting(true);
      
      // Capture the element as a canvas
      const canvas = await html2canvas(printRef.current, {
        scale: 3, // Higher scale for better print quality
        useCORS: true, // Allow loading images from Firebase Storage
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF (A4 size)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate dimensions to fit the cards nicely on the page
      const imgProps = pdf.getImageProperties(imgData);
      const margin = 20; // 20mm margin
      const availableWidth = pdfWidth - (margin * 2);
      
      const ratio = imgProps.width / imgProps.height;
      const renderWidth = availableWidth;
      const renderHeight = renderWidth / ratio;
      
      // Add title and instructions to the PDF
      pdf.setFontSize(16);
      pdf.text('Carteira de Identificação da Pessoa com Fibromialgia', pdfWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text('Recorte nas linhas indicadas e dobre ao meio para plastificar.', pdfWidth / 2, 28, { align: 'center' });
      
      // Add the captured image
      pdf.addImage(imgData, 'PNG', margin, 40, renderWidth, renderHeight);
      
      // Save the PDF
      pdf.save(`CIPF_${selectedReg.cpf.replace(/\D/g, '')}.pdf`);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o arquivo para impressão. Tente novamente.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Format the ID to look like a registration number (e.g., first 8 chars)
  const formatRegistro = (id: string) => {
    return id.substring(0, 8).toUpperCase();
  };

  // Helper to get a valid, publicly accessible URL for the QR Code
  const getBaseUrl = () => {
    try {
      let url = window.location.origin;
      
      // If running in a sandboxed iframe where origin is null
      if (!url || url === 'null') {
        url = 'https://ais-pre-geuns4xwjglsjownoqyjdq-511970797741.us-east1.run.app';
      }
      
      // Convert AI Studio private dev URL to public shared URL so phones can access it
      if (url.includes('ais-dev-')) {
        url = url.replace('ais-dev-', 'ais-pre-');
      }
      
      return url;
    } catch (e) {
      return 'https://ais-pre-geuns4xwjglsjownoqyjdq-511970797741.us-east1.run.app';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden print:hidden">
        <div className="p-6 md:p-8 border-b border-gray-100/50">
          <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Gerar Carteirinha</h2>
          <p className="text-[#86868B] mt-1">Busque por um cadastro ativo para visualizar e imprimir a CIPF.</p>
        </div>
        <div className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868B]" />
              <Input 
                placeholder="Buscar por Nome ou CPF..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors rounded-xl h-12"
                disabled={isLoading}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isLoading}
              className="rounded-xl h-12 px-6 bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-sm transition-all active:scale-[0.98]"
            >
              Buscar
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#86868B]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
          <p className="text-lg font-medium text-[#1D1D1F]">Carregando registros...</p>
        </div>
      ) : selectedReg && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-end print:hidden">
            <Button 
              onClick={handlePrint} 
              disabled={isPrinting}
              className="rounded-xl h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98]"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF para Impressão
                </>
              )}
            </Button>
          </div>

          {/* Container for printing - ensures correct sizing on paper */}
          <div className="flex flex-col items-center justify-center gap-8 print:block print:w-full">
            
            <div ref={printRef} className="flex flex-col gap-8 p-4 bg-[#ffffff]">
              {/* Frente da Carteirinha */}
            <div className="w-[8.5cm] h-[5.4cm] rounded-xl border border-[#d1d5db] bg-[#ffffff] shadow-lg relative overflow-hidden flex flex-col print:shadow-none print:border-[#9ca3af] print:mb-[1cm] print:mx-auto" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              {/* Header */}
              <div className="w-full h-10 bg-[#1d4ed8] flex items-center justify-center shrink-0">
                <h2 className="text-[#ffffff] font-bold text-[10px] tracking-widest uppercase">Secretaria Municipal de Saúde</h2>
              </div>
              
              <div className="flex-1 flex p-3 gap-3">
                {/* Photo */}
                <div className="w-[2.5cm] h-[3.33cm] bg-[#f3f4f6] rounded border border-[#e5e7eb] shrink-0 overflow-hidden">
                  <img src={selectedReg.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                </div>
                
                {/* Info */}
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">Nome do Beneficiário</p>
                    <p className="text-[10px] font-bold leading-tight text-[#111827] mt-0.5 whitespace-normal break-words">{selectedReg.fullName}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">CPF</p>
                      <p className="text-[10px] font-bold text-[#111827]">{selectedReg.cpf}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">Nascimento</p>
                      <p className="text-[10px] font-bold text-[#111827]">{selectedReg.birthDate}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">CID 10</p>
                    <p className="text-[10px] font-bold text-[#111827]">{selectedReg.cid || 'M79.7'}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-8 bg-[#f9fafb] border-t border-[#e5e7eb] flex items-center justify-center shrink-0">
                <p className="text-[10px] font-bold text-[#1e40af] tracking-wide uppercase">Pessoa com Fibromialgia</p>
              </div>
            </div>

            {/* Verso da Carteirinha */}
            <div className="w-[8.5cm] h-[5.4cm] rounded-xl border border-[#d1d5db] bg-[#ffffff] shadow-lg relative flex flex-col justify-between p-4 print:shadow-none print:border-[#9ca3af] print:mx-auto" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <div>
                    <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">Registro CIPF</p>
                    <p className="text-xs font-mono font-bold text-[#111827]">{formatRegistro(selectedReg.id)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">Emissão</p>
                      <p className="text-[10px] font-bold text-[#111827]">{selectedReg.issueDate}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-[#6b7280] font-bold uppercase tracking-wider">Validade</p>
                      <p className="text-[10px] font-bold text-[#dc2626]">{selectedReg.expiryDate}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="p-1 bg-[#ffffff] border border-[#e5e7eb] rounded-lg">
                    <QRCodeSVG 
                      value={`${getBaseUrl()}/?id=${selectedReg.id}&sig=${selectedReg.visualSignature || ''}`} 
                      size={56}
                      level="L"
                    />
                  </div>
                  <div className="text-center mt-1 w-full">
                    <p className="text-[7px] text-[#6b7280] uppercase tracking-wider">Assinatura</p>
                    <p className="text-[9px] font-mono font-bold tracking-widest text-[#111827]">{selectedReg.visualSignature || '------'}</p>
                  </div>
                </div>
              </div>
              
              <div className="text-[7px] text-[#4b5563] text-justify leading-tight mt-3">
                Esta carteira é de uso pessoal e intransferível, válida em todo o território municipal. 
                Garante atendimento prioritário em órgãos públicos, empresas públicas, empresas concessionárias 
                de serviços públicos e empresas privadas, conforme Lei Municipal nº 2.690/2026.
              </div>

              <div className="mt-2 text-center border-t border-[#e5e7eb] pt-1.5">
                <p className="text-[7px] text-[#6b7280] font-medium">Verifique a autenticidade pelo QR Code</p>
              </div>
            </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
