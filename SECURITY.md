# Segurança do App

## O que ja foi melhorado

- A validacao publica usa a funcao `validate_cipf(id, assinatura)` quando disponivel, retornando dados apenas se a assinatura digital bater.
- A tela publica exibe somente dados minimos: nome, CPF mascarado, emissao, validade, status e assinatura visual.
- A validacao publica so considera documento valido quando o status e `issued` (ou legado `active`) e a validade nao venceu.
- Novos cadastros entram como `under_review`; somente administrador pode emitir/imprimir/baixar PNG.
- Atendente pode aprovar e renovar, mas nao imprimir. Consulta nao acessa dashboard, cadastro nem impressao.
- O alternador de usuario de teste fica oculto em build de producao.
- `.env.local` fica ignorado pelo Git e `.env.example` nao deve conter senhas reais, hashes reais ou chaves secretas.
- O arquivo `supabase-hardening-production.sql` deixa pronto um modelo de RLS mais restritivo para producao.
- O arquivo `supabase-workflow-status-migration.sql` migra status antigos sem aplicar RLS restritiva.
- A biblioteca `xlsx` foi removida; relatorios administrativos usam CSV compativel com Excel e PDF.
- A exclusao operacional foi trocada por arquivamento seguro usando status `cancelled`, preservando auditoria e recuperabilidade.

## Ponto importante sobre chaves

`VITE_SUPABASE_ANON_KEY` e outras variaveis `VITE_*` ficam publicas no JavaScript final do site. Isso e esperado em apps frontend. O segredo real nao deve ser uma chave no navegador, e sim as regras RLS do Supabase.

Nunca coloque `sb_secret`, service role key, senha do banco ou chaves administrativas em variaveis `VITE_*`.

Firebase e usado somente para Hosting neste projeto. Nao manter regras ou SDK
de Firestore se o banco ativo continuar sendo Supabase.

## Antes de uso real

1. Migrar login local para Supabase Auth, Edge Function ou backend confiavel.
2. Criar usuarios com papeis reais: `admin`, `attendant`, `viewer`.
3. Adicionar o papel em custom claims/JWT ou tabela de perfis protegida.
4. Aplicar `supabase-hardening-production.sql`.
5. Testar cadastro, edicao, impressao, dashboard e validacao publica com cada perfil.

## Fluxo operacional atual

- `under_review`: cadastro recebido, ainda nao valido publicamente.
- `approved`: aprovado por admin/atendente, aguardando emissao por administrador.
- `issued`: emitido por administrador, pode validar publicamente enquanto nao vencido.
- `expired`: vencido por validade.
- `cancelled`: cancelado por administrador com motivo registrado na auditoria.
