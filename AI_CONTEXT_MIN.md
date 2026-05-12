# Contexto minimo para IA

Use este arquivo antes de abrir o codigo. Ele existe para reduzir consumo de tokens.

## Stack
- React 19 + Vite + TypeScript.
- Supabase como banco ativo.
- Firebase Hosting apenas para hospedagem.
- Producao exige Supabase Auth (`VITE_AUTH_MODE="supabase"`); build prod bloqueia login local.
- RLS restritiva, Storage privado, validacao publica por RPC, CSP sem inline e auditoria RPC ja foram implementados.
- Admin sem MFA (`aal2`) cai como `viewer`; app ja tem desafio MFA e painel em Configuracoes.
- SQL canonico vive em `supabase/migrations/`; SQL raiz e legado/manual.

## Mapa de arquivos
- `src/App.tsx`: entrada fina; shell real fica em `src/app/*`.
- `src/app/AppShell.tsx`: shell, sessao, navegacao e layout.
- `src/app/NavigationTabs.tsx`: abas e menu responsivo.
- `src/app/PublicRoutes.tsx`: roteamento/protecao por permissao.
- `src/store/useAppStore.ts`: estado global, Supabase Auth, MFA, sessao e carregamento de cadastros.
- `src/modules/MfaChallenge.tsx`: desafio TOTP para liberar sessao `aal2`.
- `src/modules/Cadastro.tsx`: wizard principal; submit/upload fica em hook dedicado.
- `src/modules/cadastro/components/*`: partes menores do cadastro; leia antes de abrir `Cadastro.tsx`.
- `src/modules/cadastro/hooks/useCadastroSubmit.ts`: validacao final, Storage privado, upsert publico e rollback.
- `src/modules/Valida.tsx`: validacao publica por QR, PDF/imagem e codigo manual.
- `src/modules/valida/lib/*`: scanner QR/PDF e RPC publica.
- `src/modules/Carteirinha.tsx`: tela de busca, emissao e download PNG.
- `src/components/CarteirinhaPreview.tsx`: arte fisica da carteirinha. Nao alterar sem teste visual.
- `src/modules/Operacao.tsx`: acoes sensiveis de admin.
- `src/modules/Pessoas.tsx`: lista, edicao, ficha e historico.
- `src/modules/dashboard/*`: hooks/componentes compartilhados para filtros, metricas, filas e modais.
- `src/modules/dashboard/hooks/useRegistrationWorkflow.ts`: aprovar, emitir, cancelar, renovar, retirada e auditoria.
- `src/modules/dashboard/hooks/useDashboardExports.ts`: CSV/PDF, auditoria e protecao CSV Injection.
- `src/lib/registration-status.ts`: status, labels e validade publica.
- `src/lib/permissions.ts`: permissoes por perfil.
- `src/lib/auth-mode.ts`: trava auth local em producao.
- `src/lib/admin-rpc.ts`: chamadas `admin_transition_registration` e `admin_request_export`.
- `src/lib/file-security.ts`: validacao segura de upload.
- `src/lib/storage-files.ts`: Storage privado, metadados, URL assinada e rollback.
- `src/lib/audit.ts`: auditoria por RPC `log_audit_event`.
- `src/lib/dashboard-utils.ts`: helpers operacionais.

## Comandos eficientes
- `npm run ai:context`: mapa compacto e maiores arquivos.
- `npm run lint`: TypeScript sem build.
- `npm run typecheck`: alias de TypeScript sem build.
- `npm test`: unitarios.
- `npm run test:e2e`: Playwright.
- `npm run build`: build de producao.
- `git diff --stat`: resumo de mudancas.

## Proximas reducoes recomendadas
- Endurecer acoes operacionais migrando mais caminhos para RPC/Edge Functions.
- Consolidar/aplicar sempre via `supabase/migrations/`.
- Ampliar e2e autenticado por perfil.
