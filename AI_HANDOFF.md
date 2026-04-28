# AI Handoff - Carteirinha de Fibromialgia

Este arquivo existe para acelerar outra IA ou outro dev que precise mexer no projeto.
Ele nao deve conter senhas, chaves secretas ou dados reais de pacientes.

## Ideia do produto

O app emite, consulta, imprime e valida publicamente a CIPF, Carteira de Identificacao da Pessoa com Fibromialgia, para uso municipal.

Fluxo principal:

1. Usuario interno faz login local.
2. Atendente/admin cadastra a pessoa e anexa documentos.
3. Novo cadastro entra como `under_review` (Em analise), sem validacao publica positiva.
4. Admin ou atendente aprova (`approved`).
5. Somente admin emite/imprime/baixa PNG; nesse momento o status vira `issued`.
6. Qualquer pessoa com QR Code acessa a validacao publica e ve apenas dados minimos.

## Arquivos principais

- `src/App.tsx`: shell do app, rotas por abas, protecao por permissao e timeout de sessao.
- `src/store/useAppStore.ts`: estado global, login local, sessao, busca de registros e operacoes globais.
- `src/lib/permissions.ts`: matriz unica de papeis e permissoes. Edite aqui antes de espalhar regras no app.
- `src/lib/registration-status.ts`: helpers centrais de status, labels, validade publica e workflow.
- `src/modules/Cadastro.tsx`: formulario completo, regras de negocio, upload de arquivos e gravacao do cadastro.
- `src/modules/Dashboard.tsx`: filtros, KPIs, exportacoes, edicao, exclusao, historico e pre-visualizacao.
- `src/modules/Carteirinha.tsx`: busca de uma pessoa e download da carteirinha como PNG.
- `src/components/CarteirinhaPreview.tsx`: layout visual imprimivel da carteirinha frente/verso.
- `src/modules/Valida.tsx`: pagina publica do QR Code; deve retornar apenas dados minimos.
- `src/lib/cipf-files.ts`: recupera documentos salvos em chunks Base64 no Supabase.
- `supabase-schema.sql`: schema MVP atual.
- `supabase-hardening-production.sql`: RLS mais restritiva para futuro uso real.
- `supabase-workflow-status-migration.sql`: migracao segura de status antigos para o fluxo profissional.
- `SECURITY.md`: resumo dos cuidados de seguranca.

## Regras de negocio importantes

- CPF e unico para carteirinha ativa via `registration_index`.
- CID padrao esperado e `M79.7`; CID diferente exige justificativa medica.
- Comprovante de residencia nao pode ter mais de 90 dias.
- Laudo medico nao pode ter mais de 6 meses.
- Menor de 18 anos exige responsavel legal.
- CNS/Cartao SUS e opcional, mas se informado deve ter 15 digitos.
- Validade padrao da carteirinha: 2 anos a partir da emissao.
- Status atuais: `under_review`, `approved`, `issued`, `expired`, `cancelled`.
- Legados aceitos temporariamente: `active` e tratado como `issued`; `pending` e tratado como `under_review`.
- Validacao publica positiva somente para `issued` (e legado `active`) com validade nao vencida.
- Cancelamento exige motivo; renovacao volta para `approved`; segunda via exige motivo e auditoria.
- Arquivamento operacional usa status `cancelled` em vez de exclusao fisica, para reduzir risco de perda acidental.
- Exportacao Excel nativa foi removida junto com `xlsx`; manter CSV/PDF ou escolher biblioteca mais segura.

## Papeis e permissoes

- `admin`: aprova, emite/imprime, cancela, renova, segunda via, exporta, exclui, limpa banco e usa DevTools.
- `attendant`: cadastra, edita, consulta dashboard, ve laudo/historico, aprova e renova, mas nao imprime.
- `viewer`: perfil de consulta basica; nao acessa dashboard, cadastro nem impressao.

Sempre use `hasPermission(...)` de `src/lib/permissions.ts` para novas acoes sensiveis.

## Banco de dados

O banco ativo do app e Supabase. Firebase fica apenas como Firebase Hosting
para publicar o site estatico gerado em `dist/`; nao ha Firestore no fluxo
principal atual.

Tabelas principais:

- `registrations`: cadastro completo e dados sensiveis.
- `registration_index`: indice por CPF para evitar duplicidade.
- `public_validations`: dados minimos para consulta publica.
- `cipf_files` e `cipf_file_chunks`: arquivos anexos em Base64 chunked.
- `audit_logs`: trilha de auditoria.

A funcao `validate_cipf(id, sig)` e o caminho preferido para validacao publica. Ela so retorna dados se a assinatura visual bater.

## Seguranca

O app ainda e um MVP frontend com chave publishable/anon no navegador. Isso nao e segredo, mas significa que a seguranca real precisa vir de RLS e/ou backend confiavel.

Antes de uso real:

1. Migrar login local para Supabase Auth, Edge Function ou backend.
2. Aplicar RLS de producao.
3. Nao colocar `sb_secret`, service role, senha do banco ou senha e-SUS em `VITE_*`.
4. Testar cada perfil com dados ficticios.

## Padrao de edicao recomendado

- Para regra de permissao: comece por `src/lib/permissions.ts`.
- Para regra de status/workflow: comece por `src/lib/registration-status.ts`.
- Para campo novo no cadastro: atualizar tipo `CIPFRegistration`, schema do formulario, insert/update Supabase, carteirinha se for exibido, exportacao se fizer sentido e SQL.
- Para dado publico: nunca leia de `registrations` na tela publica; use `public_validations` ou RPC segura.
- Para arquivo/documento: preferir `loadCipfFileDataUri` e nao duplicar a logica de chunks.
- Para qualquer acao importante: registrar em `audit_logs` via `logAuditEvent`.
