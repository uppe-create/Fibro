/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cadastro } from '@/modules/Cadastro';
import { Carteirinha } from '@/modules/Carteirinha';
import { Dashboard } from '@/modules/Dashboard';
import { Login } from '@/modules/Login';
import { Valida } from '@/modules/Valida';
import { DevTools } from '@/modules/DevTools';
import { Activity, LogOut, ShieldCheck, Loader2, Bug } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { isAuthReady, currentUser } = useAppStore();
  
  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-50 p-3 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-center text-[#1D1D1F] mb-2">Acesso Restrito</h2>
          <p className="text-center text-[#86868B] mb-8">Faça login para acessar esta área do sistema.</p>
          <Login />
        </div>
      </div>
    );
  }

  if (currentUser.role === 'user') {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-red-50 p-3 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-[#1D1D1F] mb-2">Acesso Negado</h2>
          <p className="text-[#86868B]">Sua conta não tem permissão para acessar o sistema. Contate um administrador.</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-red-50 p-3 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-[#1D1D1F] mb-2">Acesso Negado</h2>
          <p className="text-[#86868B]">Apenas usuários administradores podem acessar esta área.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const { isAuthReady, currentUser, logout } = useAppStore();
  const [activeTab, setActiveTab] = useState('valida');

  const resetTimer = useCallback(() => {
    if (currentUser) {
      localStorage.setItem('lastActivity', Date.now().toString());
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity && Date.now() - parseInt(lastActivity, 10) > INACTIVITY_TIMEOUT) {
        logout();
        alert('Sessão expirada por inatividade.');
      }
    };

    const interval = setInterval(checkInactivity, 60000); // Check every minute
    
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer(); // Initialize

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [currentUser, logout, resetTimer]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-200">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200/50 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-2 rounded-xl shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">Sistema CIPF</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentUser && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-[#1D1D1F]">{currentUser?.name}</p>
                  <p className="text-xs text-[#86868B] uppercase tracking-wider">{currentUser?.role}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="text-[#86868B] hover:text-[#1D1D1F] hover:bg-gray-100 rounded-full transition-colors" title="Sair">
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-10 print:hidden">
            <TabsList className="bg-gray-200/50 backdrop-blur-md p-1 rounded-full">
              <TabsTrigger value="valida" className="rounded-full px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1D1D1F] text-[#86868B] transition-all">Validar</TabsTrigger>
              <TabsTrigger value="carteirinha" className="rounded-full px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1D1D1F] text-[#86868B] transition-all">Carteirinha</TabsTrigger>
              {currentUser?.role === 'admin' && (
                <TabsTrigger value="cadastro" className="rounded-full px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1D1D1F] text-[#86868B] transition-all">Cadastro</TabsTrigger>
              )}
              <TabsTrigger value="dashboard" className="rounded-full px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1D1D1F] text-[#86868B] transition-all">Dashboard</TabsTrigger>
              {currentUser?.role === 'admin' && (
                <TabsTrigger value="dev" className="rounded-full px-6 py-2 data-[state=active]:bg-red-50 data-[state=active]:shadow-sm data-[state=active]:text-red-600 text-[#86868B] transition-all flex items-center gap-1">
                  <Bug className="w-4 h-4" /> Dev
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <TabsContent value="valida" className="mt-0 outline-none">
              <Valida />
            </TabsContent>

            <TabsContent value="carteirinha" className="mt-0 outline-none">
              <ProtectedRoute>
                <Carteirinha />
              </ProtectedRoute>
            </TabsContent>

            {currentUser?.role === 'admin' && (
              <TabsContent value="cadastro" className="mt-0 outline-none">
                <ProtectedRoute requireAdmin>
                  <Cadastro />
                </ProtectedRoute>
              </TabsContent>
            )}
            
            <TabsContent value="dashboard" className="mt-0 outline-none">
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </TabsContent>

            {currentUser?.role === 'admin' && (
              <TabsContent value="dev" className="mt-0 outline-none">
                <ProtectedRoute requireAdmin>
                  <DevTools />
                </ProtectedRoute>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </main>
    </div>
  );
}
