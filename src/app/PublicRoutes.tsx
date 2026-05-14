import React, { Component, Suspense, useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Login } from '@/modules/Login';
import { hasPermission, type Permission } from '@/lib/permissions';
import { useAppStore } from '@/store/useAppStore';
import {
  Cadastro,
  Acessibilidade,
  Auditoria,
  Carteirinha,
  Contato,
  Configuracoes,
  Dashboard,
  DevTools,
  Documentos,
  Home,
  IS_PRODUCTION,
  Relatorios,
  Operacao,
  Pessoas,
  Privacidade,
  Retiradas,
  Suporte,
  Termos,
  Valida
} from '@/app/appModules';
import { InternalHome } from '@/app/InternalHome';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
  resetKey: string;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends (Component as any) {
  props!: AppErrorBoundaryProps;
  state: AppErrorBoundaryState = { hasError: false };
  setState!: (state: Partial<AppErrorBoundaryState>) => void;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[55vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[1.5rem] border border-[#d9e1ea] bg-white p-6 text-center shadow-[0_18px_50px_rgba(7,29,65,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4ecff] text-[#7b2cbf]">
            <Loader2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-[#071d41]">Nao foi possivel abrir esta tela</h2>
          <p className="mt-2 text-sm leading-6 text-[#617184]">
            O modulo encontrou uma falha temporaria durante a troca de paginas. Tente abrir outra aba ou recarregue o sistema.
          </p>
          <Button type="button" onClick={() => window.location.reload()} className="mt-5 h-11 rounded-xl bg-[#071d41] px-5 text-white hover:bg-[#102b55]">
            Recarregar sistema
          </Button>
        </div>
      </div>
    );
  }
}

function ModuleFallback() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-[1.25rem] border border-[#e3e9ef] bg-white/80 py-12 text-[#617184]">
      <Loader2 className="mb-3 h-7 w-7 animate-spin text-[#155c9c]" />
      <p className="text-sm font-semibold text-[#17324d]">Carregando modulo...</p>
      <p className="mt-1 text-xs">Abrindo somente o necessario para deixar o app mais leve.</p>
    </div>
  );
}

function ProtectedRoute({
  children,
  permission,
  deniedMessage = 'Sua conta nao tem permissao para acessar esta area.'
}: {
  children: React.ReactNode;
  permission?: Permission;
  deniedMessage?: string;
}) {
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
      <div className="flex min-h-[72vh] items-center justify-center py-10 animate-in fade-in duration-500">
        <div className="w-full max-w-6xl overflow-hidden rounded-[1.25rem] border border-[#ece7f3] bg-white shadow-[0_18px_50px_rgba(47,20,80,0.10)]">
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
}

export function PublicRoutes({ activeTab }: { activeTab: string }) {
  const currentUser = useAppStore((state) => state.currentUser);
  const isStandalonePublicPage = (activeTab === 'inicio' || activeTab === 'validar') && !currentUser;
  const [renderedPublicTab, setRenderedPublicTab] = useState(activeTab === 'validar' ? 'validar' : 'inicio');
  const [publicTransitionPhase, setPublicTransitionPhase] = useState<'enter' | 'exit'>('enter');

  useEffect(() => {
    if (!isStandalonePublicPage) return;
    if (activeTab !== 'inicio' && activeTab !== 'validar') return;
    if (renderedPublicTab === activeTab) {
      setPublicTransitionPhase('enter');
      return;
    }

    setPublicTransitionPhase('exit');
    const switchTimer = window.setTimeout(() => {
      setRenderedPublicTab(activeTab);
      setPublicTransitionPhase('enter');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 180);

    return () => window.clearTimeout(switchTimer);
  }, [activeTab, isStandalonePublicPage, renderedPublicTab]);

  const renderPublicPage = () => {
    if (renderedPublicTab === 'validar') return <Valida />;
    return <Home />;
  };

  return (
    <main className={isStandalonePublicPage ? 'w-full flex-1' : currentUser ? 'min-w-0 flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6'}>
      <div className={isStandalonePublicPage ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}>
        <AppErrorBoundary resetKey={activeTab}>
          <Suspense fallback={<ModuleFallback />}>
            {isStandalonePublicPage ? (
              <div
                className={`public-shell-transition ${
                  publicTransitionPhase === 'exit' ? 'public-shell-transition--exit' : 'public-shell-transition--enter'
                }`}
              >
                {renderPublicPage()}
              </div>
            ) : (
              <TabsContent value="inicio" className="mt-0 outline-none">
                {currentUser ? <InternalHome /> : <Home />}
              </TabsContent>
            )}

            <TabsContent value="acessibilidade" className="mt-0 outline-none">
              <Acessibilidade />
            </TabsContent>

            <TabsContent value="suporte" className="mt-0 outline-none">
              <Suporte />
            </TabsContent>

            <TabsContent value="privacidade" className="mt-0 outline-none">
              <Privacidade />
            </TabsContent>

            <TabsContent value="termos" className="mt-0 outline-none">
              <Termos />
            </TabsContent>

            <TabsContent value="contato" className="mt-0 outline-none">
              <Contato />
            </TabsContent>

            {!isStandalonePublicPage && (
              <TabsContent value="validar" className="mt-0 outline-none">
                <Valida />
              </TabsContent>
            )}

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

            <TabsContent value="pessoas" className="mt-0 outline-none">
              <ProtectedRoute permission="viewPeople" deniedMessage="Este perfil nao acessa a lista interna de pessoas.">
                <Pessoas />
              </ProtectedRoute>
            </TabsContent>

            <TabsContent value="operacao" className="mt-0 outline-none">
              <ProtectedRoute permission="viewOperations" deniedMessage="Apenas administradores acessam a operacao administrativa.">
                <Operacao />
              </ProtectedRoute>
            </TabsContent>

            <TabsContent value="documentos" className="mt-0 outline-none">
              <ProtectedRoute permission="viewDocumentsQueue" deniedMessage="Apenas administradores acessam a fila documental.">
                <Documentos />
              </ProtectedRoute>
            </TabsContent>

            <TabsContent value="retiradas" className="mt-0 outline-none">
              <ProtectedRoute permission="viewPickupQueue" deniedMessage="Apenas administradores acessam a fila de retiradas.">
                <Retiradas />
              </ProtectedRoute>
            </TabsContent>

            <TabsContent value="relatorios" className="mt-0 outline-none">
              <ProtectedRoute permission="viewReports" deniedMessage="Apenas administradores acessam relatorios e exportacoes.">
                <Relatorios />
              </ProtectedRoute>
            </TabsContent>

            <TabsContent value="auditoria" className="mt-0 outline-none">
              <ProtectedRoute permission="viewAudit" deniedMessage="Apenas administradores acessam a auditoria do sistema.">
                <Auditoria />
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
        </AppErrorBoundary>
      </div>
    </main>
  );
}
