# AGENTS.md

Guia para agentes de IA e devs trabalhando neste repositorio.

## Regra de Comunicacao

- Responder em portugues quando usuario falar portugues.
- Ser curto, direto e tecnico.
- Nao usar artigos, enchimento ou explicacao longa sem pedido.
- Se usuario pedir codigo, entregar codigo.
- Explicar so quando ajuda decisao, risco ou verificacao.

## Contexto do Projeto

Aplicacao web municipal para cadastro, analise, aprovacao, emissao, impressao e validacao publica da CIPF, Carteira de Identificacao da Pessoa com Fibromialgia.

Fluxo principal:

1. Usuario interno autentica.
2. Atendente/admin cadastra pessoa e anexa documentos.
3. Cadastro entra como `under_review`.
4. Admin ou atendente aprova, mudando para `approved`.
5. Somente admin emite/imprime/baixa PNG, mudando para `issued`.
6. Publico valida via QR Code com dados minimos.

## Stack

- Frontend: React 19 + Vite + TypeScript.
- Estado global: Zustand.
- Formularios/validacao: React Hook Form + Zod.
- Banco ativo: Supabase.
- Auth: Supabase Auth em producao; login local so para desenvolvimento/testes.
- MFA: admin precisa de `aal2`; app tem desafio TOTP e painel em Configuracoes.
- Hosting: Firebase Hosting para `dist/`.
- Testes: Vitest e Playwright.
- UI: CSS/Tailwind v4, componentes em `src/components/ui`, icones `lucide-react`.

## Comandos

Usar PowerShell no Windows.

```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run ai:context
npm.cmd audit --omit=dev
```

Notas:

- `npm run lint` roda `tsc --noEmit`.
- `npm run build` e obrigatorio antes de considerar mudanca pronta para deploy.
- `npm run ai:context` gera mapa compacto do projeto e deve ser usado antes de leitura pesada.
- Para deploy: `npm.cmd run build`, depois `npx.cmd firebase-tools deploy --only hosting`.

## Arquivos de Contexto

Ler antes de mexer em area sensivel:

- `AI_CONTEXT_MIN.md`: mapa curto para IA.
- `AI_HANDOFF.md`: estado tecnico, regras de negocio e arquivos principais.
- `SECURITY.md`: regras de seguranca e riscos.
- `README.md`: arquitetura e fluxo local.

## Mapa do Codigo

- `src/App.tsx`: entrada fina.
- `src/main.tsx`: bootstrap React.
- `src/app/AppShell.tsx`: shell, sessao, navegacao e layout.
- `src/app/NavigationTabs.tsx`: abas e menu responsivo.
- `src/app/PublicRoutes.tsx`: rotas publicas/protegidas.
- `src/app/appModules.tsx`: lazy loading dos modulos.
- `src/store/useAppStore.ts`: estado global, sessao, auth, carregamento e operacoes.
- `src/modules/Cadastro.tsx`: wizard principal de cadastro.
- `src/modules/cadastro/*`: componentes, hooks e libs do cadastro.
- `src/modules/cadastro/hooks/useCadastroSubmit.ts`: validacao final, Storage privado, upsert publico e rollback.
- `src/modules/Pessoas.tsx`: lista, ficha, edicao e historico.
- `src/modules/Dashboard.tsx`: KPIs, filtros, filas e acoes de dashboard.
- `src/modules/dashboard/*`: partes extraidas do dashboard.
- `src/modules/Carteirinha.tsx`: busca, emissao e download PNG.
- `src/components/CarteirinhaPreview.tsx`: layout visual da carteirinha.
- `src/modules/Valida.tsx`: validacao publica por QR/codigo.
- `src/modules/valida/lib/*`: scanner QR/PDF e RPC publica.
- `src/modules/Operacao.tsx`: acoes sensiveis.
- `src/modules/Configuracoes.tsx`: sessao, permissoes e status do sistema.
- `src/modules/MfaChallenge.tsx`: desafio TOTP MFA.
- `src/lib/permissions.ts`: matriz unica de papeis/permissoes.
- `src/lib/registration-status.ts`: status, labels, validade e workflow.
- `src/lib/auth-mode.ts`: trava login local em producao.
- `src/lib/admin-rpc.ts`: RPCs `admin_transition_registration` e `admin_request_export`.
- `src/lib/file-security.ts`: validacao de uploads.
- `src/lib/storage-files.ts`: Storage privado, metadados, URL assinada e rollback.
- `src/lib/cipf-files.ts`: leitura Storage e fallback legado Base64.
- `src/lib/audit.ts`: auditoria via RPC.
- `src/lib/audit-events.ts`: nomes/eventos de auditoria.
- `src/lib/audit-history.ts`: historico auditavel.
- `src/lib/dashboard-utils.ts`: filtros, KPIs e helpers puros.
- `src/lib/cadastro-utils.ts`: schema, normalizacoes, upload e checksum.
- `src/lib/utils.ts`: utilitarios gerais e mensagens seguras.

