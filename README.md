# Carteirinha de Fibromialgia

Aplicacao web para cadastro, aprovacao, emissao, impressao e validacao publica da CIPF municipal.

## Arquitetura atual

- **Frontend:** React + Vite.
- **Banco de dados:** Supabase.
- **Hospedagem:** Firebase Hosting apenas para publicar o site estatico em `dist/`.
- **Validacao publica:** QR Code aponta para o proprio app e consulta dados minimos em `public_validations`/`validate_cipf`.
- **Performance:** telas e bibliotecas pesadas carregam sob demanda para reduzir o JavaScript inicial.

## Rodar localmente

1. Instale as dependencias:
   ```powershell
   npm install
   ```

2. Crie ou ajuste `.env.local` usando `.env.example` como modelo. O minimo para o app web e:
   ```env
   VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
   VITE_SUPABASE_ANON_KEY="SUA_CHAVE_PUBLICAVEL"
   VITE_APP_URL="http://localhost:5173"
   ```

3. Inicie o app:
   ```powershell
   npm.cmd run dev
   ```

4. Abra:
   ```text
   http://127.0.0.1:5173
   ```

## Publicar no Firebase Hosting

1. Gere o build:
   ```powershell
   npm.cmd run build
   ```

2. Publique somente o Hosting:
   ```powershell
   npx.cmd firebase-tools deploy --only hosting
   ```

## Observacoes de seguranca

- Nao coloque `sb_secret`, service role key, senha do banco ou chaves administrativas em variaveis `VITE_*`.
- `VITE_SUPABASE_ANON_KEY` e publica por natureza em app frontend; a protecao real deve vir de RLS/Supabase Auth ou backend confiavel.
- O login local segue como padrao do MVP. Para testar Auth real, crie usuarios/perfis no Supabase e altere `VITE_AUTH_MODE` para `supabase`.
- A exportacao Excel nativa foi removida para evitar dependencia vulneravel; use CSV compativel com Excel ou PDF.
- Leia `SECURITY.md` e `AI_HANDOFF.md` antes de alterar regras de permissao, validacao publica ou workflow da carteirinha.
