# Carteirinha de Fibromialgia

Aplicacao web para cadastro, analise, aprovacao, emissao, impressao e validacao publica da CIPF municipal.

## Arquitetura Atual

- **Frontend:** React + Vite.
- **Banco de dados:** Supabase.
- **Hospedagem:** Firebase Hosting apenas para publicar o site estatico gerado em `dist/`.
- **Validacao publica:** QR Code aponta para o proprio app e consulta dados minimos em `public_validations` ou pela RPC `validate_cipf`.
- **Autenticacao atual:** login local configurado por `.env.local`, com bloqueio por tentativas e sessao com expiracao.
- **Autenticacao futura:** Supabase Auth ja esta preparado por `VITE_AUTH_MODE="supabase"`, mas nao e o padrao para nao quebrar o MVP atual.
- **Performance:** telas e bibliotecas pesadas, como PDF, QR e geracao de PNG, carregam sob demanda.

## Funcionalidades Principais

- Cadastro guiado com rascunho local automatico.
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
npm.cmd run build
npm.cmd audit --omit=dev
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

## Observacoes de Seguranca

- Nao coloque `sb_secret`, service role key, senha do banco ou chaves administrativas em variaveis `VITE_*`.
- `VITE_SUPABASE_ANON_KEY` e publica por natureza em app frontend; a protecao real deve vir de RLS, Supabase Auth ou backend confiavel.
- O login local e adequado para MVP/testes controlados, mas nao substitui Auth/RLS em uso real com dados sensiveis.
- Para testar Supabase Auth, crie usuarios/perfis no Supabase, aplique/adapte `supabase-auth-rls-prep.sql` e altere `VITE_AUTH_MODE` para `supabase`.
- A exportacao Excel nativa foi removida junto com `xlsx`; use CSV compativel com Excel ou PDF.
- Leia `SECURITY.md` e `AI_HANDOFF.md` antes de alterar regras de permissao, validacao publica, workflow ou banco.
