# Seguranca do App

Este projeto trabalha com dados pessoais e dados potencialmente sensiveis de saude. A versao atual e um MVP operacional com melhorias de seguranca no frontend, mas a seguranca definitiva deve ser concluida com Supabase Auth, RLS e/ou backend confiavel antes de uso amplo com dados reais.

## Estado Atual

- O banco ativo e Supabase.
- Firebase e usado somente para Hosting do site estatico.
- O login padrao ainda e local por variaveis de ambiente, com hash de senha, bloqueio por tentativas e expiracao de sessao.
- `VITE_AUTH_MODE="supabase"` ja existe para testes futuros com Supabase Auth.
- A validacao publica deve usar `validate_cipf(id, assinatura)` quando a RPC estiver aplicada.
- A tela publica nao deve consultar `registrations`; ela deve consultar apenas `public_validations` ou RPC segura.

## Melhorias Ja Aplicadas

- Validacao publica retorna somente dados minimos: nome, CPF mascarado, emissao, validade, status e assinatura visual.
- Validacao publica positiva apenas para status `issued` ou legado `active`, desde que a validade nao esteja vencida.
- Novos cadastros entram como `under_review`, sem liberar documento valido publicamente.
- Atendente pode cadastrar, editar, aprovar e renovar, mas nao imprimir.
- Somente administrador pode emitir, imprimir, baixar PNG, cancelar, limpar banco e usar ferramentas dev.
- Perfil consulta nao acessa dashboard, cadastro nem impressao.
- Alternador de usuario de teste fica oculto em build de producao.
- `.env.local` fica ignorado pelo Git.
- `.env.example` nao deve conter senhas reais, hashes reais ou chaves secretas.
- `xlsx` foi removido; relatorios usam CSV, CSV compativel com Excel e PDF.
- Exclusao operacional virou arquivamento seguro com status `cancelled`.
- Acoes sensiveis registram auditoria quando aplicavel.
- Dashboard tem checklist documental, fila operacional e selo "Pronto para imprimir".
- Upload mostra pre-visualizacao, progresso e aviso para arquivo pesado.
- App usa carregamento sob demanda de telas e bibliotecas pesadas, reduzindo o JavaScript inicial.
- Assinatura visual passou a usar `crypto.getRandomValues()` com token maior.
- Mensagens de erro exibidas ao usuario foram sanitizadas para nao vazar detalhes internos do banco.
- Rascunho com dados sensiveis fica desativado por padrao; so volta se `VITE_ENABLE_SENSITIVE_DRAFTS="true"`.
- DevTools de massa falsa fica desativado por padrao e exige `VITE_ALLOW_DEV_TOOLS="true"` em ambiente nao-producao.
- Firebase Hosting recebeu headers basicos de seguranca: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy.

## Arquivos de Seguranca e Banco

- `supabase-schema.sql`: schema atual do MVP.
- `supabase-workflow-status-migration.sql`: migra status antigos para o fluxo atual.
- `supabase-auth-rls-prep.sql`: prepara tabela de perfis para Supabase Auth.
- `supabase-hardening-production.sql`: modelo de RLS mais restritivo para producao real.

## Ponto Importante Sobre Chaves

`VITE_SUPABASE_ANON_KEY` e qualquer variavel `VITE_*` ficam publicas no JavaScript final do site. Isso e esperado em frontend. O segredo real nao deve estar no navegador.

Nunca coloque estes itens em `VITE_*`, README, SECURITY, AI_HANDOFF ou codigo versionado:

- `sb_secret`.
- service role key.
- senha do banco.
- senha de usuario real.
- dados reais de pacientes.
- tokens administrativos.

## Fluxo Operacional Atual

- `under_review`: cadastro recebido, ainda nao valido publicamente.
- `approved`: aprovado por admin/atendente, aguardando emissao por administrador.
- `issued`: emitido por administrador, pode validar publicamente enquanto nao vencido.
- `expired`: vencido por validade.
- `cancelled`: cancelado/arquivado por administrador com motivo registrado quando aplicavel.

## Antes de Uso Real com Dados Sensiveis

1. Criar usuarios reais no Supabase Auth.
2. Aplicar/adaptar `supabase-auth-rls-prep.sql`.
3. Preencher `app_profiles` com `admin`, `attendant` e `viewer`.
4. Testar localmente com `VITE_AUTH_MODE="supabase"`.
5. Confirmar que cada perfil acessa somente o que deveria.
6. Adaptar e aplicar `supabase-hardening-production.sql`.
7. Remover politicas MVP `to anon using (true)` do banco vivo.
8. Testar cadastro, edicao, aprovacao, emissao, impressao, dashboard, documentos, auditoria e validacao publica com dados ficticios.
9. Remover qualquer credencial local de teste antes de uso oficial.

## Riscos Ainda Nao Resolvidos Sem Backend/Auth

- Login local em frontend nao e seguranca real, mesmo com hash.
- Sessao em `sessionStorage` pode ser manipulada no DevTools enquanto o app usar login local.
- Lockout em `localStorage` e apenas protecao de UX, nao rate limit real.
- IP real nao pode ser auditado com confianca sem Edge Function/backend.
- RLS aberta para `anon` precisa ser substituida por politicas autenticadas antes de dados reais.

## Regras de Ouro para Futuras Alteracoes

- Nunca deixar a tela publica ler `registrations`.
- Nunca liberar impressao para atendente ou consulta.
- Nunca salvar segredos em arquivos versionados.
- Nunca aplicar RLS restritiva no banco vivo sem testar Auth/perfis antes.
- Sempre registrar auditoria para acao sensivel.
- Sempre validar build e permissao antes de publicar.
