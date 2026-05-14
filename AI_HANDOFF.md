# AI Handoff - Carteirinha de Fibromialgia

Arquivo para outra IA ou outro dev entrar rapido.
Nunca salvar aqui senhas, secrets, service role, `sb_secret` ou dados reais.

## Ideia do Produto

App para cadastro, analise, emissao, impressao e validacao publica da CIPF municipal.

Fluxo:

1. Usuario interno entra.
2. Atendente/admin cadastra pessoa e anexa documentos.
3. Cadastro novo entra `under_review`.
4. Admin ou atendente aprova para `approved`.
5. Admin emite para `issued`.
6. Publico valida por QR Code e ve so dados minimos.

## Estado Tecnico Atual

- React + Vite.
- Supabase como banco.
- Firebase so para Hosting.
- Producao exige `VITE_AUTH_MODE="supabase"`.
- Login local segue para MVP/teste.
- Supabase Auth ja ativo.
- Admin sem MFA cai para `viewer`.
- MFA TOTP no app ja existe em `Configuracoes` e `MfaChallenge`.
- RLS restritiva aplicada via SQL.
- Validacao publica usa so `validate_cipf_public(text, text)`.
- Auditoria usa `log_audit_event`.
- Documentos novos usam Storage privado `cipf-documents`.
- Em `auth_mode=supabase`, aprovar, emitir, cancelar, renovar, arquivar e autorizar exportacao passam por RPC administrativa.

## Arquivos Principais

- `src/App.tsx`: entrada fina.
- `src/app/AppShell.tsx`: shell, sessao, navegacao, lazy modules e bloqueio MFA.
- `src/app/PublicRoutes.tsx`: rotas publicas/protegidas.
- `src/store/useAppStore.ts`: auth, MFA, sessao, registros e limpeza.
- `src/lib/permissions.ts`: matriz unica de permissoes.
- `src/lib/auth-mode.ts`: trava auth insegura em producao.
- `src/lib/admin-rpc.ts`: ponte frontend para RPC administrativa.
- `src/lib/audit.ts`: auditoria RPC.
- `src/lib/file-security.ts`: validacao central de upload.
- `src/lib/storage-files.ts`: upload privado e signed URL.
- `src/modules/Cadastro.tsx`: UI do cadastro.
- `src/modules/cadastro/hooks/useCadastroSubmit.ts`: submit, upload, rollback, auditoria.
- `src/components/Notifications.tsx`: casca visual do sino.
- `src/components/notifications/notificationRules.ts`: regras puras de notificacao.
- `src/components/notifications/useNotifications.ts`: agregador de notificacoes.
- `src/components/notifications/NotificationCard.tsx`: render de secao.
- `src/modules/dashboard/hooks/useRegistrationWorkflow.ts`: workflow admin/local com RPC em modo Supabase.
- `src/modules/dashboard/hooks/useDashboardExports.ts`: exportacao com autorizacao RPC em modo Supabase.
- `src/modules/Configuracoes.tsx`: setup e verify de MFA.
- `src/modules/MfaChallenge.tsx`: segundo fator no login.
- `src/modules/Valida.tsx`: validacao publica.
- `src/lib/public-home-metrics.ts`: RPC publica agregada da home.
- `docs/lgpd/*`: base legal, direitos do titular, incidente e inventario inicial.

## SQL e Banco

Canonico:

- `supabase/migrations/`
- `supabase/tests/`

Legado/manual:

- SQLs `.sql` na raiz

Migracoes principais:

- `20260512090000_initial_schema.sql`
- `20260512091000_workflow_status.sql`
- `20260512092000_operational_fields.sql`
- `20260512093000_auth_rls_prep.sql`
- `20260512094000_storage_private_documents.sql`
- `20260512095000_hardening_production.sql`
- `20260514110000_public_home_metrics.sql`
- `20260514133000_lgpd_hardening_exports_and_rls.sql`

Teste SQL:

- `supabase/tests/rls_profile_smoke.sql`

RPCs criticas:

- `validate_cipf_public`
- `log_audit_event`
- `admin_transition_registration`
- `admin_request_export`
- `get_home_metrics`

## Regras de Negocio

- CPF unico via `registration_index`.
- CID esperado `M79.7`; fora disso exige justificativa.
- Comprovante ate 90 dias.
- Laudo ate 6 meses.
- Menor de 18 exige responsavel legal.
- CNS opcional, 15 digitos se informado.
- Validade padrao: 2 anos da emissao.
- Status: `under_review`, `approved`, `issued`, `expired`, `cancelled`.
- Cancelamento exige motivo.
- Renovacao volta para `approved`.
- Segunda via exige motivo e auditoria.
- Validacao publica positiva so para `issued`.

## Seguranca

Validado:

1. `anon` nao le `registrations`.
2. `anon` nao le `public_validations`.
3. `anon` nao grava `audit_logs`.
4. `validate_cipf_public` responde ao publico.
5. Admin sem MFA vira `viewer`.
6. Storage privado nao expoe objeto para `anon`.
7. Workflow sensivel usa RPC em `auth_mode=supabase`.
8. Backup JSON integral foi desabilitado.
9. Politica de privacidade evita claims sem implementacao comprovada.

Ainda depende de configuracao no Supabase:

1. Aplicar migracoes versionadas no projeto certo.
2. Habilitar TOTP em `Authentication -> Multi-Factor Authentication`.
3. Criar usuarios/perfis em `auth.users` + `app_profiles`.
4. Testar conta atendente real.

## Padrao de Edicao

- Permissao: `src/lib/permissions.ts`.
- Status/workflow: `src/lib/registration-status.ts`.
- Acao sensivel: primeiro backend, depois UI.
- Publico: nunca ler `registrations` direto.
- Documento novo: usar Storage privado, nao Base64 novo.
- Auditoria: usar `logAuditEvent`.
- Em `auth_mode=supabase`: nao usar `update()` direto para aprovar/emitir/cancelar/renovar/arquivar/exportar.

## Proximos Cortes

- Migrar `notifyPatient`, `registerPickup` e `clearDatabase` para RPC/Edge.
- Remover SQL legado da raiz quando deploy usar so `supabase/migrations`.
- Adicionar E2E Supabase Auth real com ambiente de teste dedicado.
- Alinhar historico remoto de migrations antes de voltar a usar `supabase db push`.
