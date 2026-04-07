import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAppStore } from '@/store/useAppStore';
import { Loader2, Bug, Trash2 } from 'lucide-react';

export function DevTools() {
  const [loading, setLoading] = useState(false);
  const { currentUser, fetchRegistrations } = useAppStore();

  const generateFakeUsers = async () => {
    setLoading(true);
    try {
      const firstNames = ['Ana', 'João', 'Maria', 'Pedro', 'Lucas', 'Julia', 'Marcos', 'Fernanda', 'Carlos', 'Beatriz'];
      const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Lima', 'Gomes', 'Costa'];
      const bairros = ['Centro', 'Jardim Paulista', 'Vila Madalena', 'Pinheiros', 'Mooca', 'Santana', 'Itaquera', 'Lapa'];
      
      for (let i = 0; i < 5; i++) {
        const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
        const cpf = `${Math.floor(Math.random() * 999).toString().padStart(3, '0')}${Math.floor(Math.random() * 999).toString().padStart(3, '0')}${Math.floor(Math.random() * 999).toString().padStart(3, '0')}${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`;
        
        const issueDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        
        // Random birthdate between 1950 and 2005
        const birthYear = Math.floor(Math.random() * (2005 - 1950 + 1)) + 1950;
        const birthMonth = Math.floor(Math.random() * 12) + 1;
        const birthDay = Math.floor(Math.random() * 28) + 1;

        await addDoc(collection(db, 'registrations'), {
          fullName: name.toUpperCase(),
          cpf: cpf,
          phone: '11999999999',
          birthDate: `${birthDay.toString().padStart(2, '0')}/${birthMonth.toString().padStart(2, '0')}/${birthYear}`,
          legalGuardian: null,
          cep: '01001000',
          logradouro: 'Rua Fictícia, 123',
          bairro: bairros[Math.floor(Math.random() * bairros.length)],
          cidade: 'São Paulo',
          estado: 'SP',
          documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          proofOfResidenceUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          proofOfResidenceDate: '01/01/2026',
          medicalReportUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          medicalReportDate: '01/01/2026',
          cid: 'M79.7',
          justificativaCid: null,
          crm: '12345-SP',
          photoUrl: `https://picsum.photos/seed/${Math.random()}/300/400`,
          issueDate: issueDate.toLocaleDateString('pt-BR'),
          expiryDate: expiryDate.toLocaleDateString('pt-BR'),
          status: 'active',
          visualSignature: Math.random().toString(36).substring(2, 8).toUpperCase(),
          checksum: 'fake-checksum',
          userId: currentUser?.id || 'admin'
        });
      }
      await fetchRegistrations();
      alert('5 usuários falsos gerados com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar usuários falsos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-red-200 overflow-hidden p-8 md:p-10">
        <div className="flex items-center gap-3 mb-6 text-red-600">
          <div className="p-3 bg-red-50 rounded-2xl">
            <Bug className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1D1D1F]">Painel de Desenvolvimento</h2>
            <p className="text-[#86868B] text-sm mt-1">Apenas para testes. Remova antes de ir para produção.</p>
          </div>
        </div>
        
        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6 mb-8">
          <h3 className="font-medium text-red-800 mb-2">Gerador de Dados Falsos</h3>
          <p className="text-sm text-red-600/80 mb-6">
            Isso irá criar 5 registros aleatórios no banco de dados para que você possa testar o Dashboard, paginação, filtros e gráficos sem precisar preencher o formulário manualmente.
          </p>
          <Button 
            onClick={generateFakeUsers} 
            disabled={loading} 
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-6"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bug className="w-4 h-4 mr-2" />}
            Gerar 5 Cadastros Falsos
          </Button>
        </div>
      </div>
    </div>
  );
}
