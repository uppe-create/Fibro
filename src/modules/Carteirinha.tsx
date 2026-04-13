import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { Search, Printer, FileBadge2, Loader2, Download, Image as ImageIcon } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';

export function Carteirinha() {
  const { registrations, fetchRegistrations } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string>('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchRegistrations();
      setIsLoading(false);
      
      // Auto-search if URL parameter is present
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get('search');
      if (searchParam) {
        setSearchTerm(searchParam);
        // We need to wait a tick for state to update, or just call handleSearch directly with the param
        // But handleSearch uses the searchTerm state. Let's modify handleSearch to accept an optional param.
      }
    };

    if (registrations.length === 0) {
      loadData();
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get('search');
      if (searchParam) {
        setSearchTerm(searchParam);
      }
    }
  }, []);

  // Trigger search when searchTerm is set from URL initially
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam && searchTerm === searchParam && registrations.length > 0) {
      handleSearch(searchParam);
      // Remove param from URL so it doesn't trigger again on refresh
      window.history.replaceState({}, '', '/carteirinha');
    }
  }, [searchTerm, registrations]);

  const handleSearch = async (termToSearch?: string) => {
    const term = typeof termToSearch === 'string' ? termToSearch : searchTerm;
    
    if (!term.trim()) {
      setSelectedReg(null);
      setPhotoDataUri('');
      setIsImageLoaded(false);
      return;
    }
    
    const found = registrations.find(r => 
      r.cpf.includes(term) || r.fullName.toLowerCase().includes(term.toLowerCase())
    );
    
    setIsImageLoaded(false);
    
    if (found) {
      setSelectedReg(found);
      
      // Fetch photo if using the new ID-based system
      if (found.photoFileId) {
        try {
          const docRef = doc(db, 'cipf_files', found.photoFileId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const fileData = docSnap.data();
            if (fileData.data) {
              setPhotoDataUri(fileData.data);
            } else if (fileData.totalChunks) {
              const chunkPromises = [];
              for (let i = 0; i < fileData.totalChunks; i++) {
                chunkPromises.push(getDoc(doc(db, 'cipf_files', found.photoFileId, 'chunks', i.toString())));
              }
              const chunkSnaps = await Promise.all(chunkPromises);
              let fullData = '';
              chunkSnaps.forEach(snap => {
                if (snap.exists()) {
                  fullData += snap.data().data;
                }
              });
              setPhotoDataUri(fullData);
            }
          } else {
            setPhotoDataUri(found.photoUrl || '');
          }
        } catch (e) {
          console.error("Error fetching photo", e);
          setPhotoDataUri(found.photoUrl || '');
        }
      } else {
        setPhotoDataUri(found.photoUrl || '');
      }
    } else {
      alert('Nenhum cadastro encontrado com este nome ou CPF.');
      setSelectedReg(null);
      setPhotoDataUri('');
    }
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    
    try {
      setIsPrinting(true);
      
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

  const validationUrl = selectedReg ? `${getBaseUrl()}/valida?id=${selectedReg.id}&sig=${selectedReg.visualSignature || ''}` : '';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden print:hidden">
        <div className="p-8 text-center border-b border-gray-100/50">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileBadge2 className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Consulta de Carteirinha</h2>
          <p className="text-[#86868B] mt-1">Busque por um cadastro ativo para visualizar e imprimir a CIPF.</p>
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
              disabled={isPrinting || (!!photoDataUri && !isImageLoaded)}
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