## SQL e Supabase

- `supabase/migrations/`: fonte canonica atual.
- `supabase/tests/rls_profile_smoke.sql`: smoke tests por perfil.
- SQLs `.sql` na raiz: legado/manual para compatibilidade.

Tabelas importantes:

- `registrations`: cadastro completo e dados sensiveis.
- `registration_index`: indice de CPF ativo.
- `public_validations`: dados minimos para validacao.
- `cipf_storage_files`: metadados de documentos no Storage privado.
- `cipf_files` e `cipf_file_chunks`: arquivos legados Base64/chunks.
- `audit_logs`: auditoria gravada via RPC.

## Regras de Seguranca

- Nunca commitar `.env.local`, chaves reais, senha real, service role key, `sb_secret`, token admin ou dados reais de pacientes.
- Nunca colocar segredo em variavel `VITE_*`; tudo `VITE_*` vai para o bundle publico.
- `VITE_SUPABASE_ANON_KEY` e publica por natureza; seguranca vem de Auth, RLS, RPC e Storage privado.
- Producao exige `VITE_AUTH_MODE="supabase"`.
- Login local so pode existir em desenvolvimento/teste controlado.
- Admin sem MFA (`aal2`) deve cair como `viewer`.
- Tela publica nunca deve ler `registrations`.
- Tela publica deve usar RPC segura, hoje `validate_cipf_public(text, text)`.
- Validacao publica deve retornar apenas dados minimos.
- Documentos novos devem usar Storage privado `cipf-documents`.
- Novos documentos nao devem ser salvos em Base64; Base64/chunks e fallback legado.
- Acoes sensiveis devem chamar `logAuditEvent`, que usa RPC `log_audit_event`.
- Quando disponivel, preferir RPCs operacionais `admin_transition_registration` e `admin_request_export`.
- Erros exibidos ao usuario devem passar por mensagem segura, sem vazar detalhe interno de banco.
- CSV exportado deve proteger contra CSV Injection.
- Rascunho sensivel fica desativado por padrao.
- DevTools fica desativado por padrao e nunca deve apontar para banco real em teste destrutivo.

## Papeis e Permissoes

Sempre usar `hasPermission(...)` de `src/lib/permissions.ts`.

- `admin`: aprova, emite, imprime, baixa PNG, cancela, renova, segunda via, exporta, arquiva/exclui, limpa banco e usa DevTools.
- `attendant`: cadastra, edita, consulta dashboard, ve laudo/historico, aprova e renova. Nao imprime.
- `viewer`: consulta basica. Nao acessa dashboard, cadastro nem impressao.

Nunca liberar impressao, emissao, limpeza de banco ou DevTools para `attendant` ou `viewer`.

## Status e Workflow

Status atuais:

- `under_review`: cadastro recebido, ainda sem validacao publica positiva.
- `approved`: aprovado, aguardando emissao.
- `issued`: emitido, validavel publicamente se nao vencido.
- `expired`: vencido.
- `cancelled`: cancelado/arquivado.

Legados:

- `active` deve ser tratado como `issued`.
- `pending` deve ser tratado como `under_review`.

Regras:

- Cadastro novo entra como `under_review`.
- Validacao publica positiva somente para `issued` ou legado `active`, com validade nao vencida.
- Emissao/impressao e apenas admin.
- Cancelamento exige motivo no fluxo operacional.
- Renovacao volta para `approved`.
- Segunda via exige motivo e auditoria.
- Arquivamento operacional usa `cancelled`, nao exclusao fisica imediata.

## Regras de Negocio

