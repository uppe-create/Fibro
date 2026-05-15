import React, { Component, Suspense, useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Login } from '@/modules/Login';
import { hasPermission, type Permission } from '@/lib/permissions';
import { logClientDiagnostic } from '@/lib/runtime-compat';
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
  Governanca,
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

  componentDidCatch(error: Error) {
    logClientDiagnostic('module-error-boundary', error?.message || 'Falha ao abrir modulo', {
      resetKey: this.props.resetKey
    });
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
        <Loader2 className="h-8 w-8 animate-spin text-[#155c9c]" />
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
  const isPublicUser = !currentUser;
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

  const renderPublicOnlyRoute = () => {
    switch (activeTab) {
      case 'inicio':
        return <Home />;
      case 'validar':
        return <Valida />;
      case 'acessibilidade':
        return <Acessibilidade />;
      case 'suporte':
        return <Suporte />;
      case 'privacidade':
        return <Privacidade />;
      case 'termos':
        return <Termos />;
      case 'contato':
        return <Contato />;
      case 'configuracoes':
        return (
          <ProtectedRoute permission="viewSettings" deniedMessage="Este perfil nao acessa configuracoes do sistema.">
            <Configuracoes />
          </ProtectedRoute>
        );
      default:
        return <Home />;
    }
  };

  const renderInternalOnlyRoute = () => {
    switch (activeTab) {
      case 'inicio':
        return <InternalHome />;
      case 'acessibilidade':
        return <Acessibilidade />;
      case 'suporte':
        return <Suporte />;
      case 'privacidade':
        return <Privacidade />;
      case 'termos':
        return <Termos />;
      case 'contato':
        return <Contato />;
      case 'validar':
        return <Valida />;
      case 'carteirinha':
        return (
          <ProtectedRoute permission="viewCarteirinha">
            <Carteirinha />
          </ProtectedRoute>
        );
      case 'cadastro':
        return (
          <ProtectedRoute permission="createRegistration" deniedMessage="Apenas administradores e atendentes podem cadastrar pessoas.">
            <Cadastro />
          </ProtectedRoute>
        );
      case 'dashboard':
        return (
          <ProtectedRoute permission="viewDashboard" deniedMessage="Este perfil pode consultar carteirinhas, mas nao acessa o dashboard administrativo.">
            <Dashboard />
          </ProtectedRoute>
        );
      case 'pessoas':
        return (
          <ProtectedRoute permission="viewPeople" deniedMessage="Este perfil nao acessa a lista interna de pessoas.">
            <Pessoas />
          </ProtectedRoute>
        );
      case 'operacao':
        return (
          <ProtectedRoute permission="viewOperations" deniedMessage="Este perfil nao acessa a fila operacional.">
            <Operacao />
          </ProtectedRoute>
        );
      case 'documentos':
        return (
          <ProtectedRoute permission="viewDocumentsQueue" deniedMessage="Este perfil nao acessa a fila documental.">
            <Documentos />
          </ProtectedRoute>
        );
      case 'retiradas':
        return (
          <ProtectedRoute permission="viewPickupQueue" deniedMessage="Este perfil nao acessa a fila de retiradas.">
            <Retiradas />
          </ProtectedRoute>
        );
      case 'relatorios':
        return (
          <ProtectedRoute permission="viewReports" deniedMessage="Apenas administradores acessam relatorios e exportacoes.">
            <Relatorios />
          </ProtectedRoute>
        );
      case 'auditoria':
        return (
          <ProtectedRoute permission="viewAudit" deniedMessage="Apenas administradores acessam a auditoria do sistema.">
            <Auditoria />
          </ProtectedRoute>
        );
      case 'governanca':
        return (
          <ProtectedRoute permission="viewGovernance" deniedMessage="Somente administradores acessam governanca LGPD e incidente.">
            <Governanca />
          </ProtectedRoute>
        );
      case 'configuracoes':
        return (
          <ProtectedRoute permission="viewSettings" deniedMessage="Este perfil nao acessa configuracoes do sistema.">
            <Configuracoes />
          </ProtectedRoute>
        );
      case 'dev':
        return IS_PRODUCTION ? null : (
          <ProtectedRoute permission="useDevTools" deniedMessage="Apenas administradores podem acessar ferramentas de desenvolvimento.">
            <DevTools />
          </ProtectedRoute>
        );
      default:
        return <InternalHome />;
    }
  };

  if (isPublicUser) {
    return (
      <main className={isStandalonePublicPage ? 'w-full flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6'}>
        <div className={isStandalonePublicPage ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}>
          <AppErrorBoundary resetKey={activeTab}>
            <Suspense fallback={<ModuleFallback />}>
              {isStandalonePublicPage ? (
                <div className={publicTransitionPhase === 'exit' ? 'opacity-0' : ''}>{renderPublicPage()}</div>
              ) : (
                renderPublicOnlyRoute()
              )}
            </Suspense>
          </AppErrorBoundary>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1">
      <div className={isStandalonePublicPage ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-500'}>
        <AppErrorBoundary resetKey={activeTab}>
          <Suspense fallback={<ModuleFallback />}>{renderInternalOnlyRoute()}</Suspense>
        </AppErrorBoundary>
      </div>
    </main>
  );
}
