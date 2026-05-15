# Alinhamento de migrations

## Estado

- Banco remoto recebeu SQL manual via Management API em `2026-05-14`.
- Historico remoto ainda nao deve usar `supabase db push` cego sem reconciliar `supabase_migrations`.

## Passos

1. Ler historico remoto:
   - `select * from supabase_migrations.schema_migrations order by version;`
2. Comparar com arquivos locais em `supabase/migrations/`.
3. Marcar divergencias:
   - migrations aplicadas fora da trilha
   - migrations locais ainda nao registradas
   - migrations antigas substituidas por SQL manual resiliente
4. So depois:
   - reparar historico
   - voltar a usar `supabase db push`

## Regra atual

- Aplicar SQL critica por `POST /v1/projects/{ref}/database/query`.
- Registrar no PR/commit qual arquivo foi aplicado.
- Nao assumir que `.temp/linked-project.json` significa historico alinhado.
