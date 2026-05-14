import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, KeyRound, Loader2, LockKeyhole, LogOut, ShieldCheck, Smartphone, UserCog } from 'lucide-react';
import { getSessionSecurityConfig, useAppStore, type AppUser } from '@/store/useAppStore';
import { getRoleLabel, hasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getAuthMode } from '@/lib/auth-mode';
import { Input } from '@/components/ui/input';

const APP_VERSION = String((import.meta as any).env?.VITE_APP_VERSION || '1.0.0');
const AUTH_MIGRATION_STATUS = 'Preparado para migrar para Supabase Auth/Backend seguro';
const IS_PRODUCTION = Boolean((import.meta as any).env?.PROD);
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'desconhecido';
const AUTH_MODE = getAuthMode((import.meta as any).env || {});

const TEST_USERS: Array<{ role: UserRole; name: string; description: string }> = [
  { role: 'admin', name: 'ADMINISTRADOR TESTE', description: 'Acesso total ao sistema.' },
  { role: 'attendant', name: 'ATENDENTE TESTE', description: 'Cadastro, edição, aprovação e renovação, sem impressão.' },
  { role: 'viewer', name: 'CONSULTA TESTE', description: 'Acesso básico para validação pública e configurações.' }
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
  ['clearDatabase', 'Arquivar base'],
  ['viewDocuments', 'Abrir documentos'],
  ['viewHistory', 'Ver histórico'],
  ['viewSettings', 'Ver configurações'],
  ['useDevTools', 'Usar ferramentas dev']
];

type MfaPanelState = {
  loading: boolean;
  busy: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedTotpCount: number;
  error: string;
  success: string;
  enrollFactorId: string;
  enrollQr: string;
  enrollSecret: string;
  enrollUri: string;
};

const INITIAL_MFA_PANEL_STATE: MfaPanelState = {
  loading: true,
  busy: false,
  currentLevel: null,
  nextLevel: null,
  verifiedTotpCount: 0,
  error: '',
  success: '',
  enrollFactorId: '',
  enrollQr: '',
  enrollSecret: '',
  enrollUri: ''
};

