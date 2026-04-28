import { BadgeCheck, Clock, KeyRound, ShieldCheck, UserCog } from 'lucide-react';
import { getSessionSecurityConfig, useAppStore, type AppUser } from '@/store/useAppStore';
import { getRoleLabel, hasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';

const APP_VERSION = String((import.meta as any).env?.VITE_APP_VERSION || '1.0.0');
const AUTH_MIGRATION_STATUS = 'Preparado para migrar para Supabase Auth/Backend seguro';
const IS_PRODUCTION = Boolean((import.meta as any).env?.PROD);

const TEST_USERS: Array<{ role: UserRole; name: string; description: string }> = [
  { role: 'admin', name: 'ADMINISTRADOR TESTE', description: 'Acesso total ao sistema.' },
  { role: 'attendant', name: 'ATENDENTE TESTE', description: 'Cadastro, edicao, aprovacao e renovacao, sem impressao.' },
  { role: 'viewer', name: 'CONSULTA TESTE', description: 'Acesso basico para validacao publica e configuracoes.' }
];

const PERMISSION_LABELS: Array<[Permission, string]> = [
  ['viewCarteirinha', 'Consultar carteirinhas'],
  ['printCarteirinha', 'Imprimir carteirinhas'],
  ['viewDashboard', 'Acessar dashboard'],
  ['createRegistration', 'Cadastrar pessoas'],
  ['editRegistration', 'Editar cadastros'],
  ['approveRegistration', 'Aprovar cadastros'],
  ['issueRegistration', 'Emitir carteirinhas'],
  ['cancelRegistration', 'Cancelar cadastros'],
  ['renewRegistration', 'Renovar cadastros'],
  ['reissueRegistration', 'Registrar segunda via'],
  ['deleteRegistration', 'Excluir cadastros'],
  ['exportDashboard', 'Exportar relatorios'],
  ['clearDatabase', 'Limpar banco'],
  ['viewDocuments', 'Abrir documentos'],
  ['viewHistory', 'Ver historico'],
  ['viewSettings', 'Ver configuracoes'],
  ['useDevTools', 'Usar ferramentas dev']
];

export function Configuracoes() {
  const { currentUser, setCurrentUser, logAudit } = useAppStore();
  const { idleTimeoutMs, maxSessionMs, loginMaxAttempts, lockoutMinutes } = getSessionSecurityConfig();
  const idleMinutes = Math.round(idleTimeoutMs / 60000);
  const maxHours = Math.round(maxSessionMs / 3600000);

  const switchUser = async (role: UserRole, name: string) => {
    const nextUser: AppUser = {
      id: `switch-${role}`,
      name,
      email: `${role}@teste.local`,
      role
    };
    await logAudit('Alternancia de Perfil', `Perfil alterado para ${getRoleLabel(role)}`);
    setCurrentUser(nextUser);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-500">
      <div className="institutional-panel rounded-[1.25rem] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#617184]">Operacao do sistema</p>
            <h2 className="mt-1 text-2xl font-black text-[#17324d]">Configuracoes e Seguranca</h2>
            <p className="mt-2 text-sm text-[#617184]">Resumo visivel de sessao, permissao e preparacao para autenticacao real.</p>
          </div>
          <div className="rounded-xl border border-[#d9e1ea] bg-[#f8fafc] px-4 py-3 text-sm">
            <p className="font-black text-[#17324d]">Versao {APP_VERSION}</p>
            <p className="text-xs text-[#617184]">Carteirinha de Fibromialgia</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="institutional-panel rounded-[1rem] p-5">
          <Clock className="mb-3 h-6 w-6 text-[#155c9c]" />
          <p className="text-sm font-black text-[#17324d]">Sessao</p>
          <p className="mt-2 text-sm text-[#617184]">Inatividade: {idleMinutes} min</p>
          <p className="text-sm text-[#617184]">Duracao maxima: {maxHours} h</p>
        </div>
        <div className="institutional-panel rounded-[1rem] p-5">
          <ShieldCheck className="mb-3 h-6 w-6 text-[#1f8a58]" />
          <p className="text-sm font-black text-[#17324d]">Login local</p>
          <p className="mt-2 text-sm text-[#617184]">Bloqueio apos {loginMaxAttempts} tentativas</p>
          <p className="text-sm text-[#617184]">Pausa: {lockoutMinutes} min</p>
        </div>
        <div className="institutional-panel rounded-[1rem] p-5">
          <KeyRound className="mb-3 h-6 w-6 text-[#8a6500]" />
          <p className="text-sm font-black text-[#17324d]">Autenticacao</p>
          <p className="mt-2 text-sm text-[#617184]">{AUTH_MIGRATION_STATUS}</p>
        </div>
      </div>

      <div className="institutional-panel rounded-[1.25rem] p-6">
        <div className="mb-5">
          <h3 className="text-lg font-black text-[#17324d]">Perfil atual</h3>
          <p className="text-sm text-[#617184]">
            {currentUser?.name || 'Usuario nao identificado'} • {getRoleLabel(currentUser?.role)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PERMISSION_LABELS.map(([permission, label]) => {
            const allowed = hasPermission(currentUser, permission);
            return (
              <div key={permission} className={`rounded-xl border p-3 ${allowed ? 'border-green-200 bg-green-50' : 'border-[#e3e9ef] bg-[#f8fafc]'}`}>
                <div className="flex items-center gap-2">
                  <BadgeCheck className={`h-4 w-4 ${allowed ? 'text-green-600' : 'text-[#9ca3af]'}`} />
                  <p className={`text-sm font-semibold ${allowed ? 'text-green-800' : 'text-[#617184]'}`}>{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!IS_PRODUCTION ? (
        <div className="institutional-panel rounded-[1.25rem] p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf3fb] text-[#155c9c]">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#17324d]">Alternar usuario de teste</h3>
              <p className="text-sm text-[#617184]">
                Troca o perfil apenas nesta sessao do navegador. Use para testar permissao e telas sem digitar login novamente.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {TEST_USERS.map((user) => {
              const isCurrentRole = currentUser?.role === user.role && currentUser?.id === `switch-${user.role}`;
              return (
                <div key={user.role} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <p className="font-black text-[#17324d]">{getRoleLabel(user.role)}</p>
                  <p className="mt-1 min-h-[40px] text-sm text-[#617184]">{user.description}</p>
                  <Button
                    type="button"
                    variant={isCurrentRole ? 'outline' : 'default'}
                    onClick={() => switchUser(user.role, user.name)}
                    className={`mt-4 h-10 w-full rounded-xl ${isCurrentRole ? '' : 'bg-[#17324d] text-white hover:bg-[#10263b]'}`}
                    disabled={isCurrentRole}
                  >
                    {isCurrentRole ? 'Perfil atual' : `Usar ${getRoleLabel(user.role)}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#d9e1ea] bg-[#f8fafc] p-5 text-sm text-[#617184]">
          Alternador de usuarios de teste oculto em producao.
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-black">Nota de seguranca operacional</p>
        <p className="mt-1">
          O login local continua adequado para testes controlados. Para uso real, a proxima etapa recomendada e migrar para Supabase Auth ou backend com RLS aplicada.
        </p>
      </div>
    </div>
  );
}
