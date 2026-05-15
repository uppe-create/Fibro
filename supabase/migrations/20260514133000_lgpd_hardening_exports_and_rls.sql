-- LGPD hardening:
-- 1) disable full JSON backup authorization flow
-- 2) keep registration_index delete admin-only
-- 3) reduce direct reads of public_validations

create or replace function public.admin_request_export(
  p_export_kind text,
  p_filters_json jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_kind text := lower(trim(coalesce(p_export_kind, 'dashboard_csv')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_role <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  if v_kind not in ('dashboard_csv', 'dashboard_pdf', 'monthly_pdf', 'card_vendor_pdf') then
    raise exception 'FORBIDDEN';
  end if;

  perform public.log_audit_event(
    p_action => case
      when v_kind = 'dashboard_pdf' then 'Exportacao PDF autorizada'
      when v_kind = 'monthly_pdf' then 'Relatorio mensal autorizado'
      when v_kind = 'card_vendor_pdf' then 'PDF tecnico da grafica autorizado'
      else 'Exportacao CSV autorizada'
    end,
    p_registration_id => null,
    p_reason => null,
    p_event_code => case
      when v_kind = 'dashboard_pdf' then 'export.dashboard_pdf'
      when v_kind = 'monthly_pdf' then 'export.monthly_pdf'
      when v_kind = 'card_vendor_pdf' then 'export.card_vendor_pdf'
      else 'export.dashboard_csv'
    end,
    p_category => 'export',
    p_severity => 'sensitive',
    p_target_type => 'system',
    p_target_label => 'painel administrativo',
    p_summary => case
      when v_kind = 'dashboard_pdf' then 'Exportacao PDF autorizada'
      when v_kind = 'monthly_pdf' then 'Relatorio mensal autorizado'
      when v_kind = 'card_vendor_pdf' then 'PDF tecnico da grafica autorizado'
      else 'Exportacao CSV autorizada'
    end,
    p_details => case
      when v_kind = 'dashboard_pdf' then 'Dashboard PDF solicitado'
      when v_kind = 'monthly_pdf' then 'Relatorio mensal solicitado'
      when v_kind = 'card_vendor_pdf' then 'PDF tecnico de confeccao solicitado'
      else 'Dashboard CSV solicitado'
    end,
    p_metadata_json => jsonb_build_object('exportKind', v_kind, 'filters', coalesce(p_filters_json, '{}'::jsonb))
  );
end;
$$;

revoke all on function public.admin_request_export(text, jsonb) from public;
grant execute on function public.admin_request_export(text, jsonb) to authenticated;

drop policy if exists admin_delete_registration_index on public.registration_index;
drop policy if exists attendant_delete_registration_index on public.registration_index;
drop policy if exists registration_index_delete_admin_only on public.registration_index;

create policy registration_index_delete_admin_only
on public.registration_index for delete to authenticated
using (public.current_app_role() = 'admin');

drop policy if exists authenticated_read_public_validations on public.public_validations;
drop policy if exists admin_read_public_validations_only on public.public_validations;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_validations'
      and column_name = 'deleted_at'
  ) then
    execute $policy$
      create policy admin_read_public_validations_only
      on public.public_validations for select to authenticated
      using (public.current_app_role() = 'admin' and deleted_at is null)
    $policy$;
  else
    execute $policy$
      create policy admin_read_public_validations_only
      on public.public_validations for select to authenticated
      using (public.current_app_role() = 'admin')
    $policy$;
  end if;
end;
$$;
