# AI Handoff - Carteirinha de Fibromialgia

Este arquivo existe para acelerar outra IA ou outro dev que precise mexer no projeto.
Nao inclua aqui senhas, chaves secretas, service role, `sb_secret` ou dados reais de pacientes.

## Ideia do Produto

O app emite, consulta, imprime e valida publicamente a CIPF, Carteira de Identificacao da Pessoa com Fibromialgia, para uso municipal.

Fluxo principal:

1. Usuario interno faz login.
2. Atendente/admin cadastra a pessoa e anexa documentos.
3. Novo cadastro entra como `under_review`, sem validacao publica positiva.
4. Admin ou atendente aprova o cadastro, mudando para `approved`.
5. Somente admin emite/imprime/baixa PNG; nesse momento o status vira `issued`.
6. Qualquer pessoa com QR Code acessa a validacao publica e ve apenas dados minimos.

## Estado Tecnico Atual

- React + Vite.
- Supabase e o banco ativo.
- Firebase e apenas Hosting.
- Login local continua como padrao do MVP.
- Supabase Auth esta preparado por `VITE_AUTH_MODE="supabase"`, mas nao deve ser ligado sem criar usuarios/perfis antes.
- RLS restritiva ainda nao deve ser aplicada no banco vivo sem testar Auth/perfis.
- Telas e bibliotecas pesadas sao carregadas sob demanda com `React.lazy` e `import()`.
- Rascunho sensivel fica desativado por padrao; `VITE_ENABLE_SENSITIVE_DRAFTS="true"` so deve ser usado em teste controlado.
- DevTools fica desativado por padrao; `VITE_ALLOW_DEV_TOOLS="true"` so deve apontar para banco descartavel.

## Arquivos Principais

- `src/App.tsx`: shell do app, abas, lazy loading, protecao por permissao e timeout de sessao.
- `src/store/useAppStore.ts`: estado global, login local, preparo para Supabase Auth, sessao, busca de registros e operacoes globais.
- `src/lib/permissions.ts`: matriz unica de papeis e permissoes. Comece aqui para qualquer regra de acesso.
- `src/lib/registration-status.ts`: helpers centrais de status, labels, validade publica e workflow.
- `src/lib/dashboard-utils.ts`: filtros, KPIs, checklist documental, `isReadyToPrint` e helpers puros do dashboard.
- `src/lib/cadastro-utils.ts`: schema do cadastro, normalizacoes, upload, recorte de foto e checksum.
- `src/lib/cipf-files.ts`: recupera documentos salvos em chunks Base64 no Supabase.
- `src/modules/Cadastro.tsx`: formulario, rascunho local, upload, conferencia antierro e gravacao do cadastro.
- `src/modules/Dashboard.tsx`: KPIs, filtros, busca fixa, atalhos, fila operacional, ultimos acessados, ficha, historico, edicao e exportacoes.
- `src/modules/Carteirinha.tsx`: busca de cadastro aprovado/emitido e download da carteirinha em PNG.
- `src/components/CarteirinhaPreview.tsx`: layout imprimivel da carteirinha frente/verso.
- `src/modules/Valida.tsx`: pagina publica do QR Code; deve retornar apenas dados minimos.
- `src/modules/Configuracoes.tsx`: status do sistema, permissoes, sessao e alternador de usuario apenas fora de producao.
- `SECURITY.md`: resumo de seguranca e cuidados antes de producao real.

## SQL e Banco

- `supabase-schema.sql`: schema MVP atual.
- `supabase-workflow-status-migration.sql`: migracao segura de status antigos.
- `supabase-auth-rls-prep.sql`: prepara `app_profiles` para Supabase Auth.
- `supabase-hardening-production.sql`: modelo de RLS mais restritivo para producao real.

Tabelas principais:

- `registrations`: cadastro completo e dados sensiveis.
- `registration_index`: indice por CPF para evitar duplicidade ativa.
- `public_validations`: dados minimos para consulta publica.
- `cipf_files` e `cipf_file_chunks`: arquivos anexos em Base64 chunked.
- `audit_logs`: trilha de auditoria.

