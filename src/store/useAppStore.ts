import { create } from 'zustand';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

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
  setCurrentUser: (user: any) => void;
  logout: () => Promise<void>;
  fetchRegistrations: () => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => {
  // Initialize auth listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Fetch user role from Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let role = 'user';
        if (userDoc.exists()) {
          role = userDoc.data().role;
        } else if (user.email === 'luizcupperi.ipero@gmail.com') {
          role = 'admin';
        }
        
        set({ 
          currentUser: { 
            id: user.uid, 
            name: user.displayName || user.email || 'Usuário', 
            email: user.email || '',
            role: role as 'admin' | 'attendant' | 'user'
          },
          isAuthReady: true
        });
      } catch (error) {
        console.error("Error fetching user role:", error);
        set({ currentUser: null, isAuthReady: true });
      }
    } else {
      set({ currentUser: null, isAuthReady: true });
    }
  });

  return {
    isAuthReady: false,
    currentUser: null,
    registrations: [],
    setCurrentUser: (user) => set({ currentUser: user }),
    logout: async () => {
      await signOut(auth);
      set({ currentUser: null, registrations: [] });
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