export function Configuracoes() {
  const { currentUser, setCurrentUser, logAudit, lockSession, logout, refreshCurrentUser } = useAppStore();
  const { idleTimeoutMs, maxSessionMs, loginMaxAttempts, lockoutMinutes } = getSessionSecurityConfig();
  const idleMinutes = Math.round(idleTimeoutMs / 60000);
  const maxHours = Math.round(maxSessionMs / 3600000);
  const [mfaPanel, setMfaPanel] = useState<MfaPanelState>(INITIAL_MFA_PANEL_STATE);
  const [enrollCode, setEnrollCode] = useState('');
  const [challengeCode, setChallengeCode] = useState('');

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

  const loadMfaState = async () => {
    if (!currentUser || AUTH_MODE !== 'supabase') return;

    setMfaPanel((state) => ({ ...state, loading: true, error: '', success: '' }));
    try {
      assertSupabaseConfigured();
      const [aalResult, factorsResult] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors()
      ]);

      if (aalResult.error) throw aalResult.error;
      if (factorsResult.error) throw factorsResult.error;

      setMfaPanel((state) => ({
        ...state,
        loading: false,
        currentLevel: aalResult.data.currentLevel,
        nextLevel: aalResult.data.nextLevel,
        verifiedTotpCount: factorsResult.data.totp.length
      }));
    } catch (error: any) {
      setMfaPanel((state) => ({
        ...state,
        loading: false,
        error: error?.message || 'Não foi possível carregar o status de MFA.'
      }));
    }
  };

  useEffect(() => {
    if (AUTH_MODE !== 'supabase' || !currentUser) return;
    void loadMfaState();
  }, [currentUser?.id, currentUser?.role]);

  const startMfaEnrollment = async () => {
    if (!currentUser) return;

    setMfaPanel((state) => ({ ...state, busy: true, error: '', success: '' }));
    setEnrollCode('');
    try {
      assertSupabaseConfigured();
      const factorsResult = await supabase.auth.mfa.listFactors();
      if (factorsResult.error) throw factorsResult.error;

      const unverifiedTotpFactors = factorsResult.data.all.filter(
        (factor) => factor.factor_type === 'totp' && factor.status !== 'verified'
      );

      for (const factor of unverifiedTotpFactors) {
        const removeResult = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeResult.error) throw removeResult.error;
      }

      const enrollResult = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `cipf-${currentUser.email}`
      });
      if (enrollResult.error) throw enrollResult.error;

      setMfaPanel((state) => ({
        ...state,
        busy: false,
        enrollFactorId: enrollResult.data.id,
        enrollQr: enrollResult.data.totp.qr_code,
        enrollSecret: enrollResult.data.totp.secret,
        enrollUri: enrollResult.data.totp.uri
      }));
    } catch (error: any) {
      setMfaPanel((state) => ({
        ...state,
        busy: false,
        error: error?.message || 'Não foi possível iniciar o MFA.'
      }));
    }
  };

  const verifyMfaEnrollment = async () => {
    if (!mfaPanel.enrollFactorId) return;

    setMfaPanel((state) => ({ ...state, busy: true, error: '', success: '' }));
    try {
      const verifyResult = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaPanel.enrollFactorId,
        code: enrollCode.trim()
      });
      if (verifyResult.error) throw verifyResult.error;

      await refreshCurrentUser();
      await loadMfaState();
      setEnrollCode('');
      setMfaPanel((state) => ({
        ...state,
        busy: false,
        enrollFactorId: '',
        enrollQr: '',
        enrollSecret: '',
        enrollUri: '',
        success: 'MFA ativado. Sessão promovida para administrador.'
      }));
    } catch (error: any) {
      setMfaPanel((state) => ({
        ...state,
        busy: false,
        error: error?.message || 'Não foi possível confirmar o MFA.'
      }));
    }
  };

  const verifyExistingMfa = async () => {
    setMfaPanel((state) => ({ ...state, busy: true, error: '', success: '' }));
    try {
      const factorsResult = await supabase.auth.mfa.listFactors();
      if (factorsResult.error) throw factorsResult.error;

      const factor = factorsResult.data.totp[0];
      if (!factor) throw new Error('Nenhum fator TOTP ativo encontrado.');

      const verifyResult = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: challengeCode.trim()
      });
      if (verifyResult.error) throw verifyResult.error;

      await refreshCurrentUser();
      await loadMfaState();
      setChallengeCode('');
      setMfaPanel((state) => ({
        ...state,
        busy: false,
        success: 'MFA validado. Perfil administrador liberado.'
      }));
    } catch (error: any) {
      setMfaPanel((state) => ({
        ...state,
        busy: false,
        error: error?.message || 'Não foi possível validar o MFA.'
      }));
    }
  };

  return (
    <div className="cipf-page cipf-page-stack mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Operação do sistema"
        title="Configurações e Segurança"
        description="Resumo visível de sessão, permissão e preparação para autenticação real da operação de Iperó."
        tone="purple"
        actions={
          <div className="cipf-subpanel bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-[var(--brand-ink)]">Versão {APP_VERSION}</p>
            <p className="text-xs text-[var(--brand-muted)]">Carteirinha de Fibromialgia de Iperó</p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="institutional-panel rounded-[1rem] p-5">
          <Clock className="mb-3 h-6 w-6 text-[#155c9c]" />
          <p className="text-sm font-black text-[#17324d]">Sessão</p>
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
          <p className="text-sm font-black text-[#17324d]">Autenticação</p>
          <p className="mt-2 text-sm text-[#617184]">{AUTH_MIGRATION_STATUS}</p>
        </div>
      </div>

      <div className="cipf-panel p-6">
        <div className="mb-5">
          <h3 className="text-lg font-black text-[#17324d]">Status do sistema</h3>
          <p className="text-sm text-[#617184]">Resumo rápido para suporte quando algo não abrir, salvar ou validar.</p>
        </div>
        {(AUTH_MODE !== 'supabase' || !IS_PRODUCTION) && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-black">Ambiente de testes / MVP</p>
            <p className="mt-1">
              O app ainda usa login local e depende de RLS permissiva para testes. Antes de dados reais, migrar para Supabase Auth/RLS.
            </p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['Supabase', isSupabaseConfigured ? 'Configurado' : 'Não configurado', isSupabaseConfigured],
            ['Hospedagem', 'Firebase Hosting / Vite estatico', true],
            ['Ambiente', IS_PRODUCTION ? 'Producao' : 'Local / desenvolvimento', true],
            ['Modo de login', AUTH_MODE === 'supabase' ? 'Supabase Auth' : 'Credencial local MVP', true],
            ['Origem atual', APP_ORIGIN, true],
            ['Exportacao Excel', 'Desativada: usar CSV/PDF para reduzir risco', true],
            ['Banco ativo', 'Supabase', true],
            ['Campos operacionais', 'Aviso, retirada, ultimo acesso e filas preparados', true],
            ['Checklist LGPD', AUTH_MODE === 'supabase' ? 'Auth/RLS em modo seguro' : 'Pendente para producao real', AUTH_MODE === 'supabase'],
            ['Relatorios', 'CSV, PDF e relatorio mensal disponiveis', true]
          ].map(([label, value, ok]) => (
            <div key={String(label)} className={`rounded-xl border p-4 ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <p className={`text-xs font-black uppercase tracking-wide ${ok ? 'text-green-700' : 'text-red-700'}`}>{String(label)}</p>
              <p className="mt-1 break-words text-sm font-semibold text-[#17324d]">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {AUTH_MODE === 'supabase' ? (
        <div className="cipf-panel p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4ecff] text-[var(--fibro-purple)]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#17324d]">MFA do administrador</h3>
              <p className="text-sm text-[#617184]">
                Ative TOTP para liberar o perfil administrador com `aal2`. O código pode ficar em autenticador no celular ou em cofre institucional no computador, como 1Password, Bitwarden, Authy Desktop ou Apple Senhas.
              </p>
            </div>
          </div>

          {mfaPanel.error ? (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mfaPanel.error}
            </div>
          ) : null}

          {mfaPanel.success ? (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {mfaPanel.success}
            </div>
          ) : null}

          {mfaPanel.loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#e3e9ef] bg-[#f8fafc] px-4 py-3 text-sm text-[#617184]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando status do MFA...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[#7d6c8c]">Nível atual</p>
                  <p className="mt-1 text-sm font-semibold text-[#17324d]">{mfaPanel.currentLevel || 'sem sessão'}</p>
                </div>
                <div className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[#7d6c8c]">Próximo nível</p>
                  <p className="mt-1 text-sm font-semibold text-[#17324d]">{mfaPanel.nextLevel || 'não disponível'}</p>
                </div>
                <div className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[#7d6c8c]">Fator TOTP</p>
                  <p className="mt-1 text-sm font-semibold text-[#17324d]">
                    {mfaPanel.verifiedTotpCount > 0 ? 'Ativo' : 'Não configurado'}
                  </p>
                </div>
              </div>

              {mfaPanel.verifiedTotpCount === 0 && !mfaPanel.enrollFactorId ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Sem TOTP ativo. Gere um QR code e cadastre em autenticador ou cofre institucional autorizado, não apenas em celular pessoal.
                  </p>
                  <Button type="button" onClick={() => void startMfaEnrollment()} className="mt-4" disabled={mfaPanel.busy}>
                    {mfaPanel.busy ? 'Gerando QR...' : 'Ativar MFA para liberar perfil administrador'}
                  </Button>
                </div>
              ) : null}

              {mfaPanel.enrollFactorId ? (
                <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                  <div className="rounded-xl border border-[#e3e9ef] bg-white p-4">
                    <p className="text-sm font-black text-[#17324d]">Escaneie o QR code</p>
                    <p className="mt-2 text-sm text-[#617184]">
                      Use aplicativo autenticador ou gerenciador de senhas com TOTP no computador.
                    </p>
                    <div className="mt-4 flex items-center justify-center rounded-xl border border-[#ece7f3] bg-[#faf7fd] p-4">
                      <img src={mfaPanel.enrollQr} alt="QR code MFA" className="h-56 w-56" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
                    <p className="text-sm font-black text-[#17324d]">Confirme o código</p>
                    <p className="mt-2 text-sm text-[#617184]">
                      Se não conseguir ler o QR, use a chave manual abaixo no autenticador. Guarde esta chave somente em cofre institucional autorizado.
                    </p>
                    <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-[#7d6c8c]">Chave manual</p>
                      <p className="mt-2 break-all font-mono text-sm text-[#17324d]">{mfaPanel.enrollSecret}</p>
                      <p className="mt-2 text-xs font-semibold text-amber-900">
                        Trate como senha. Não envie por WhatsApp, e-mail ou canal não autorizado.
                      </p>
                    </div>
                    <div className="mt-4">
                      <label htmlFor="mfa-enroll-code" className="mb-2 block text-sm font-bold text-[#170b24]">
                        Código de 6 dígitos
                      </label>
                      <Input
                        id="mfa-enroll-code"
                        value={enrollCode}
                        onChange={(event) => setEnrollCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        className="max-w-xs tracking-[0.35em]"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void verifyMfaEnrollment()} disabled={mfaPanel.busy || enrollCode.length < 6}>
                        {mfaPanel.busy ? 'Confirmando...' : 'Confirmar MFA'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMfaPanel((state) => ({ ...state, enrollFactorId: '', enrollQr: '', enrollSecret: '', enrollUri: '' }))}
                        disabled={mfaPanel.busy}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {mfaPanel.verifiedTotpCount > 0 && currentUser?.role === 'viewer' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    TOTP já existe, mas esta sessão ainda não validou o segundo fator. Consulte o autenticador ou cofre institucional autorizado.
                  </p>
                  <div className="mt-4">
                    <label htmlFor="mfa-login-code" className="mb-2 block text-sm font-bold text-[#170b24]">
                      Código atual do autenticador
                    </label>
                    <Input
                      id="mfa-login-code"
                      value={challengeCode}
                      onChange={(event) => setChallengeCode(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      className="max-w-xs tracking-[0.35em]"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void verifyExistingMfa()} disabled={mfaPanel.busy || challengeCode.length < 6}>
                      {mfaPanel.busy ? 'Validando...' : 'Liberar perfil administrador'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void logout()} disabled={mfaPanel.busy}>
                      Sair definitivo
                    </Button>
                  </div>
                </div>
              ) : null}

              {mfaPanel.verifiedTotpCount > 0 && currentUser?.role === 'admin' ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  MFA ativo e sessão já validada com `aal2`.
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="cipf-panel p-6">
        <div className="mb-5">
          <h3 className="text-lg font-black text-[#17324d]">Perfil atual</h3>
          <p className="text-sm text-[#617184]">
            {currentUser?.name || 'Usuário não identificado'} • {getRoleLabel(currentUser?.role)}
          </p>
          {currentUser?.accessNotice === 'admin_mfa_required' ? (
            <p className="mt-2 text-sm text-amber-800">
              Conta cadastrada como {getRoleLabel(currentUser.intendedRole)}, mas sessão sem MFA. SQL reduz acesso para Consulta.
            </p>
          ) : null}
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

      {currentUser?.accessNotice === 'admin_mfa_required' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-black">Ative MFA para liberar perfil administrador</p>
          <p className="mt-2">
            Seu usuário está cadastrado como {getRoleLabel(currentUser.intendedRole)}, mas a sessão atual não trouxe MFA nível `aal2`.
            Enquanto isso, banco reduz permissões para Consulta.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Ative MFA no usuário admin no Supabase Auth.</li>
            <li>Saia da sessão atual.</li>
            <li>Entre novamente completando o segundo fator.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair definitivo para relogar com MFA
            </Button>
          </div>
        </div>
      ) : null}

      {currentUser ? (
        <div className="cipf-panel p-6">
          <div className="mb-4">
            <h3 className="text-lg font-black text-[#17324d]">Sessao</h3>
            <p className="text-sm text-[#617184]">
              Bloquear preserva sessao Supabase e evita novo MFA enquanto `aal2` continuar valido. Prefira bloquear tela no dia a dia e use sair definitivo só quando precisar encerrar a sessão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void lockSession()}>
              <LockKeyhole className="mr-2 h-4 w-4" />
              Bloquear tela
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair definitivo
            </Button>
          </div>
        </div>
      ) : null}

      {!IS_PRODUCTION ? (
        <div className="cipf-panel p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf3fb] text-[#155c9c]">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#17324d]">Alternar usuario de teste</h3>
              <p className="text-sm text-[#617184]">
                Troca o perfil apenas nesta sessão do navegador. Use para testar permissão e telas sem digitar login novamente.
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
                    className="mt-4 w-full"
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
        <p className="font-black">Nota de segurança operacional</p>
        <p className="mt-1">
          O login local continua adequado para testes controlados. Para uso real, a proxima etapa recomendada e migrar para Supabase Auth ou backend com RLS aplicada.
        </p>
      </div>
    </div>
  );
}