## Regras de Negocio

- CPF e unico para carteirinha ativa via `registration_index`.
- CID padrao esperado e `M79.7`; CID diferente exige justificativa medica.
- Comprovante de residencia nao pode ter mais de 90 dias.
- Laudo medico nao pode ter mais de 6 meses.
- Menor de 18 anos exige responsavel legal.
- CNS/Cartao SUS e opcional, mas se informado deve ter 15 digitos.
- Validade padrao da carteirinha: 2 anos a partir da emissao.
- Status atuais: `under_review`, `approved`, `issued`, `expired`, `cancelled`.
- Legados aceitos temporariamente: `active` vira `issued`; `pending` vira `under_review`.
- Validacao publica positiva somente para `issued` ou legado `active` com validade nao vencida.
- Cancelamento exige motivo quando feito pelo fluxo operacional.
- Renovacao volta para `approved`.
- Segunda via exige motivo e auditoria.
- Arquivamento operacional usa status `cancelled`, nao exclusao fisica imediata.
- Exportacao Excel nativa foi removida junto com `xlsx`; manter CSV/PDF.

## Produtividade no Dashboard

- `Ctrl + K` foca a busca.
- `Enter` na busca rola para os resultados.
- Busca e filtros ficam fixos no topo durante a rolagem.
- Ultimos 5 cadastros acessados/editados ficam em card local por navegador.
- Selo "Pronto para imprimir" aparece quando o cadastro esta `approved` e sem pendencias documentais.
- Checklist documental usa `getDocumentIssues`.
- Fila operacional destaca cadastros `under_review` e `approved`.
- Assinatura visual usa token forte com `crypto.getRandomValues()`.
- Erros exibidos ao usuario devem passar por `getSafeErrorMessage`.

## Papeis e Permissoes

- `admin`: aprova, emite/imprime, cancela, renova, segunda via, exporta, arquiva/exclui, limpa banco e usa DevTools.
- `attendant`: cadastra, edita, consulta dashboard, ve laudo/historico, aprova e renova, mas nao imprime.
- `viewer`: perfil de consulta basica; nao acessa dashboard, cadastro nem impressao.

Sempre use `hasPermission(...)` de `src/lib/permissions.ts` para novas acoes sensiveis.

## Seguranca

O app ainda e um MVP frontend com chave publishable/anon no navegador. Isso nao e segredo, mas significa que a seguranca real precisa vir de RLS, Supabase Auth e/ou backend confiavel.

Antes de uso real:

1. Criar usuarios reais no Supabase Auth.
2. Aplicar/adaptar `supabase-auth-rls-prep.sql`.
3. Preencher `app_profiles`.
4. Testar `VITE_AUTH_MODE="supabase"` localmente.
5. Aplicar RLS de producao apenas depois dos testes.
6. Testar cada perfil com dados ficticios.

Riscos conhecidos enquanto `VITE_AUTH_MODE="local"`:

- Credenciais/hash em frontend nao sao protecao real.
- Sessao local pode ser manipulada via DevTools.
- Lockout local pode ser apagado pelo usuario.
- RLS aberta para `anon` nao protege dados reais.

## Padrao de Edicao Recomendado

- Para permissao: comece por `src/lib/permissions.ts`.
- Para status/workflow: comece por `src/lib/registration-status.ts`.
- Para campo novo no cadastro: atualizar tipo `CIPFRegistration`, schema, insert/update Supabase, ficha, exportacao, SQL e carteirinha se for exibido.
- Para dado publico: nunca leia de `registrations` na tela publica; use `public_validations` ou RPC segura.
- Para arquivo/documento: use `loadCipfFileDataUri` e nao duplique a logica de chunks.
- Para acao importante: registrar em `audit_logs` via `logAuditEvent`.
- Para dependencia nova: verificar necessidade real e rodar `npm.cmd audit --omit=dev`.
- Para mudanca visual/fluxo: rodar `npm.cmd run lint`, `npm.cmd run build`, testar local, publicar Firebase Hosting e commitar no GitHub.
