# Carteirinha de Fibromialgia

Aplicacao web para cadastro, analise, aprovacao, emissao, impressao e validacao publica da CIPF municipal.

## Arquitetura Atual

- **Frontend:** React + Vite.
- **Banco de dados:** Supabase.
- **Hospedagem:** Firebase Hosting apenas para publicar o site estatico gerado em `dist/`.
- **Validacao publica:** QR Code aponta para o proprio app e consulta dados minimos somente pela RPC `validate_cipf_public`.
- **Autenticacao atual:** Supabase Auth em producao; login local fica so para desenvolvimento/testes controlados.
- **Autenticacao segura:** `VITE_AUTH_MODE="supabase"` ativa Supabase Auth, MFA TOTP no app e degradacao de admin sem `aal2`.
- **SQL canonico:** migracoes ficam em `supabase/migrations/`; SQLs raiz sao legado/manual.
- **Performance:** telas e bibliotecas pesadas, como PDF, QR e geracao de PNG, carregam sob demanda.

## Funcionalidades Principais

- Cadastro guiado com rascunho sensivel desativado por padrao.
- Validacao de CPF, Cartao SUS, datas, laudo, comprovante e CID.
- Alerta de possivel duplicidade por CPF e por nome/data de nascimento parecidos.
- Upload com pre-visualizacao, progresso e aviso quando o arquivo e pesado.
- Ciclo operacional: `under_review`, `approved`, `issued`, `expired`, `cancelled`.
- Dashboard com filtros por nome, CPF, Cartao SUS, CID, bairro, status, vencimento e pendencias documentais.
- Busca fixa no dashboard, atalho `Ctrl + K` para buscar e `Enter` para ir aos resultados.
- Card com os ultimos 5 cadastros acessados nesta maquina.
- Selo visual "Pronto para imprimir" quando a carteirinha esta aprovada e sem pendencias documentais.
- Ficha completa do cadastro com checklist documental, historico, status, dados e acoes de workflow.
- Exportacao CSV, CSV compativel com Excel e PDF.
- Carteirinha em PNG somente para administrador.
- Validacao publica por QR Code com dados minimos.
- Em `auth_mode=supabase`, aprovar, emitir, cancelar, renovar, arquivar e autorizar exportacao passam por RPC administrativa.
- Home publica usa metricas agregadas por RPC, sem expor dado nominal.
- Politica de privacidade e termos foram alinhados ao fluxo real do sistema.

## Rodar Localmente

1. Instale as dependencias:

   ```powershell
   npm install
   ```

2. Crie ou ajuste `.env.local` usando `.env.example` como modelo. O minimo para o app web e:

   ```env
   VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
   VITE_SUPABASE_ANON_KEY="SUA_CHAVE_PUBLICAVEL"
   VITE_APP_URL="http://localhost:5173"
   VITE_AUTH_MODE="local"
   VITE_ENABLE_SENSITIVE_DRAFTS="false"
   VITE_ALLOW_DEV_TOOLS="false"
   ```

3. Inicie o app:

   ```powershell
   npm.cmd run dev -- --host 127.0.0.1 --port 5173
   ```

4. Abra:

   ```text
   http://127.0.0.1:5173
   ```

## Comandos Uteis

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd audit --omit=dev
```

## MFA Admin no App

Fluxo Supabase:

1. Habilite `TOTP` em `Authentication -> Multi-Factor Authentication`.
2. Rode com `VITE_AUTH_MODE="supabase"`.
3. Entre com usuario admin.
4. Abra `Configuracoes`.
5. Use `Ativar MFA para liberar perfil administrador`.
6. Escaneie QR ou use chave manual.
7. Confirme codigo de 6 digitos.

Sem `aal2`, admin vira `viewer` por seguranca.

## SQL Versionado

SQL canonico agora:

- `supabase/migrations/`
- `supabase/tests/`

Ordem e notas:

- ver `supabase/README.md`

Em `VITE_AUTH_MODE="supabase"`, aplique ao menos:

1. `20260512090000_initial_schema.sql`
2. `20260512094000_storage_private_documents.sql`
3. `20260512095000_hardening_production.sql`
4. `20260514110000_public_home_metrics.sql`
5. `20260514133000_lgpd_hardening_exports_and_rls.sql`

## Publicar no Firebase Hosting

1. Gere o build:

   ```powershell
   npm.cmd run build
   ```

2. Publique somente o Hosting:

   ```powershell
   npx.cmd firebase-tools deploy --only hosting
   ```

## Observacoes de Seguranca

- Nao coloque `sb_secret`, service role key, senha do banco ou chaves administrativas em variaveis `VITE_*`.
- `VITE_SUPABASE_ANON_KEY` e publica por natureza em app frontend; a protecao real deve vir de RLS, Supabase Auth ou backend confiavel.
- O login local e adequado para MVP/testes controlados, mas nao substitui Auth/RLS em uso real com dados sensiveis.
- Para testar Supabase Auth, crie usuarios/perfis no Supabase, aplique as migracoes em `supabase/migrations/` e altere `VITE_AUTH_MODE` para `supabase`.
- Admin precisa ativar/validar MFA para obter `aal2`.
- Em modo Supabase, o frontend espera RPCs administrativas em `supabase/migrations/20260512095000_hardening_production.sql`:
  - `admin_transition_registration`
  - `admin_request_export`
- Rascunhos com dados sensiveis e DevTools ficam desativados por padrao por seguranca.
- Backup JSON integral foi desativado por protecao LGPD; use CSV compativel com Excel ou PDF.
- A exportacao Excel nativa foi removida junto com `xlsx`; use CSV compativel com Excel ou PDF.
- Leia `docs/lgpd/` para base legal minima, direitos do titular, resposta a incidente e inventario inicial de tratamento.
- Leia `SECURITY.md` e `AI_HANDOFF.md` antes de alterar regras de permissao, validacao publica, workflow ou banco.
