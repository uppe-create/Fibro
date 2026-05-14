import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { LockKeyhole, LogOut, Search, ShieldCheck, UnlockKeyhole } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Notifications } from '@/components/Notifications';
import {
  getSessionSecurityConfig,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_LOGIN_AT_STORAGE_KEY,
  useAppStore
} from '@/store/useAppStore';
import { canAccessTab, getDefaultTabForRole, getRoleLabel } from '@/lib/permissions';
import { InternalNavigation } from '@/app/InternalNavigation';
import { PublicRoutes } from '@/app/PublicRoutes';
import { APP_NAME, APP_VERSION, AUTH_MODE, IS_PRODUCTION, preloadAppModules, SESSION_CHECK_INTERVAL_MS } from '@/app/appModules';
import { getProductionAuthError } from '@/lib/auth-mode';
import { MfaChallenge } from '@/modules/MfaChallenge';

const PEOPLE_SEARCH_STORAGE_KEY = 'cipf_people_search';
const PUBLIC_HOME_SECTION_STORAGE_KEY = 'cipf_public_home_section';

export function AppShell() {
  const { currentUser, isSessionLocked, lockSession, unlockSession, logout, activeTab, setActiveTab, logAudit, initializeAuth, mfaChallenge } = useAppStore();
  const { idleTimeoutMs, maxSessionMs } = getSessionSecurityConfig();
  const [globalSearch, setGlobalSearch] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const previousUserIdRef = useRef<string | null>(null);
  const productionAuthError = getProductionAuthError((import.meta as any).env || {}, IS_PRODUCTION);

  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const preloadModules = () => {
      void preloadAppModules();
    };

    const idleCallback = (window as any).requestIdleCallback as undefined | ((callback: () => void) => number);
    if (idleCallback) {
      const handle = idleCallback(preloadModules);
      return () => (window as any).cancelIdleCallback?.(handle);
    }

    const timeout = window.setTimeout(preloadModules, 800);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (IS_PRODUCTION && activeTab === 'dev') {
      setActiveTab('configuracoes');
      return;
    }
    if (!currentUser || canAccessTab(currentUser, activeTab)) return;
    setActiveTab(getDefaultTabForRole(currentUser.role));
  }, [activeTab, currentUser, setActiveTab]);

  useEffect(() => {
    if (currentUser) return;
    if (!['privacidade', 'termos', 'contato', 'acessibilidade', 'suporte'].includes(activeTab)) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab, currentUser]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    if (currentUser && previousUserId !== currentUser.id && ['inicio', 'validar', 'configuracoes', 'suporte', 'acessibilidade'].includes(activeTab)) {
      setActiveTab(getDefaultTabForRole(currentUser.role));
    }
    previousUserIdRef.current = currentUser?.id || null;
  }, [activeTab, currentUser, setActiveTab]);

  const resetTimer = useCallback(() => {
    if (!currentUser || isSessionLocked) return;
    localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
  }, [currentUser, isSessionLocked]);

  useEffect(() => {
    if (!currentUser || isSessionLocked) return;

    let expired = false;
    resetTimer();

    const expireSession = async (reason: string) => {
      if (expired) return;
      expired = true;
      await logAudit('Sessao Expirada', reason);
      await logout();
      alert('Sessao encerrada automaticamente por seguranca. Faca login novamente.');
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
  }, [currentUser, isSessionLocked, idleTimeoutMs, maxSessionMs, logout, logAudit, resetTimer]);

  const submitGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    sessionStorage.setItem(PEOPLE_SEARCH_STORAGE_KEY, query);
    setActiveTab('pessoas');
  };

  const handleUnlock = async () => {
    setUnlockError('');
    setIsUnlocking(true);
    try {
      await unlockSession();
    } catch (error: any) {
      setUnlockError(error?.message || 'Sessao expirada. Entre novamente.');
    } finally {
      setIsUnlocking(false);
    }
  };

  if (productionAuthError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2f1450] px-4 text-white">
        <div className="max-w-xl rounded-lg border border-white/20 bg-white/10 p-6 shadow-2xl">
          <ShieldCheck className="mb-4 h-9 w-9 text-amber-200" />
          <h1 className="text-2xl font-black">Aplicacao bloqueada por seguranca</h1>
          <p className="mt-3 text-sm text-white/80">{productionAuthError}</p>
          <p className="mt-4 text-sm text-white/70">Configure Supabase Auth antes de publicar com dados reais.</p>
        </div>
      </div>
    );
  }

  if (currentUser && isSessionLocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfafc] px-4 text-[#251832]">
        <div className="w-full max-w-md rounded-xl border border-[#e9e0f0] bg-white p-6 shadow-[0_18px_50px_rgba(47,20,80,0.10)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--fibro-purple)] text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#876d9f]">Sessao bloqueada</p>
              <h1 className="truncate text-xl font-black text-[#170b24]">{currentUser.name}</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#617184]">
            Sessao Supabase preservada neste navegador. Desbloqueio nao pede MFA enquanto `aal2` continuar valido.
          </p>
          {unlockError ? <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{unlockError}</div> : null}
          <div className="mt-6 grid gap-3">
            <Button type="button" onClick={() => void handleUnlock()} disabled={isUnlocking} className="h-12 rounded-lg">
              <UnlockKeyhole className="mr-2 h-4 w-4" />
              {isUnlocking ? 'Desbloqueando...' : 'Desbloquear'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()} className="h-11 rounded-lg">
              <LogOut className="mr-2 h-4 w-4" />
              Sair definitivo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const initials = currentUser?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  const isStandalonePublicPage = (activeTab === 'inicio' || activeTab === 'validar') && !currentUser;
  const hideGlobalPublicHeader = !currentUser && ['privacidade', 'termos', 'contato'].includes(activeTab);
  const hideGlobalPublicFooter = !currentUser && ['privacidade', 'termos', 'contato'].includes(activeTab);
  const isPublicShell = !currentUser;
  const isAdminBlockedByMfa = currentUser?.accessNotice === 'admin_mfa_required' && currentUser.role === 'viewer';

  useEffect(() => {
    if (!isAdminBlockedByMfa) return;
    if (activeTab === 'configuracoes') return;
    setActiveTab('configuracoes');
  }, [activeTab, isAdminBlockedByMfa, setActiveTab]);

  const openPublicHomeSection = useCallback((sectionId: string) => {
    sessionStorage.setItem(PUBLIC_HOME_SECTION_STORAGE_KEY, sectionId);
    setActiveTab('inicio');
  }, [setActiveTab]);

  return (
    <div className="min-h-screen bg-[#fbfafc] text-[#251832] selection:bg-[#eadcff]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-screen flex-col">
                {isPublicShell && !isStandalonePublicPage && !hideGlobalPublicHeader && (
          <header className="lovable-home print:hidden border-b border-[hsl(270_15%_90%)] bg-white/95 shadow-[0_1px_2px_hsl(270_25%_14%/0.04)] backdrop-blur">
            <div className="mx-auto max-w-[1240px] px-4 py-4 md:px-8">
              <div className="flex min-h-14 items-center justify-between gap-4">
                <button type="button" onClick={() => setActiveTab('inicio')} className="min-w-0 text-left">
                  <div className="min-w-0 text-left leading-tight">
                    <div className="lovable-display text-base font-semibold text-[hsl(270_25%_14%)]">CIPF</div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[hsl(270_8%_42%)]">IPERO - CARTEIRINHA MUNICIPAL</div>
                  </div>
                </button>

                <nav className="hidden items-center gap-8 text-sm text-[hsl(270_25%_14%/0.70)] lg:flex">
                  <button type="button" onClick={() => setActiveTab('inicio')} className="transition hover:text-[hsl(270_25%_14%)]">Home</button>
                  <button type="button" onClick={() => setActiveTab('validar')} className="transition hover:text-[hsl(270_25%_14%)]">Validar</button>
                </nav>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setActiveTab('configuracoes')}
                    className="h-10 rounded-md bg-[hsl(271_52%_32%)] px-3 text-xs font-bold text-white shadow-[0_10px_22px_hsl(271_52%_32%/0.18)] hover:bg-[hsl(271_52%_26%)] sm:px-4 sm:text-sm"
                  >
                    Acessar painel
                  </Button>
                </div>
              </div>

              <nav className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[hsl(270_15%_92%)] pt-3 text-sm text-[hsl(270_25%_14%/0.72)] lg:hidden">
                <button type="button" onClick={() => setActiveTab('inicio')} className="transition hover:text-[hsl(270_25%_14%)]">Home</button>
                <button type="button" onClick={() => setActiveTab('validar')} className="transition hover:text-[hsl(270_25%_14%)]">Validar</button>
              </nav>
            </div>
          </header>
        )}

        {currentUser && (
          <header className="print:hidden relative z-40 border-b border-[#e9e0f0] bg-white/95 backdrop-blur">
            <div className="mx-auto flex min-h-20 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <button type="button" onClick={() => setActiveTab(getDefaultTabForRole(currentUser.role))} className="min-w-0 flex-1 text-left sm:flex-none">
                <div className="lovable-display text-base font-semibold text-[hsl(270_25%_14%)]">CIPF</div>
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[hsl(270_8%_42%)]">IPERO - AREA INTERNA</div>
              </button>

              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:justify-between lg:w-auto lg:flex-1 lg:flex-nowrap lg:justify-end">
                <form onSubmit={submitGlobalSearch} className="hidden w-full max-w-xs xl:block 2xl:max-w-sm">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a6c86]" />
                    <input
                      value={globalSearch}
                      onChange={(event) => setGlobalSearch(event.target.value)}
                      placeholder="Buscar cadastro..."
                      className="h-10 w-full rounded-xl border border-transparent bg-[#faf8fb] pl-9 pr-3 text-sm text-[#251832] outline-none focus:border-[#d8c6e8] focus:bg-white focus:shadow-[0_0_0_3px_rgba(123,44,191,0.12)]"
                    />
                  </div>
                </form>

                <div className="shrink-0">
                  <Notifications />
                </div>
                <div className="hidden h-10 w-px bg-[#ece7f3] xl:block" />
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1eaf8] text-xs font-black text-[var(--fibro-purple)]">
                  {initials}
                </div>
                <div className="hidden text-right 2xl:block">
                  <p className="max-w-[12rem] truncate text-sm font-bold leading-tight text-[#170b24]">{currentUser.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#6f617b]">{getRoleLabel(currentUser.role)}</p>
                </div>
                {(AUTH_MODE !== 'supabase' || !IS_PRODUCTION) && (
                  <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 xl:inline-flex">
                    Teste
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void lockSession()}
                  className="h-10 w-10 rounded-md text-[#6f617b] hover:bg-[#f8f5fb] hover:text-[var(--fibro-purple)]"
                  title="Bloquear"
                >
                  <LockKeyhole className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void logout()}
                  className="h-10 w-10 rounded-md text-[#6f617b] hover:bg-[#f8f5fb] hover:text-red-600"
                  title="Sair definitivo"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>
        )}

        {currentUser ? (
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
            {!isAdminBlockedByMfa ? <InternalNavigation activeTab={activeTab} currentUser={currentUser} onSelect={setActiveTab} /> : null}
            <div className="min-w-0 flex-1 space-y-4">
              {isAdminBlockedByMfa && (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">MFA obrigatorio para perfil administrador</p>
                    <p className="mt-1">Conta marcada como Administrador, mas sem MFA ativo. Acesso reduzido para Consulta ate concluir MFA.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" onClick={() => setActiveTab('configuracoes')} className="h-10 whitespace-nowrap">
                      Ative MFA para liberar perfil administrador
                    </Button>
                    <Button type="button" variant="outline" onClick={logout} className="h-10 whitespace-nowrap">
                      Sair
                    </Button>
                  </div>
                </div>
              )}
              <PublicRoutes activeTab={activeTab} />
            </div>
          </div>
        ) : mfaChallenge.required ? (
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6">
            <MfaChallenge />
          </main>
        ) : (
          <PublicRoutes activeTab={activeTab} />
        )}

        {isPublicShell && !isStandalonePublicPage && !hideGlobalPublicFooter && (
          <footer className="print:hidden mt-auto border-t border-[#ece7f3] bg-white px-4 py-4 text-xs text-[#6f617b]">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p>(c) 2026 Prefeitura de Ipero - Secretaria Municipal de Saude</p>
                <p className="mt-1 font-medium">{APP_NAME} - Versao {APP_VERSION}</p>
              </div>
              <nav className="flex flex-wrap items-center gap-5" aria-label="Links institucionais">
                {[
                  { label: 'Privacidade', tab: 'privacidade' },
                  { label: 'Termos', tab: 'termos' },
                  { label: 'Contato', tab: 'contato' }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(item.tab)}
                    className="font-medium text-[#6f617b] hover:text-[var(--fibro-purple)]"
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </footer>
        )}
      </Tabs>
    </div>
  );
}
