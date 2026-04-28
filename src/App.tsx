/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Login } from '@/modules/Login';
import {
  BadgeCheck,
  Bug,
  ClipboardPlus,
  IdCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  QrCode,
  Settings,
  ShieldCheck
} from 'lucide-react';
import {
  getSessionSecurityConfig,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_LOGIN_AT_STORAGE_KEY,
  useAppStore
} from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Notifications } from '@/components/Notifications';
import { canAccessTab, getDefaultTabForRole, getRoleLabel, hasPermission, type Permission } from '@/lib/permissions';
import prefeituraLogo from '@/assets/prefeitura-logo.png';

const Cadastro = React.lazy(() => import('@/modules/Cadastro').then((module) => ({ default: module.Cadastro })));
const Carteirinha = React.lazy(() => import('@/modules/Carteirinha').then((module) => ({ default: module.Carteirinha })));
const Configuracoes = React.lazy(() => import('@/modules/Configuracoes').then((module) => ({ default: module.Configuracoes })));
const Dashboard = React.lazy(() => import('@/modules/Dashboard').then((module) => ({ default: module.Dashboard })));
const DevTools = React.lazy(() => import('@/modules/DevTools').then((module) => ({ default: module.DevTools })));
const Valida = React.lazy(() => import('@/modules/Valida').then((module) => ({ default: module.Valida })));

const APP_VERSION = String((import.meta as any).env?.VITE_APP_VERSION || '1.0.0');
const APP_NAME = 'Carteirinha de Fibromialgia';
const SESSION_CHECK_INTERVAL_MS = 30_000;
const IS_PRODUCTION = Boolean((import.meta as any).env?.PROD);

function ModuleFallback() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-[1.25rem] border border-[#e3e9ef] bg-white/80 py-12 text-[#617184]">
      <Loader2 className="mb-3 h-7 w-7 animate-spin text-[#155c9c]" />
      <p className="text-sm font-semibold text-[#17324d]">Carregando modulo...</p>
      <p className="mt-1 text-xs">Abrindo somente o necessario para deixar o app mais leve.</p>
    </div>
  );
}

