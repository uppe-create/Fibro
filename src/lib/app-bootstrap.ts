export const ROUTABLE_TABS = [
  'inicio',
  'acessibilidade',
  'contato',
  'privacidade',
  'suporte',
  'termos',
  'validar',
  'valida',
  'cadastros',
  'carteirinha',
  'cadastro',
  'dashboard',
  'pessoas',
  'operacao',
  'documentos',
  'retiradas',
  'relatorios',
  'auditoria',
  'governanca',
  'configuracoes',
  'dev'
] as const;

export const resolveInitialActiveTab = (pathname: string) => {
  const path = String(pathname || '').replace('/', '');
  if (!ROUTABLE_TABS.includes(path as (typeof ROUTABLE_TABS)[number])) return 'inicio';
  return ({ valida: 'validar', cadastros: 'pessoas' } as Record<string, string>)[path] || path;
};

export function sanitizeClientSessionBootstrap() {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('cipf_session_locked');
  } catch {
    // bootstrap must never crash app start
  }
}
