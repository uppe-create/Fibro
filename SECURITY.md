# Seguranca do App

Este projeto trabalha com dados pessoais e dados potencialmente sensiveis de saude. A versao atual ja recebeu cortes importantes de hardening: Supabase Auth obrigatorio em producao, RLS restritiva, Storage privado, RPC publica rate-limited, auditoria por RPC e CSP sem `unsafe-inline`.

## Estado Atual

- O banco ativo e Supabase.
- Firebase e usado somente para Hosting do site estatico.
- Login local fica somente para desenvolvimento/teste. Build de producao falha se `VITE_AUTH_MODE` nao for `supabase`.
- Supabase Auth esta em uso no projeto real.
- Admin exige MFA (`aal2`) no banco. Sem MFA, `current_app_role()` retorna `viewer`.
- Validacao publica usa `validate_cipf_public(text, text)` com rate limit.
- A tela publica nao consulta `registrations` nem `public_validations` diretamente.
- Documentos novos usam Storage privado `cipf-documents` e URL assinada curta.
- Auditoria usa RPC `log_audit_event`; frontend nao insere direto em `audit_logs`.
- MFA TOTP para admin ja existe no app: enroll, verify e challenge.
- Em `auth_mode=supabase`, aprovar, emitir, cancelar, renovar, arquivar e autorizar exportacao passam por RPC segura.

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
- CSP foi endurecida sem `unsafe-inline`.
- CSV exportado protege contra CSV Injection.
- Uploads validam tamanho, MIME, extensao e magic bytes.

## Arquivos de Seguranca e Banco

- `supabase/migrations/`: fonte canonica das migracoes versionadas.
- `supabase/tests/rls_profile_smoke.sql`: smoke tests por perfil e MFA.
- SQLs na raiz seguem apenas por compatibilidade/manual.

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

1. Confirmar senha/perfil do atendente e testar acesso real.
2. Testar cadastro completo com Supabase Auth e Storage privado.
3. Criar usuario `viewer`, se o fluxo operacional exigir consulta interna.
4. Rodar `supabase/tests/rls_profile_smoke.sql` apos cada alteracao de RLS.
5. Remover qualquer credencial local de teste antes de uso oficial.

## Riscos Ainda Nao Resolvidos

- IP auditado por RPC depende dos headers repassados pelo Supabase.
- Em modo local, MVP ainda usa fallback frontend para nao quebrar testes controlados.
- Exportacao ainda gera arquivo no navegador; Edge Function continua opcao futura para arquivo assinado/backend-only.
- Login local deve continuar proibido em producao.

## Regras de Ouro para Futuras Alteracoes

- Nunca deixar a tela publica ler `registrations`.
- Nunca liberar impressao para atendente ou consulta.
- Nunca salvar segredos em arquivos versionados.
- Nunca aplicar RLS restritiva no banco vivo sem rodar smoke tests por perfil.
- Sempre registrar auditoria via RPC para acao sensivel.
- Sempre validar build e permissao antes de publicar.
