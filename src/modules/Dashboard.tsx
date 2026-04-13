import React, { useState } from 'react';
import { useAppStore, CIPFRegistration } from '@/store/useAppStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Eye, ShieldAlert, FileText, Trash2, Users, Clock, CheckCircle, RefreshCw, Loader2, Download, FileBadge2, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { CarteirinhaPreview } from '@/components/CarteirinhaPreview';

export function Dashboard() {
  const { registrations, currentUser, fetchRegistrations } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReg, setSelectedReg] = useState<CIPFRegistration | null>(null);
  const [viewLogs, setViewLogs] = useState<{ fullName: string, logs: any[] } | null>(null);
  const [regToDelete, setRegToDelete] = useState<CIPFRegistration | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [showClearDbModal, setShowClearDbModal] = useState(false);
  const [clearDbConfirmation, setClearDbConfirmation] = useState('');
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewReg, setPreviewReg] = useState<CIPFRegistration | null>(null);
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [filter, setFilter] = useState<'all' | 'expiring30'>('all');

  React.useEffect(() => {
    loadData();
  }, []);

  const handlePreviewCarteirinha = async (reg: CIPFRegistration) => {
    setPreviewReg(reg);
    setIsPreviewLoading(true);
    setPreviewPhotoUri('');
    
    if (reg.photoFileId) {
      try {
        const docRef = doc(db, 'cipf_files', reg.photoFileId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fileData = docSnap.data();
          if (fileData.data) {
            setPreviewPhotoUri(fileData.data);
          } else if (fileData.totalChunks) {
            const chunkPromises = [];
            for (let i = 0; i < fileData.totalChunks; i++) {
              chunkPromises.push(getDoc(doc(db, 'cipf_files', reg.photoFileId, 'chunks', i.toString())));
            }
            const chunkSnaps = await Promise.all(chunkPromises);
            let fullData = '';
            chunkSnaps.forEach(snap => {
              if (snap.exists()) {
                fullData += snap.data().data;
              }
            });
            setPreviewPhotoUri(fullData);
          }
        } else {
          setPreviewPhotoUri(reg.photoUrl || '');
        }
      } catch (e) {
        console.error("Error fetching photo", e);
        setPreviewPhotoUri(reg.photoUrl || '');
      }
    } else {
      setPreviewPhotoUri(reg.photoUrl || '');
    }
    setIsPreviewLoading(false);
  };

  const loadData = async () => {
    setIsLoading(true);
    await fetchRegistrations();
    setIsLoading(false);
  };

  const isNearExpiry = (expiryDateStr: string, days: number = 60) => {
    const [day, month, year] = expiryDateStr.split('/');
    const expiry = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();
    const diffTime = Math.abs(expiry.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= days;
  };

  const filteredRegistrations = registrations.filter(r => {
    const matchesSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || r.cpf.includes(searchTerm);
    const matchesFilter = filter === 'all' || (filter === 'expiring30' && isNearExpiry(r.expiryDate, 30));
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: registrations.length,
    active: registrations.filter(r => r.status === 'active').length,
    expiring30: registrations.filter(r => isNearExpiry(r.expiryDate, 30)).length
  };

  // Calculate stats for Bairro and Age
  const bairroStats = registrations.reduce((acc, reg) => {
    const bairro = reg.bairro || 'Não Informado';
    acc[bairro] = (acc[bairro] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const ageStats = registrations.reduce((acc, reg) => {
    const [day, month, year] = reg.birthDate.split('/');
    const birthDate = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    let group = '0-18';
    if (age > 18 && age <= 30) group = '19-30';
    else if (age > 30 && age <= 50) group = '31-50';
    else if (age > 50 && age <= 65) group = '51-65';
    else if (age > 65) group = '65+';

    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleViewMedicalDoc = async (reg: CIPFRegistration) => {
    // Check for either the new ID-based system or the old URL-based system
    const fileId = (reg as any).medicalReportFileId;
    const fileUrl = reg.medicalReportUrl;

    if (!fileId && !fileUrl) {
      alert('Documento não encontrado.');
      return;
    }

    try {
      setIsLoading(true);
      let dataUri = fileUrl;

      if (fileId) {
        const docRef = doc(db, 'cipf_files', fileId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fileData = docSnap.data();
          if (fileData.data) {
            dataUri = fileData.data; // Legacy format
          } else if (fileData.totalChunks) {
            const chunkPromises = [];
            for (let i = 0; i < fileData.totalChunks; i++) {
              chunkPromises.push(getDoc(doc(db, 'cipf_files', fileId, 'chunks', i.toString())));
            }
            const chunkSnaps = await Promise.all(chunkPromises);
            let fullData = '';
            chunkSnaps.forEach(snap => {
              if (snap.exists()) {
                fullData += snap.data().data;
              }
            });
            dataUri = fullData;
          }
        } else {
          throw new Error('Arquivo não encontrado no banco de dados.');
        }
      }

      if (dataUri) {
        if (dataUri.startsWith('data:')) {
          // Convert Base64 Data URI to Blob to bypass browser restrictions on opening data URIs directly
          const arr = dataUri.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          
          window.open(blobUrl, '_blank');
        } else {
          // It's a regular URL (e.g., Firebase Storage)
          window.open(dataUri, '_blank');
        }

        // Log access
        if (currentUser) {
          await addDoc(collection(db, 'audit_logs'), {
            registrationId: reg.id,
            userId: currentUser.id,
            userName: currentUser.name,
            ip: 'client',
            timestamp: new Date().toISOString(),
            action: 'Visualização de Laudo Médico'
          });
        }
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao abrir o documento.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLogs = async (reg: CIPFRegistration) => {
    try {
      const q = query(collection(db, 'audit_logs'), where('registrationId', '==', reg.id));
      const querySnapshot = await getDocs(q);
      const logs: any[] = [];
      querySnapshot.forEach((doc) => {
        logs.push(doc.data());
      });
      // Sort by timestamp descending
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setViewLogs({ fullName: reg.fullName, logs });
    } catch (error) {
      console.error(error);
      alert('Acesso negado ou erro ao buscar logs.');
    }
  };

  const handleDeleteClick = (reg: CIPFRegistration) => {
    if (currentUser?.role !== 'admin') {
      alert('Acesso negado: Apenas administradores podem excluir registros.');
      return;
    }
    setRegToDelete(reg);
    setDeleteConfirmationText('');
  };

  const confirmDelete = async () => {
    if (!regToDelete || deleteConfirmationText.trim().toUpperCase() !== regToDelete.fullName.trim().toUpperCase()) return;
    try {
      if (currentUser) {
        await addDoc(collection(db, 'audit_logs'), {
          registrationId: regToDelete.id,
          userId: currentUser.id,
          userName: currentUser.name,
          ip: 'client',
          timestamp: new Date().toISOString(),
          action: 'Exclusão de Registro',
          reason: `Registro de ${regToDelete.fullName} excluído pelo administrador.`
        });
      }

      await deleteDoc(doc(db, 'registrations', regToDelete.id));
      setRegToDelete(null);
      setDeleteConfirmationText('');
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir registro.');
    }
  };

  const handleExport = async () => {
    try {
      await useAppStore.getState().exportDatabase();
    } catch (error) {
      console.error(error);
      alert('Erro ao exportar dados.');
    }
  };

  const handleClearDatabase = async () => {
    if (clearDbConfirmation !== 'EXCLUIR TUDO') return;
    
    try {
      setIsClearingDb(true);
      await useAppStore.getState().clearDatabase();
      setShowClearDbModal(false);
      setClearDbConfirmation('');
      alert('Banco de dados limpo com sucesso.');
      loadData();
    } catch (error: any) {
      alert(error.message || 'Erro ao limpar banco de dados.');
    } finally {
      setIsClearingDb(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-[#1D1D1F] tracking-tight">Gestão de Carteiras</h2>
          <p className="text-[#86868B] mt-1">Acompanhe e gerencie as emissões da CIPF.</p>
        </div>
        <div className="flex gap-3">
          {currentUser?.role === 'admin' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setShowClearDbModal(true)} 
                className="rounded-xl h-11 px-4 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Banco
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExport} 
                className="rounded-xl h-11 px-4 border-gray-200 text-[#1D1D1F] hover:bg-gray-50 transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Base
              </Button>
            </>
          )}
          <Button 
            variant="outline" 
            onClick={loadData} 
            disabled={isLoading}
            className="rounded-xl h-11 px-4 border-gray-200 text-[#1D1D1F] hover:bg-gray-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-6 flex items-center gap-5 transition-transform hover:scale-[1.02] duration-300">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#86868B]">Total Emitidas</p>
            <p className="text-3xl font-semibold text-[#1D1D1F]">{stats.total}</p>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-6 flex items-center gap-5 transition-transform hover:scale-[1.02] duration-300">
          <div className="p-4 bg-green-50 text-green-600 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#86868B]">Ativas</p>
            <p className="text-3xl font-semibold text-[#1D1D1F]">{stats.active}</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-6 flex items-center gap-5 transition-transform hover:scale-[1.02] duration-300 cursor-pointer" onClick={() => setFilter(filter === 'expiring30' ? 'all' : 'expiring30')}>
          <div className={`p-4 rounded-2xl ${filter === 'expiring30' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#86868B]">Vencendo em 30 dias</p>
            <p className="text-3xl font-semibold text-[#1D1D1F]">{stats.expiring30}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-6">
          <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-4">Emissões por Bairro</h3>
          <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
            {Object.entries(bairroStats).sort((a, b) => b[1] - a[1]).map(([bairro, count]) => (
              <div key={bairro} className="flex justify-between items-center">
                <span className="text-sm text-[#1D1D1F] truncate pr-4">{bairro}</span>
                <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded-lg">{count}</span>
              </div>
            ))}
            {Object.keys(bairroStats).length === 0 && <p className="text-sm text-gray-400">Sem dados</p>}
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 p-6">
          <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-4">Faixa Etária</h3>
          <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
            {Object.entries(ageStats).sort((a, b) => a[0].localeCompare(b[0])).map(([group, count]) => (
              <div key={group} className="flex justify-between items-center">
                <span className="text-sm text-[#1D1D1F]">{group} anos</span>
                <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded-lg">{count}</span>
              </div>
            ))}
            {Object.keys(ageStats).length === 0 && <p className="text-sm text-gray-400">Sem dados</p>}
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 overflow-hidden">
        <div className="p-6 border-b border-gray-100/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-[#1D1D1F]">Registros</h3>
            {filter === 'expiring30' && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Filtrando: Vencendo em 30 dias
                <button onClick={() => setFilter('all')} className="ml-1 hover:text-amber-900"><Trash2 className="w-3 h-3" /></button>
              </span>
            )}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#86868B]" />
            <Input 
              placeholder="Buscar por Nome ou CPF..." 
              className="pl-9 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors rounded-xl h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-[#86868B]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-lg font-medium text-[#1D1D1F]">Carregando registros...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-[#86868B]">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-lg font-medium text-[#1D1D1F]">Nenhum registro encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os termos da sua busca.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[#86868B] uppercase bg-gray-50/30">
                <tr>
                  <th className="px-6 py-4 font-medium">Titular</th>
                  <th className="px-6 py-4 font-medium">CPF</th>
                  <th className="px-6 py-4 font-medium">Validade</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50">
                {filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-[#1D1D1F]">{reg.fullName}</td>
                    <td className="px-6 py-4 text-[#86868B] font-mono text-xs">{reg.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.***-**')}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[#86868B]">{reg.expiryDate}</span>
                        {isNearExpiry(reg.expiryDate) && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" title="Próximo do vencimento" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                        reg.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' : 
                        reg.status === 'expired' ? 'bg-red-50 text-red-700 border border-red-100' : 
                        'bg-yellow-50 text-yellow-700 border border-yellow-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          reg.status === 'active' ? 'bg-green-500' : 
                          reg.status === 'expired' ? 'bg-red-500' : 
                          'bg-yellow-500'
                        }`}></span>
                        {reg.status === 'active' ? 'Ativo' : reg.status === 'expired' ? 'Expirado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => handlePreviewCarteirinha(reg)} title="Pré-visualizar Carteirinha">
                          <FileBadge2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleViewMedicalDoc(reg)} title="Ver Laudo Médico">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100" onClick={() => handleViewLogs(reg)} title="Ver Histórico">
                          <ShieldAlert className="h-4 w-4" />
                        </Button>
                        {currentUser?.role === 'admin' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(reg)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Logs */}
      {viewLogs && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-[#1D1D1F]">Histórico de Auditoria</h3>
                <p className="text-sm text-[#86868B] mt-1">{viewLogs.fullName}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setViewLogs(null)} className="rounded-full hover:bg-gray-100 text-gray-500">
                <span className="sr-only">Fechar</span>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              <div className="divide-y divide-gray-100/50">
                {viewLogs.logs.map((log: any, idx: number) => (
                  <div key={idx} className="p-4 hover:bg-gray-50/50 transition-colors rounded-2xl mx-2 my-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-[#1D1D1F]">{log.action}</span>
                      <span className="text-xs text-[#86868B] font-mono">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="text-sm text-[#86868B] grid grid-cols-2 gap-2 mt-2">
                      <div><span className="text-gray-400">Usuário:</span> {log.userName}</div>
                      <div><span className="text-gray-400">IP:</span> <span className="font-mono text-xs">{log.ip}</span></div>
                      {log.reason && <div className="col-span-2"><span className="text-gray-400">Motivo:</span> {log.reason}</div>}
                    </div>
                  </div>
                ))}
                {viewLogs.logs.length === 0 && (
                  <div className="p-12 text-center text-[#86868B]">
                    Nenhum log registrado.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {regToDelete && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200 p-6 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-[#1D1D1F]">Confirmar Exclusão</h3>
            </div>
            <p className="text-[#86868B] text-sm mb-6 leading-relaxed">
              Esta ação não pode ser desfeita. Para excluir o registro de <strong className="text-[#1D1D1F]">{regToDelete.fullName}</strong>, digite o nome completo do titular abaixo.
            </p>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder={regToDelete.fullName}
              className="mb-8 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-12"
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRegToDelete(null)} className="rounded-xl h-11 px-5 text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 font-medium">
                Cancelar
              </Button>
              <Button 
                onClick={confirmDelete} 
                disabled={deleteConfirmationText.trim().toUpperCase() !== regToDelete.fullName.trim().toUpperCase()}
                className="rounded-xl h-11 px-5 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-all disabled:opacity-50 disabled:hover:bg-red-600"
              >
                Excluir Registro
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Limpeza do Banco */}
      {showClearDbModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 p-6 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-[#1D1D1F]">Limpar Banco de Dados</h3>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
              <p className="text-red-800 text-sm font-medium leading-relaxed">
                ATENÇÃO: Esta ação é irreversível. Todos os cadastros e logs de auditoria serão excluídos permanentemente.
              </p>
            </div>
            <p className="text-[#86868B] text-sm mb-4">
              Para confirmar a exclusão total, digite <strong className="text-red-600">EXCLUIR TUDO</strong> abaixo:
            </p>
            <Input
              value={clearDbConfirmation}
              onChange={(e) => setClearDbConfirmation(e.target.value)}
              placeholder="EXCLUIR TUDO"
              className="mb-8 rounded-xl bg-gray-50 border-gray-200 focus:bg-white transition-colors h-12 font-bold text-center"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowClearDbModal(false);
                  setClearDbConfirmation('');
                }} 
                className="flex-1 rounded-xl h-12 text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 font-medium"
                disabled={isClearingDb}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleClearDatabase} 
                disabled={clearDbConfirmation !== 'EXCLUIR TUDO' || isClearingDb}
                className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-all disabled:opacity-50"
              >
                {isClearingDb ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  'Confirmar Exclusão Total'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização da Carteirinha */}
      {previewReg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 max-w-4xl w-full my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileBadge2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-[#1D1D1F]">Pré-visualização da Carteirinha</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewReg(null)} className="rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </Button>
            </div>
            
            <div className="p-6 bg-gray-50/50 flex justify-center min-h-[400px]">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center justify-center text-[#86868B]">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                  <p className="font-medium">Carregando foto e dados...</p>
                </div>
              ) : (
                <div className="scale-[0.85] sm:scale-100 origin-top">
                  <CarteirinhaPreview registration={previewReg} photoDataUri={previewPhotoUri} />
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white">
              <Button variant="ghost" onClick={() => setPreviewReg(null)} className="rounded-xl h-11 px-5 text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 font-medium">
                Fechar
              </Button>
              <Button 
                onClick={() => {
                  setPreviewReg(null);
                  window.history.pushState({}, '', `/carteirinha?search=${previewReg.cpf}`);
                  useAppStore.getState().setActiveTab('carteirinha');
                }} 
                className="rounded-xl h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-all"
              >
                Ir para Impressão
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
