import { create } from 'zustand';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  ip: string;
  timestamp: string;
  action: string;
  reason?: string;
};

export type CIPFRegistration = {
  id: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  photoUrl: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  signature?: string;
  visualSignature?: string;
  documentUrl?: string;
  proofOfResidenceUrl?: string;
  medicalReportUrl?: string;
  photoFileId?: string;
  documentFileId?: string;
  proofOfResidenceFileId?: string;
  medicalReportFileId?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cid?: string;
  justificativaCid?: string;
  checksum?: string;
};

type AppState = {
  isAuthReady: boolean;
  currentUser: { id: string; name: string; email: string; role: 'admin' | 'attendant' | 'user' } | null;
  registrations: CIPFRegistration[];
  lastBackupDate: number | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setCurrentUser: (user: any) => void;
  logout: () => Promise<void>;
  fetchRegistrations: () => Promise<void>;
  exportDatabase: () => Promise<void>;
  clearDatabase: () => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => {
  // Initialize auth listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      let role: 'admin' | 'attendant' | 'user' = 'user';
      
      // Check hardcoded admin first as a fallback
      if (user.email === 'luizcupperi.ipero@gmail.com') {
        role = 'admin';
      }

      // Fetch user role from Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          role = userDoc.data().role;
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        // We keep the role determined by email check if Firestore fails
      }
      
      set({ 
        currentUser: { 
          id: user.uid, 
          name: user.displayName || user.email || 'Usuário', 
          email: user.email || '',
          role: role
        },
        isAuthReady: true
      });
    } else {
      set({ currentUser: null, isAuthReady: true });
    }
  });

  return {
    isAuthReady: false,
    currentUser: null,
    registrations: [],
    lastBackupDate: parseInt(localStorage.getItem('lastBackupDate') || '0', 10) || null,
    activeTab: (() => {
      const path = window.location.pathname.replace('/', '');
      return ['valida', 'carteirinha', 'cadastro', 'dashboard', 'dev'].includes(path) ? path : 'valida';
    })(),
    setActiveTab: (tab: string) => {
      set({ activeTab: tab });
      window.history.pushState({}, '', `/${tab === 'valida' ? '' : tab}`);
    },
    setCurrentUser: (user) => set({ currentUser: user }),
    logout: async () => {
      await signOut(auth);
      set({ currentUser: null, registrations: [] });
    },
    exportDatabase: async () => {
      const { registrations, fetchRegistrations } = get();
      let dataToExport = registrations;
      if (dataToExport.length === 0) {
        await fetchRegistrations();
        dataToExport = get().registrations;
      }
      
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', `backup_cipf_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
      
      const now = Date.now();
      localStorage.setItem('lastBackupDate', now.toString());
      set({ lastBackupDate: now });
    },
    clearDatabase: async () => {
      const { currentUser } = get();
      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Apenas administradores podem limpar o banco de dados.');
      }

      const deleteCollection = async (collectionName: string) => {
        const snapshot = await getDocs(collection(db, collectionName));
        const docs = snapshot.docs;
        
        // Delete in chunks of 500 (Firestore limit)
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      };

      try {
        await deleteCollection('registrations');
        await deleteCollection('audit_logs');
        set({ registrations: [] });
      } catch (error) {
        console.error('Erro ao limpar banco de dados:', error);
        throw error;
      }
    },
    fetchRegistrations: async () => {
      const { currentUser } = get();
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'attendant')) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'registrations'));
        const regs: CIPFRegistration[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          regs.push({
            id: doc.id,
            fullName: data.fullName,
            cpf: data.cpf,
            birthDate: data.birthDate,
            photoUrl: data.photoUrl,
            issueDate: data.issueDate,
            expiryDate: data.expiryDate,
            status: data.status,
            visualSignature: data.visualSignature,
            documentUrl: data.documentUrl,
            proofOfResidenceUrl: data.proofOfResidenceUrl,
            medicalReportUrl: data.medicalReportUrl,
            photoFileId: data.photoFileId,
            documentFileId: data.documentFileId,
            proofOfResidenceFileId: data.proofOfResidenceFileId,
            medicalReportFileId: data.medicalReportFileId,
            cep: data.cep,
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.cidade,
            estado: data.estado,
            cid: data.cid,
            justificativaCid: data.justificativaCid,
            checksum: data.checksum
          });
        });
        set({ registrations: regs });
      } catch (error) {
        console.error('Failed to fetch registrations', error);
      }
    }
  };
});

