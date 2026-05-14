-- RLS smoke tests by profile. Run in Supabase SQL Editor after hardening SQL.
-- Expected: admin needs aal2; attendant can read/write operational data; viewer/anon cannot.

begin;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"admin","aal":"aal1"}';
select 'admin_without_mfa_is_viewer' as test, public.current_app_role() = 'viewer' as ok;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"admin","aal":"aal2"}';
select 'admin_with_mfa_is_admin' as test, public.current_app_role() = 'admin' as ok;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"attendant","aal":"aal1"}';
select 'attendant_role' as test, public.current_app_role() = 'attendant' as ok;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated","app_role":"viewer","aal":"aal1"}';
select 'viewer_role' as test, public.current_app_role() = 'viewer' as ok;

set local request.jwt.claims = '{"role":"anon"}';
select 'anon_is_viewer' as test, public.current_app_role() = 'viewer' as ok;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"admin","aal":"aal2"}';
insert into registrations (id, "fullName", cpf, "birthDate", "issueDate", "expiryDate", status)
values ('00000000-0000-4000-8000-0000000000aa', 'TESTE LGPD', '11111111111', '01/01/1990', '01/01/2026', '01/01/2028', 'under_review')
on conflict (id) do nothing;

insert into registration_index (cpf, registration_id, status)
values ('11111111111', '00000000-0000-4000-8000-0000000000aa', 'under_review')
on conflict (cpf) do nothing;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"attendant","aal":"aal1"}';
do $$
begin
  begin
    delete from registration_index where cpf = '11111111111';
    raise exception 'attendant_delete_should_fail';
  exception
    when insufficient_privilege then
      null;
    when others then
      if position('policy' in lower(sqlerrm)) > 0 then
        null;
      else
        raise;
      end if;
  end;
end;
$$;
select 'attendant_cannot_delete_registration_index' as test, exists(select 1 from registration_index where cpf = '11111111111') as ok;

delete from registration_index where cpf = '11111111111';
select 'admin_can_delete_registration_index' as test, not exists(select 1 from registration_index where cpf = '11111111111') as ok;

rollback;
