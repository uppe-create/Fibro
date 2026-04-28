import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CIPFRegistration, useAppStore } from '@/store/useAppStore';
import { Search, FileBadge2, Loader2, Image as ImageIcon } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';
import { loadCipfFileDataUri } from '@/lib/cipf-files';
import { hasPermission } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';
import { getStatusLabel, isPrintableStatus, normalizeRegistrationStatus } from '@/lib/registration-status';

const PRINT_REGISTRATION_STORAGE_KEY = 'cipf_print_registration_id';

export function Carteirinha() {
  const { registrations, fetchRegistrations, currentUser } = useAppStore();
  const canPrintCarteirinha = hasPermission(currentUser, 'printCarteirinha');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState<CIPFRegistration | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string>('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const queryParams = new URLSearchParams(window.location.search);
  const searchFromUrlRef = useRef(
    queryParams.get('id') || sessionStorage.getItem(PRINT_REGISTRATION_STORAGE_KEY) || queryParams.get('search') || ''
  );

  if (!canPrintCarteirinha) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-red-800">
        <h2 className="text-xl font-black">Impressao restrita</h2>
        <p className="mt-2 text-sm">
          Por protecao de dados e LGPD, somente o perfil Administrador pode visualizar e baixar carteirinhas para impressao.
        </p>
      </div>
    );
  }

  useEffect(() => {
    const bootstrap = async () => {
      if (registrations.length === 0) {
        setIsLoading(true);
        await fetchRegistrations();
        setIsLoading(false);
      }

      if (searchFromUrlRef.current) {
        setSearchTerm(searchFromUrlRef.current);
      }
    };
    bootstrap();
  }, [fetchRegistrations, registrations.length]);

  useEffect(() => {
    if (!searchFromUrlRef.current || registrations.length === 0) return;
    handleSearch(searchFromUrlRef.current);
    sessionStorage.removeItem(PRINT_REGISTRATION_STORAGE_KEY);
    window.history.replaceState({}, '', '/carteirinha');
    searchFromUrlRef.current = '';
  }, [registrations.length]);

  const handleSearch = async (termToSearch?: string) => {
    const term = typeof termToSearch === 'string' ? termToSearch : searchTerm;
    
    if (!term.trim()) {
      setSelectedReg(null);
      setPhotoDataUri('');
      setIsImageLoaded(false);
      return;
    }
    
    const normalizedTerm = term.trim().toLowerCase();
    const digitsTerm = term.replace(/\D/g, '');

    const found = registrations.find(r =>
      r.id === term ||
      r.cpf.includes(digitsTerm || term) ||
      (r.cns || '').includes(digitsTerm || term) ||
      r.fullName.toLowerCase().includes(normalizedTerm)
    );
    
    setIsImageLoaded(false);
    
    if (found) {
      if (!isPrintableStatus(found.status)) {
        alert(`Cadastro encontrado, mas o status atual e "${getStatusLabel(found.status)}". Apenas carteirinhas aprovadas ou emitidas podem ser impressas.`);
        setSelectedReg(null);
        setPhotoDataUri('');
        return;
      }
      setSelectedReg(found);
      setSearchTerm(found.fullName);
      const photoUri = await loadCipfFileDataUri(found.photoFileId, found.photoUrl || '');
      setPhotoDataUri(photoUri);
    } else {
      alert('Nenhum cadastro encontrado com este nome ou CPF.');
      setSelectedReg(null);
      setPhotoDataUri('');
    }
  };

  const handlePrint = async () => {
    if (!printRef.current || !selectedReg) return;
    if (!canPrintCarteirinha) {
      alert('Seu perfil nao permite baixar carteirinhas.');
      return;
    }
    
    try {
      setIsPrinting(true);
      if (normalizeRegistrationStatus(selectedReg.status) === 'approved') {
        const issueDate = new Date();
        const expiryDate = new Date(issueDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        const payload = {
          status: 'issued',
          issueDate: issueDate.toLocaleDateString('pt-BR'),
          expiryDate: expiryDate.toLocaleDateString('pt-BR')
        };
        const { error: registrationError } = await supabase.from('registrations').update(payload).eq('id', selectedReg.id);
        if (registrationError) throw registrationError;
        const { error: publicError } = await supabase.from('public_validations').update(payload).eq('id', selectedReg.id);
        if (publicError) throw publicError;
        const { error: indexError } = await supabase
          .from('registration_index')
          .update({ status: 'issued', updated_at: new Date().toISOString() })
          .eq('cpf', selectedReg.cpf.replace(/\D/g, ''));
        if (indexError) throw indexError;

        await logAuditEvent({
          action: 'Carteirinha Emitida',
          registrationId: selectedReg.id,
          userId: currentUser?.id || null,
          userName: currentUser?.name || 'Sistema',
          reason: 'Download PNG pelo modulo Carteirinha'
        });

        setSelectedReg({ ...selectedReg, ...payload, status: 'issued' });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await fetchRegistrations();
      }
      
      // Capture the element as a PNG using html-to-image
      const dataUrl = await htmlToImage.toPng(printRef.current, {
        quality: 1.0,
        pixelRatio: 3, // Higher scale for better print quality
        backgroundColor: '#ffffff',
      });
      
      // Create a download link for the image
      const link = document.createElement('a');
      link.download = `CIPF_${selectedReg.cpf.replace(/\D/g, '')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      alert('Ocorreu um erro ao gerar o arquivo para impressão. Tente novamente.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden print:hidden">
        <div className="p-8 text-center border-b border-gray-100/50">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileBadge2 className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Consulta de Carteirinha</h2>
          <p className="text-[#86868B] mt-1">Busque por um cadastro aprovado ou emitido para gerar a CIPF.</p>
        </div>
        <div className="p-8 bg-gray-50/30">
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#86868B]" />
              <Input 
                placeholder="Digite o Nome completo ou CPF do titular..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-12 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-2xl h-14 text-base shadow-sm"
                disabled={isLoading}
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isLoading || !searchTerm.trim()}
              className="rounded-2xl h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98]"
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
              disabled={!canPrintCarteirinha || isPrinting || (!!photoDataUri && !isImageLoaded)}
              className="rounded-xl h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Imagem...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Baixar Imagem (PNG)
                </>
              )}
            </Button>
          </div>

          {/* Container for printing - ensures correct sizing on paper */}
          <div className="flex flex-col items-center justify-center gap-8 print:block print:w-full">
            <CarteirinhaPreview 
              ref={printRef} 
              registration={selectedReg} 
              photoDataUri={photoDataUri} 
              onImageLoad={() => setIsImageLoaded(true)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
