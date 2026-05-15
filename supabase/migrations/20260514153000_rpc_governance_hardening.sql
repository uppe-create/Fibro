-- RPC hardening for operational writes + governance tables for LGPD tracking.

create table if not exists public.lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  request_type text not null,
  data_subject_name text not null,
  data_subject_cpf text not null,
  channel text not null,
  status text not null default 'open',
  received_at timestamptz not null default now(),
  due_at date,
  response_summary text,
  legal_notes text,
  owner_name text,
  resolved_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  title text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  occurred_at timestamptz,
  discovered_at timestamptz not null default now(),
  summary text not null,
  affected_data text,
  affected_subjects integer not null default 0,
  containment_actions text,
  notification_required boolean not null default false,
  notified_anpd_at timestamptz,
  notified_subjects_at timestamptz,
  owner_name text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lgpd_retention_rules (
  dataset_key text primary key,
  dataset_label text not null,
  retention_summary text not null,
  archive_strategy text not null,
  purge_blocked boolean not null default true,
  legal_basis_notes text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.lgpd_operator_registry (
  operator_key text primary key,
  operator_name text not null,
  category text not null,
  purpose text not null,
  shared_data text not null,
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.lgpd_retention_rules (dataset_key, dataset_label, retention_summary, archive_strategy, purge_blocked, legal_basis_notes)
values
  ('registrations', 'Cadastros completos', 'Arquivamento logico ate definicao juridica formal.', 'Nao excluir automaticamente; manter trilha auditavel.', true, 'Dados de saude e identificacao exigem validacao juridica antes de descarte.'),
  ('public_validations', 'Validacao publica minima', 'Manter somente enquanto carteirinha estiver valida ou arquivada logicamente.', 'Sincronizada pelo workflow seguro.', true, 'Base minima para validacao publica.'),
  ('documents', 'Documentos privados', 'Manter em bucket privado com acesso operacional restrito.', 'Sem purge automatico ate aprovacao formal.', true, 'Documentos de saude exigem retencao validada pelo municipio.'),
  ('audit_logs', 'Auditoria', 'Preservar para rastreabilidade e incidente.', 'Somente arquivamento logico.', true, 'Necessario para responsabilizacao e art. 37 da administracao publica.'),
  ('rate_limits', 'Controle de validacao publica', 'Rotina tecnica operacional.', 'Rever prazo com equipe juridica.', true, 'Telemetria minima de seguranca.')
on conflict (dataset_key) do update
set dataset_label = excluded.dataset_label,
    retention_summary = excluded.retention_summary,
    archive_strategy = excluded.archive_strategy,
    purge_blocked = excluded.purge_blocked,
    legal_basis_notes = excluded.legal_basis_notes,
    updated_at = now();

insert into public.lgpd_operator_registry (operator_key, operator_name, category, purpose, shared_data, active, notes)
values
  ('supabase', 'Supabase', 'Operador', 'Banco, auth, storage e RPC do sistema.', 'Cadastro completo, documentos privados, logs de auth e auditoria.', true, 'Infraestrutura principal do sistema.'),
  ('firebase-hosting', 'Firebase Hosting', 'Operador', 'Publicacao do frontend estatico.', 'Bundle publico da aplicacao; nao deve receber cadastro privado.', true, 'Sem persistencia intencional de dados sensiveis no frontend.'),
  ('viacep', 'ViaCEP', 'Apoio tecnico', 'Consulta de endereco por CEP.', 'CEP informado pelo operador.', true, 'Consulta pontual sem envio de laudo ou cadastro completo.'),
  ('whatsapp-web', 'WhatsApp Web', 'Canal operacional', 'Contato manual com titular.', 'Telefone e mensagem operacional definida pelo operador.', true, 'Uso assistido por humano; exige criterio operacional.'),
  ('browser-client', 'Navegador do operador', 'Ambiente cliente', 'Uso interno autenticado.', 'Dados privados visiveis conforme perfil e sessao.', true, 'Rascunho sensivel permanece desativado por padrao.')
on conflict (operator_key) do update
set operator_name = excluded.operator_name,
    category = excluded.category,
    purpose = excluded.purpose,
    shared_data = excluded.shared_data,
    active = excluded.active,
    notes = excluded.notes,
    updated_at = now();

alter table public.lgpd_requests enable row level security;
alter table public.security_incidents enable row level security;
alter table public.lgpd_retention_rules enable row level security;
alter table public.lgpd_operator_registry enable row level security;

drop policy if exists lgpd_requests_admin_select on public.lgpd_requests;
drop policy if exists security_incidents_admin_select on public.security_incidents;
drop policy if exists lgpd_retention_rules_admin_select on public.lgpd_retention_rules;
drop policy if exists lgpd_operator_registry_admin_select on public.lgpd_operator_registry;

create policy lgpd_requests_admin_select
on public.lgpd_requests for select to authenticated
using (public.current_app_role() = 'admin');

create policy security_incidents_admin_select
on public.security_incidents for select to authenticated
using (public.current_app_role() = 'admin');

create policy lgpd_retention_rules_admin_select
on public.lgpd_retention_rules for select to authenticated
using (public.current_app_role() = 'admin');

create policy lgpd_operator_registry_admin_select
on public.lgpd_operator_registry for select to authenticated
using (public.current_app_role() = 'admin');

create or replace function public.admin_update_registration(
  p_registration_id uuid,
  p_changes_json jsonb,
  p_reason text
)
returns public.registrations
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_registration public.registrations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_role not in ('admin', 'attendant') then
    raise exception 'FORBIDDEN';
  end if;

  if v_reason is null then
    raise exception 'REASON_REQUIRED';
  end if;

  select *
  into v_registration
  from public.registrations
  where id = p_registration_id
    and deleted_at is null
  limit 1;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  update public.registrations
  set "fullName" = coalesce(nullif(trim(coalesce(p_changes_json->>'fullName', '')), ''), "fullName"),
      cns = case when p_changes_json ? 'cns' then nullif(trim(coalesce(p_changes_json->>'cns', '')), '') else cns end,
      phone = case when p_changes_json ? 'phone' then nullif(trim(coalesce(p_changes_json->>'phone', '')), '') else phone end,
      "birthDate" = coalesce(nullif(trim(coalesce(p_changes_json->>'birthDate', '')), ''), "birthDate"),
      "legalGuardian" = case when p_changes_json ? 'legalGuardian' then nullif(trim(coalesce(p_changes_json->>'legalGuardian', '')), '') else "legalGuardian" end,
      cep = case when p_changes_json ? 'cep' then nullif(trim(coalesce(p_changes_json->>'cep', '')), '') else cep end,
      logradouro = case when p_changes_json ? 'logradouro' then nullif(trim(coalesce(p_changes_json->>'logradouro', '')), '') else logradouro end,
      bairro = case when p_changes_json ? 'bairro' then nullif(trim(coalesce(p_changes_json->>'bairro', '')), '') else bairro end,
      cidade = case when p_changes_json ? 'cidade' then nullif(trim(coalesce(p_changes_json->>'cidade', '')), '') else cidade end,
      estado = case when p_changes_json ? 'estado' then nullif(trim(coalesce(p_changes_json->>'estado', '')), '') else estado end,
      cid = case when p_changes_json ? 'cid' then nullif(trim(coalesce(p_changes_json->>'cid', '')), '') else cid end,
      "justificativaCid" = case when p_changes_json ? 'justificativaCid' then nullif(trim(coalesce(p_changes_json->>'justificativaCid', '')), '') else "justificativaCid" end,
      crm = case when p_changes_json ? 'crm' then nullif(trim(coalesce(p_changes_json->>'crm', '')), '') else crm end,
      "proofOfResidenceDate" = case when p_changes_json ? 'proofOfResidenceDate' then nullif(trim(coalesce(p_changes_json->>'proofOfResidenceDate', '')), '') else "proofOfResidenceDate" end,
      "medicalReportDate" = case when p_changes_json ? 'medicalReportDate' then nullif(trim(coalesce(p_changes_json->>'medicalReportDate', '')), '') else "medicalReportDate" end,
      "issueDate" = case when p_changes_json ? 'issueDate' then nullif(trim(coalesce(p_changes_json->>'issueDate', '')), '') else "issueDate" end,
      "expiryDate" = case when p_changes_json ? 'expiryDate' then nullif(trim(coalesce(p_changes_json->>'expiryDate', '')), '') else "expiryDate" end,
      status = case when p_changes_json ? 'status' then nullif(trim(coalesce(p_changes_json->>'status', '')), '') else status end
  where id = p_registration_id
  returning * into v_registration;

  update public.public_validations
  set "fullName" = v_registration."fullName",
      "issueDate" = v_registration."issueDate",
      "expiryDate" = v_registration."expiryDate",
      status = v_registration.status
  where id = p_registration_id;

  update public.registration_index
  set status = v_registration.status,
      updated_at = now()
  where cpf = regexp_replace(coalesce(v_registration.cpf, ''), '\D', '', 'g');

  perform public.log_audit_event(
    p_action => 'Cadastro editado',
    p_registration_id => p_registration_id,
    p_reason => v_reason,
    p_event_code => 'registration.edited',
    p_category => 'workflow',
    p_severity => 'sensitive',
    p_target_type => 'registration',
    p_target_label => v_registration."fullName",
    p_summary => 'Cadastro editado por RPC segura',
    p_details => v_reason,
    p_metadata_json => jsonb_build_object('role', v_role)
  );

  return v_registration;
end;
$$;

create or replace function public.admin_record_patient_contact(
  p_registration_id uuid,
  p_channel text
)
returns public.registrations
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_registration public.registrations%rowtype;
  v_actor_name text := coalesce((select upper(full_name) from public.app_profiles where id = auth.uid()), upper(split_part(coalesce(auth.jwt()->>'email', 'SISTEMA'), '@', 1)), 'SISTEMA');
  v_channel text := coalesce(nullif(trim(coalesce(p_channel, '')), ''), 'Aviso registrado');
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_role not in ('admin', 'attendant') then
    raise exception 'FORBIDDEN';
  end if;

  update public.registrations
  set patient_notified_at = now(),
      patient_notified_by = v_actor_name,
      patient_notification_channel = v_channel
  where id = p_registration_id
    and deleted_at is null
  returning * into v_registration;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  perform public.log_audit_event(
    p_action => 'Paciente avisado',
    p_registration_id => p_registration_id,
    p_event_code => 'patient.notified',
    p_category => 'workflow',
    p_severity => 'info',
    p_target_type => 'registration',
    p_target_label => v_registration."fullName",
    p_summary => 'Contato com titular registrado',
    p_details => v_channel
  );

  return v_registration;
end;
$$;

create or replace function public.admin_record_pickup(
  p_registration_id uuid,
  p_note text
)
returns public.registrations
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text := public.current_app_role();
  v_registration public.registrations%rowtype;
  v_actor_name text := coalesce((select upper(full_name) from public.app_profiles where id = auth.uid()), upper(split_part(coalesce(auth.jwt()->>'email', 'SISTEMA'), '@', 1)), 'SISTEMA');
  v_note text := coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Retirada registrada');
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_role not in ('admin', 'attendant') then
    raise exception 'FORBIDDEN';
  end if;

  update public.registrations
  set picked_up_at = now(),
      picked_up_by = v_actor_name,
      pickup_note = v_note
  where id = p_registration_id
    and deleted_at is null
  returning * into v_registration;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  perform public.log_audit_event(
    p_action => 'Retirada registrada',
    p_registration_id => p_registration_id,
    p_event_code => 'card.picked_up',
    p_category => 'workflow',
    p_severity => 'sensitive',
    p_target_type => 'registration',
    p_target_label => v_registration."fullName",
    p_summary => 'Retirada presencial registrada',
    p_details => v_note
  );

  return v_registration;
end;
$$;

create or replace function public.admin_archive_registrations(
  p_reason text default 'Arquivamento administrativo da base'
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Arquivamento administrativo da base');
  v_archived_at timestamptz := now();
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.current_app_role() <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  update public.registrations
  set status = 'cancelled',
      deleted_at = v_archived_at,
      deleted_by = auth.uid()
  where deleted_at is null;

  get diagnostics v_count = row_count;

  update public.public_validations
  set status = 'cancelled',
      deleted_at = v_archived_at
  where deleted_at is null;

  delete from public.registration_index
  where cpf is not null;

  perform public.log_audit_event(
    p_action => 'Base arquivada',
    p_reason => v_reason,
    p_event_code => 'system.database_archived',
    p_category => 'system',
    p_severity => 'sensitive',
    p_target_type => 'system',
    p_target_label => 'Base administrativa',
    p_summary => 'Arquivamento logico executado',
    p_details => v_reason,
    p_metadata_json => jsonb_build_object('affectedRows', v_count)
  );

  return v_count;
end;
$$;

create or replace function public.admin_create_lgpd_request(
  p_request_type text,
  p_data_subject_name text,
  p_data_subject_cpf text,
  p_channel text,
  p_due_at date default null,
  p_legal_notes text default null,
  p_owner_name text default null
)
returns public.lgpd_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_request public.lgpd_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.current_app_role() <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.lgpd_requests (
    protocol,
    request_type,
    data_subject_name,
    data_subject_cpf,
    channel,
    due_at,
    legal_notes,
    owner_name,
    created_by,
    updated_by
  )
  values (
    'LGPD-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    trim(coalesce(p_request_type, 'acesso')),
    upper(trim(coalesce(p_data_subject_name, 'TITULAR'))),
    regexp_replace(coalesce(p_data_subject_cpf, ''), '\D', '', 'g'),
    trim(coalesce(p_channel, 'presencial')),
    p_due_at,
    nullif(trim(coalesce(p_legal_notes, '')), ''),
    nullif(trim(coalesce(p_owner_name, '')), ''),
    auth.uid(),
    auth.uid()
  )
  returning * into v_request;

  perform public.log_audit_event(
    p_action => 'Pedido LGPD criado',
    p_event_code => 'lgpd.request_created',
    p_category => 'governance',
    p_severity => 'sensitive',
    p_target_type => 'lgpd_request',
    p_target_label => v_request.protocol,
    p_summary => 'Pedido LGPD registrado',
    p_details => v_request.request_type || ' para ' || v_request.data_subject_name
  );

  return v_request;
end;
$$;

create or replace function public.admin_update_lgpd_request(
  p_request_id uuid,
  p_status text,
  p_response_summary text default null,
  p_legal_notes text default null,
  p_owner_name text default null
)
returns public.lgpd_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_request public.lgpd_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.current_app_role() <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  update public.lgpd_requests
  set status = trim(coalesce(p_status, status)),
      response_summary = nullif(trim(coalesce(p_response_summary, '')), ''),
      legal_notes = nullif(trim(coalesce(p_legal_notes, '')), ''),
      owner_name = nullif(trim(coalesce(p_owner_name, '')), ''),
      resolved_at = case when lower(trim(coalesce(p_status, status))) = 'closed' then now() else null end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  perform public.log_audit_event(
    p_action => 'Pedido LGPD atualizado',
    p_event_code => 'lgpd.request_updated',
    p_category => 'governance',
    p_severity => 'sensitive',
    p_target_type => 'lgpd_request',
    p_target_label => v_request.protocol,
    p_summary => 'Pedido LGPD atualizado',
    p_details => v_request.status
  );

  return v_request;
end;
$$;

create or replace function public.admin_create_security_incident(
  p_title text,
  p_severity text,
  p_occurred_at timestamptz default null,
  p_summary text default null,
  p_affected_data text default null,
  p_affected_subjects integer default 0,
  p_containment_actions text default null,
  p_notification_required boolean default false,
  p_owner_name text default null
)
returns public.security_incidents
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_incident public.security_incidents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.current_app_role() <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.security_incidents (
    protocol,
    title,
    severity,
    occurred_at,
    summary,
    affected_data,
    affected_subjects,
    containment_actions,
    notification_required,
    owner_name,
    created_by,
    updated_by
  )
  values (
    'INC-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    trim(coalesce(p_title, 'Incidente sem titulo')),
    lower(trim(coalesce(p_severity, 'medium'))),
    p_occurred_at,
    trim(coalesce(p_summary, 'Registro inicial de incidente.')),
    nullif(trim(coalesce(p_affected_data, '')), ''),
    greatest(coalesce(p_affected_subjects, 0), 0),
    nullif(trim(coalesce(p_containment_actions, '')), ''),
    coalesce(p_notification_required, false),
    nullif(trim(coalesce(p_owner_name, '')), ''),
    auth.uid(),
    auth.uid()
  )
  returning * into v_incident;

  perform public.log_audit_event(
    p_action => 'Incidente de seguranca criado',
    p_event_code => 'security.incident_created',
    p_category => 'governance',
    p_severity => 'critical',
    p_target_type => 'security_incident',
    p_target_label => v_incident.protocol,
    p_summary => 'Incidente registrado',
    p_details => v_incident.title
  );

  return v_incident;
end;
$$;

create or replace function public.admin_update_security_incident(
  p_incident_id uuid,
  p_status text,
  p_summary text,
  p_containment_actions text,
  p_notification_required boolean,
  p_notified_anpd_at timestamptz default null,
  p_notified_subjects_at timestamptz default null,
  p_owner_name text default null
)
returns public.security_incidents
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_incident public.security_incidents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.current_app_role() <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  update public.security_incidents
  set status = lower(trim(coalesce(p_status, status))),
      summary = trim(coalesce(p_summary, summary)),
      containment_actions = nullif(trim(coalesce(p_containment_actions, '')), ''),
      notification_required = coalesce(p_notification_required, notification_required),
      notified_anpd_at = p_notified_anpd_at,
      notified_subjects_at = p_notified_subjects_at,
      owner_name = nullif(trim(coalesce(p_owner_name, '')), ''),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_incident_id
  returning * into v_incident;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  perform public.log_audit_event(
    p_action => 'Incidente de seguranca atualizado',
    p_event_code => 'security.incident_updated',
    p_category => 'governance',
    p_severity => 'critical',
    p_target_type => 'security_incident',
    p_target_label => v_incident.protocol,
    p_summary => 'Incidente atualizado',
    p_details => v_incident.status
  );

  return v_incident;
end;
$$;

revoke all on function public.admin_update_registration(uuid, jsonb, text) from public;
grant execute on function public.admin_update_registration(uuid, jsonb, text) to authenticated;
revoke all on function public.admin_record_patient_contact(uuid, text) from public;
grant execute on function public.admin_record_patient_contact(uuid, text) to authenticated;
revoke all on function public.admin_record_pickup(uuid, text) from public;
grant execute on function public.admin_record_pickup(uuid, text) to authenticated;
revoke all on function public.admin_archive_registrations(text) from public;
grant execute on function public.admin_archive_registrations(text) to authenticated;
revoke all on function public.admin_create_lgpd_request(text, text, text, text, date, text, text) from public;
grant execute on function public.admin_create_lgpd_request(text, text, text, text, date, text, text) to authenticated;
revoke all on function public.admin_update_lgpd_request(uuid, text, text, text, text) from public;
grant execute on function public.admin_update_lgpd_request(uuid, text, text, text, text) to authenticated;
revoke all on function public.admin_create_security_incident(text, text, timestamptz, text, text, integer, text, boolean, text) from public;
grant execute on function public.admin_create_security_incident(text, text, timestamptz, text, text, integer, text, boolean, text) to authenticated;
revoke all on function public.admin_update_security_incident(uuid, text, text, text, boolean, timestamptz, timestamptz, text) from public;
grant execute on function public.admin_update_security_incident(uuid, text, text, text, boolean, timestamptz, timestamptz, text) to authenticated;