// Route guard for internal tabs. The public QR validation tab stays open;
// every restricted tab declares the permission it needs below.
const ProtectedRoute = ({
  children,
  permission,
  deniedMessage = 'Sua conta nao tem permissao para acessar esta area.'
}: {
  children: React.ReactNode;
  permission?: Permission;
  deniedMessage?: string;
}) => {
  const { isAuthReady, currentUser } = useAppStore();

  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#155c9c]" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-[58vh] items-center justify-center py-8 animate-in fade-in zoom-in duration-500">
        <div className="institutional-panel w-full max-w-md rounded-[1.25rem] p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-[#e7edf3] pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf4ee] text-[#166534]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#17324d]">Portal Administrativo</h2>
              <p className="text-sm text-[#617184]">Entre com a credencial autorizada.</p>
            </div>
          </div>
          <Login />
        </div>
      </div>
    );
  }

  if (permission && !hasPermission(currentUser, permission)) {
    return (
      <div className="flex min-h-[58vh] items-center justify-center py-8 animate-in fade-in zoom-in duration-500">
        <div className="w-full max-w-md border border-[#d9e1ea] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center bg-red-50 text-red-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-[#17324d]">Acesso Negado</h2>
          <p className="mb-5 text-sm text-[#617184]">{deniedMessage}</p>
          <Button variant="outline" onClick={() => useAppStore.getState().logout()} className="h-11 w-full">
            Sair e tentar outra conta
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const { currentUser, logout, activeTab, setActiveTab, logAudit } = useAppStore();
  const { idleTimeoutMs, maxSessionMs } = getSessionSecurityConfig();

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  // If the URL points to a tab the current role cannot access, redirect to the
  // safest useful tab for that role instead of leaving the UI stuck.
  useEffect(() => {
    if (IS_PRODUCTION && activeTab === 'dev') {
      setActiveTab('configuracoes');
      return;
    }
    if (!currentUser || canAccessTab(currentUser, activeTab)) return;
    setActiveTab(getDefaultTabForRole(currentUser.role));
  }, [activeTab, currentUser, setActiveTab]);

  const resetTimer = useCallback(() => {
    if (!currentUser) return;
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
  }, [currentUser]);

  // Frontend session guard for shared workstations. Database security still
  // depends on Supabase RLS/backend rules, not on this timer.
  useEffect(() => {
    if (!currentUser) return;

    let expired = false;
    resetTimer();

    const expireSession = async (reason: string) => {
      if (expired) return;
      expired = true;
      await logAudit('Sessao Expirada', reason);
      await logout();
      alert('Sessão encerrada automaticamente por segurança. Faça login novamente.');
    };

    const checkSession = async () => {
      const now = Date.now();
      const lastActivity = Number(localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY) || now);
      const sessionStartedAt = Number(localStorage.getItem(SESSION_LOGIN_AT_STORAGE_KEY) || now);

      if (now - lastActivity > idleTimeoutMs) {
        await expireSession('Inatividade acima do limite configurado');
        return;
      }

      if (now - sessionStartedAt > maxSessionMs) {
        await expireSession('Tempo maximo de sessao excedido');
      }
    };

    const interval = window.setInterval(() => {
      void checkSession();
    }, SESSION_CHECK_INTERVAL_MS);

    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'click', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));

    return () => {
      clearInterval(interval);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [currentUser, idleTimeoutMs, maxSessionMs, logout, logAudit, resetTimer]);

  // Keep navigation declarative: when adding a tab, give it a permission here.
  const navItems = [
    { value: 'valida', label: 'Validar', icon: QrCode },
    { value: 'carteirinha', label: 'Carteirinha', icon: IdCard, permission: 'printCarteirinha' as Permission },
    { value: 'cadastro', label: 'Cadastro', icon: ClipboardPlus, permission: 'createRegistration' as Permission },
    { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'viewDashboard' as Permission },
    { value: 'configuracoes', label: 'Configurações', icon: Settings, permission: 'viewSettings' as Permission },
    { value: 'dev', label: 'Dev', icon: Bug, permission: 'useDevTools' as Permission, danger: true, devOnly: true }
  ].filter((item) => (!item.devOnly || !IS_PRODUCTION) && (!item.permission || hasPermission(currentUser, item.permission)));

  return (
    <div className="min-h-screen text-[#18222d] selection:bg-[#cfe7dc]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-screen flex-col">
        <header className="print:hidden border-b border-[#ccd6df] bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#155c9c_0%,#155c9c_45%,#1f8a58_45%,#1f8a58_78%,#f2c94c_78%,#f2c94c_100%)]" />
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-28 items-center justify-center px-1">
                <img src={prefeituraLogo} alt="Prefeitura de Iperó" className="max-h-11 w-auto object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold leading-tight text-[#17324d] sm:text-2xl">{APP_NAME}</h1>
                  <span className="hidden border border-[#b9d7c7] bg-[#edf7f1] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#166534] sm:inline-flex">
                    CIPF
                  </span>
                </div>
                <p className="text-sm text-[#617184]">Prefeitura Municipal de Iperó • Secretaria Municipal de Saúde</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <div className="hidden items-center gap-2 border border-[#d9e1ea] bg-[#f7fafc] px-3 py-2 text-xs text-[#526579] sm:flex">
                <BadgeCheck className="h-4 w-4 text-[#1f8a58]" />
                Portal oficial CIPF
              </div>
              {!currentUser && (
                <Button
                  type="button"
                  onClick={() => setActiveTab('configuracoes')}
                  className="h-10 rounded-xl bg-[#17324d] px-4 text-white hover:bg-[#10263b]"
                >
                  Entrar no sistema
                </Button>
              )}
              {currentUser && (
                <div className="flex items-center gap-2">
                  <Notifications />
                  <div className="hidden text-right md:block">
                    <p className="text-sm font-semibold text-[#17324d]">{currentUser.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-[#617184]">{getRoleLabel(currentUser.role)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={logout}
                    className="h-10 w-10 text-[#526579] hover:bg-[#eef2f5] hover:text-[#17324d]"
                    title="Sair"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#e3e9ef] bg-[#f8fafc]">
            <div className="mx-auto max-w-7xl overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="h-auto min-w-max justify-start gap-1 rounded-none bg-transparent p-0">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <React.Fragment key={item.value}>
                      <TabsTrigger
                        value={item.value}
                        className={`h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 text-[#526579] shadow-none hover:bg-white hover:text-[#17324d] data-[state=active]:border-[#1f8a58] data-[state=active]:bg-white data-[state=active]:text-[#17324d] data-[state=active]:shadow-none ${
                          item.danger ? 'data-[state=active]:border-red-500 data-[state=active]:text-red-700' : ''
                        }`}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </TabsTrigger>
                    </React.Fragment>
                  );
                })}
              </TabsList>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense fallback={<ModuleFallback />}>
              <TabsContent value="valida" className="mt-0 outline-none">
                <Valida />
              </TabsContent>

              <TabsContent value="carteirinha" className="mt-0 outline-none">
                <ProtectedRoute permission="viewCarteirinha">
                  <Carteirinha />
                </ProtectedRoute>
              </TabsContent>

              <TabsContent value="cadastro" className="mt-0 outline-none">
                <ProtectedRoute permission="createRegistration" deniedMessage="Apenas administradores e atendentes podem cadastrar pessoas.">
                  <Cadastro />
                </ProtectedRoute>
              </TabsContent>

              <TabsContent value="dashboard" className="mt-0 outline-none">
                <ProtectedRoute permission="viewDashboard" deniedMessage="Este perfil pode consultar carteirinhas, mas nao acessa o dashboard administrativo.">
                  <Dashboard />
                </ProtectedRoute>
              </TabsContent>

              <TabsContent value="configuracoes" className="mt-0 outline-none">
                <ProtectedRoute permission="viewSettings" deniedMessage="Este perfil nao acessa configuracoes do sistema.">
                  <Configuracoes />
                </ProtectedRoute>
              </TabsContent>

              {!IS_PRODUCTION && (
                <TabsContent value="dev" className="mt-0 outline-none">
                  <ProtectedRoute permission="useDevTools" deniedMessage="Apenas administradores podem acessar ferramentas de desenvolvimento.">
                    <DevTools />
                  </ProtectedRoute>
                </TabsContent>
              )}
            </Suspense>
          </div>
        </main>

        <footer className="print:hidden border-t border-[#d5dde6] bg-white px-4 py-3 text-xs text-[#617184]">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p>Prefeitura Municipal de Iperó • Secretaria Municipal de Saúde</p>
            <p className="font-medium">{APP_NAME} • Versão {APP_VERSION}</p>
          </div>
        </footer>
      </Tabs>
    </div>
  );
}