- CPF e unico para carteirinha ativa via `registration_index`.
- CID padrao esperado: `M79.7`.
- CID diferente exige justificativa medica.
- Comprovante de residencia nao pode ter mais de 90 dias.
- Laudo medico nao pode ter mais de 6 meses.
- Menor de 18 anos exige responsavel legal.
- CNS/Cartao SUS e opcional; se informado, deve ter 15 digitos.
- Validade padrao da carteirinha: 2 anos a partir da emissao.
- Selo "Pronto para imprimir" aparece quando cadastro esta `approved` e sem pendencias documentais.
- Exportacao Excel nativa foi removida; manter CSV, CSV compativel com Excel e PDF.

## Padroes de Edicao

- Antes de editar, rode `git status --short`.
- Nao reverter mudancas de outro autor.
- Manter mudancas pequenas, focadas e compativeis com padroes locais.
- Preferir helpers existentes em `src/lib` antes de criar nova logica.
- Para permissao, comecar por `src/lib/permissions.ts`.
- Para status/workflow, comecar por `src/lib/registration-status.ts`.
- Para upload/documento, usar `file-security.ts`, `storage-files.ts` e `cipf-files.ts`.
- Para dado publico, nunca consultar `registrations`; usar RPC publica.
- Para campo novo no cadastro, atualizar tipo/schema, insert/update Supabase, ficha, exportacao, SQL e carteirinha se exibido.
- Para dependencia nova, justificar necessidade e rodar `npm.cmd audit --omit=dev`.
- Evitar refactor amplo junto de feature pequena.
- Evitar comentarios obvios; comentar so bloco complexo ou regra critica.
- Manter ASCII em arquivos novos quando possivel.

## Padroes de UI

- Usar componentes existentes em `src/components/ui`.
- Usar `lucide-react` para icones.
- UI operacional deve ser densa, clara e escaneavel.
- Evitar hero/marketing em telas internas.
- Evitar cards dentro de cards.
- Textos devem caber em mobile e desktop.
- Nao quebrar acessibilidade: label, foco, contraste, teclado e estados de erro.
- Para mudanca em `CarteirinhaPreview.tsx`, fazer teste visual.
- Para fluxo/tela grande, validar em navegador local.

## Testes e Verificacao

Escolher menor conjunto que cobre risco:

- Mudanca de helper puro: `npm.cmd test -- <arquivo ou filtro>` quando possivel; senao `npm.cmd test`.
- Mudanca de tipos/permissoes/status: `npm.cmd run lint` e testes unitarios relacionados.
- Mudanca visual/fluxo: `npm.cmd run lint`, `npm.cmd run build`, teste manual no navegador.
- Mudanca em QR/validacao publica: testar `Valida`, RPC esperada e ausencia de leitura direta de tabela sensivel.
- Mudanca em RLS/SQL: rodar smoke tests de perfil no Supabase antes de uso real.
- Mudanca de upload/documento: testar MIME, tamanho, URL assinada e rollback.
- Mudanca de build/deploy: `npm.cmd run build` obrigatorio.

## Git

- Nao usar `git reset --hard`.
- Nao usar `git checkout --` para descartar arquivo sem pedido explicito.
- Nao commitar sem pedido.
- Nao stagear arquivos fora do escopo.
- Se criar branch para agente, usar prefixo `codex/`, salvo pedido contrario.
- Antes de commit/PR, revisar `git diff --stat` e `git diff`.

## Riscos Conhecidos

- Fluxo MFA ainda e ponto sensivel; admin sem `aal2` deve permanecer `viewer`.
- Acoes operacionais ainda rodam pelo frontend autenticado; futuro ideal e RPC/Edge Functions.
- IP auditado por RPC depende de headers repassados pelo Supabase.
- SQLs de producao precisam cuidado de ordem e ambiente.
- Dados de saude exigem minima exposicao e logs limpos.

## Proximas Melhorias Recomendadas

- Manter fluxo MFA validado em ambiente real para admin obter `aal2`.
- Continuar reduzindo `Cadastro.tsx`; submit/upload ja esta em hook dedicado.
- Separar regras de notificacao de componente visual.
- Usar sempre `supabase/migrations/` como fonte canonica.
- Migrar aprovar/emitir/cancelar/exportar para RPCs ou Edge Functions.
- Adicionar e2e autenticado por perfil.
