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

rollback;
