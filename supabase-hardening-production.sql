-- Production hardening for Supabase.
-- Apply this only after moving administrative writes to Supabase Auth,
-- an Edge Function, or another trusted backend. The current static MVP uses
-- the anon key for dashboard/cadastro writes, so applying this now would block
-- cadastro, edicao, upload and export flows.

create or replace function public.validate_cipf(p_id uuid, p_sig text)
returns table (
  id uuid,
  "fullName" text,
  "cpfMasked" text,
  "issueDate" text,
  "expiryDate" text,
  status text,
  "visualSignature" text,
  checksum text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pv.id,
    pv."fullName",
    pv."cpfMasked",
    pv."issueDate",
    pv."expiryDate",
    pv.status,
    pv."visualSignature",
    pv.checksum
  from public.public_validations pv
  where pv.id = p_id
    and upper(trim(pv."visualSignature")) = upper(trim(p_sig))
  limit 1;
$$;

revoke all on function public.validate_cipf(uuid, text) from public;
grant execute on function public.validate_cipf(uuid, text) to anon, authenticated;

drop policy if exists all_registrations on registrations;
drop policy if exists all_registration_index on registration_index;
drop policy if exists read_public_validations on public_validations;
drop policy if exists all_cipf_files on cipf_files;
drop policy if exists all_cipf_file_chunks on cipf_file_chunks;
drop policy if exists all_audit_logs on audit_logs;

revoke all on registrations from anon;
revoke all on registration_index from anon;
revoke all on public_validations from anon;
revoke all on cipf_files from anon;
revoke all on cipf_file_chunks from anon;
revoke all on audit_logs from anon;

-- Public users can only call validate_cipf(id, signature).
-- They cannot directly list validation rows or read CPF/document fields.

-- Suggested authenticated policies after replacing local static login with
-- Supabase Auth custom claims:
-- app_role=admin: full access.
-- app_role=attendant: create/update/read, no delete/clear.
-- app_role=viewer: read public card data only via application screens.

create policy authenticated_read_registrations
on registrations for select to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_write_registrations
on registrations for insert to authenticated
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_update_registrations
on registrations for update to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'))
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy admin_delete_registrations
on registrations for delete to authenticated
using ((auth.jwt() ->> 'app_role') = 'admin');

create policy authenticated_read_registration_index
on registration_index for select to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_write_registration_index
on registration_index for insert to authenticated
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_update_registration_index
on registration_index for update to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'))
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy admin_delete_registration_index
on registration_index for delete to authenticated
using ((auth.jwt() ->> 'app_role') = 'admin');

create policy authenticated_read_public_validations
on public_validations for select to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_write_public_validations
on public_validations for insert to authenticated
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_update_public_validations
on public_validations for update to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'))
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy admin_delete_public_validations
on public_validations for delete to authenticated
using ((auth.jwt() ->> 'app_role') = 'admin');

create policy authenticated_read_files
on cipf_files for select to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_write_files
on cipf_files for insert to authenticated
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy admin_delete_files
on cipf_files for delete to authenticated
using ((auth.jwt() ->> 'app_role') = 'admin');

create policy authenticated_read_file_chunks
on cipf_file_chunks for select to authenticated
using ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy attendant_write_file_chunks
on cipf_file_chunks for insert to authenticated
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));

create policy admin_delete_file_chunks
on cipf_file_chunks for delete to authenticated
using ((auth.jwt() ->> 'app_role') = 'admin');

create policy authenticated_read_audit_logs
on audit_logs for select to authenticated
using ((auth.jwt() ->> 'app_role') = 'admin');

create policy authenticated_insert_audit_logs
on audit_logs for insert to authenticated
with check ((auth.jwt() ->> 'app_role') in ('admin', 'attendant'));
