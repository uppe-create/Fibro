-- Private Storage for CIPF sensitive documents.
-- Apply after Supabase Auth/app_profiles are ready. Do not expose service-role keys in frontend env.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cipf-documents',
  'cipf-documents',
  false,
  5242880,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.cipf_storage_files (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null,
  kind text not null check (kind in ('document', 'proof_of_residence', 'medical_report', 'photo')),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  original_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cipf_storage_files_registration_id
  on public.cipf_storage_files(registration_id);

alter table public.cipf_storage_files enable row level security;

drop policy if exists authenticated_read_storage_files on public.cipf_storage_files;
drop policy if exists attendant_insert_storage_files on public.cipf_storage_files;
drop policy if exists admin_delete_storage_files on public.cipf_storage_files;

create policy authenticated_read_storage_files
on public.cipf_storage_files for select to authenticated
using (public.current_app_role() in ('admin', 'attendant'));

create policy attendant_insert_storage_files
on public.cipf_storage_files for insert to authenticated
with check (public.current_app_role() in ('admin', 'attendant'));

create policy admin_delete_storage_files
on public.cipf_storage_files for delete to authenticated
using (public.current_app_role() = 'admin');

drop policy if exists cipf_documents_authenticated_read on storage.objects;
drop policy if exists cipf_documents_attendant_upload on storage.objects;
drop policy if exists cipf_documents_admin_delete on storage.objects;

create policy cipf_documents_authenticated_read
on storage.objects for select to authenticated
using (
  bucket_id = 'cipf-documents'
  and public.current_app_role() in ('admin', 'attendant')
);

create policy cipf_documents_attendant_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'cipf-documents'
  and public.current_app_role() in ('admin', 'attendant')
);

create policy cipf_documents_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'cipf-documents'
  and public.current_app_role() = 'admin'
);

revoke all on public.cipf_storage_files from anon;
