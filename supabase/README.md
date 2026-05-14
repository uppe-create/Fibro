# Supabase SQL

Canonico agora:

- `supabase/migrations/`
- `supabase/tests/`

Arquivos `.sql` raiz:

- legado/manual
- manter por compatibilidade
- nao criar novos ali

## Ordem recomendada

1. `20260512090000_initial_schema.sql`
2. `20260512091000_workflow_status.sql`
3. `20260512092000_operational_fields.sql`
4. `20260512093000_auth_rls_prep.sql`
5. `20260512094000_storage_private_documents.sql`
6. `20260512095000_hardening_production.sql`
7. `20260514110000_public_home_metrics.sql`
8. `20260514133000_lgpd_hardening_exports_and_rls.sql`

## Testes

- `supabase/tests/rls_profile_smoke.sql`

## Notas

- `auth_rls_prep` prepara `app_profiles` e `current_app_role()`.
- `hardening_production` fecha RLS, rate limit, auditoria, MFA admin e RPCs seguras.
- `storage_private_documents` exige bucket privado `cipf-documents`.
- `hardening_production` agora inclui:
  - `admin_transition_registration`
  - `admin_request_export`
- `public_home_metrics` cria RPC agregada publica para home sem dado nominal.
- `lgpd_hardening_exports_and_rls`:
  - bloqueia `backup_json`
  - deixa delete de `registration_index` so para admin
  - reduz leitura direta de `public_validations`
- Em `VITE_AUTH_MODE="supabase"`, frontend espera estas RPCs aplicadas.
- Em `VITE_AUTH_MODE="local"`, MVP segue com fallback local para nao quebrar fluxo.
- Se `supabase db push` tentar reaplicar migration antiga em banco remoto ja existente, usar SQL Editor com migration incremental e alinhar historico antes de novo push completo.
