# Contexto minimo para IA

Use este arquivo antes de abrir o codigo. Ele existe para reduzir consumo de tokens.

## Stack
- React 19 + Vite + TypeScript.
- Supabase como banco ativo.
- Firebase Hosting apenas para hospedagem.
- Producao exige Supabase Auth (`VITE_AUTH_MODE="supabase"`); build prod bloqueia login local.
- RLS restritiva, Storage privado, validacao publica por RPC, CSP sem inline e auditoria RPC ja foram implementados.
- Admin sem MFA (`aal2`) cai como `viewer`; falta implementar tela MFA no app.

## Mapa de arquivos
- `src/App.tsx`: entrada fina; shell real fica em `src/app/*`.
- `src/app/AppShell.tsx`: shell, sessao, navegacao e layout.
- `src/app/NavigationTabs.tsx`: abas e menu responsivo.
- `src/app/PublicRoutes.tsx`: roteamento/protecao por permissao.
- `src/store/useAppStore.ts`: estado global, Supabase Auth, sessao e carregamento de cadastros.
- `src/modules/Cadastro.tsx`: maior arquivo; wizard, validacao, upload privado e gravacao.
- `src/modules/cadastro/components/*`: partes menores do cadastro; leia antes de abrir `Cadastro.tsx`.
- `src/modules/Valida.tsx`: validacao publica por QR, PDF/imagem e codigo manual.
- `src/modules/valida/lib/*`: scanner QR/PDF e RPC publica.
- `src/modules/Carteirinha.tsx`: tela de busca, emissao e download PNG.
- `src/components/CarteirinhaPreview.tsx`: arte fisica da carteirinha. Nao alterar sem teste visual.
- `src/modules/Operacao.tsx`: acoes sensiveis de admin.
- `src/modules/Pessoas.tsx`: lista, edicao, ficha e historico.
- `src/modules/dashboard/*`: hooks/componentes compartilhados para filtros, metricas, filas e modais.
- `src/lib/registration-status.ts`: status, labels e validade publica.
- `src/lib/permissions.ts`: permissoes por perfil.
- `src/lib/auth-mode.ts`: trava auth local em producao.
- `src/lib/file-security.ts`: validacao segura de upload.
- `src/lib/storage-files.ts`: Storage privado, metadados, URL assinada e rollback.
- `src/lib/audit.ts`: auditoria por RPC `log_audit_event`.
- `src/lib/dashboard-utils.ts`: helpers operacionais.

## Comandos eficientes
- `npm run ai:context`: mapa compacto e maiores arquivos.
- `npm run lint`: TypeScript sem build.
- `npm test`: unitarios.
- `npm run test:e2e`: Playwright.
- `npm run build`: build de producao.
- `git diff --stat`: resumo de mudancas.

## Proximas reducoes recomendadas
- Implementar fluxo MFA Supabase para admin.
- Extrair submit/upload do `Cadastro.tsx` para hook dedicado.
- Separar `Notifications.tsx` em `notificationRules.ts` e componente visual.
- Consolidar SQLs de producao em migracao versionada.
