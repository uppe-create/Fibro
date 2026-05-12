-- Supabase Auth preparation for the CIPF app.
-- This file is intentionally safe to read and adapt before production.
-- Do not run restrictive RLS in the live MVP until you have created Auth users,
-- profiles and tested each role with fake data.

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'attendant', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_profiles enable row level security;

drop policy if exists own_profile_read on public.app_profiles;
drop policy if exists admin_profile_read on public.app_profiles;

create policy own_profile_read
on public.app_profiles for select to authenticated
using (id = auth.uid());

create policy admin_profile_read
on public.app_profiles for select to authenticated
using (
  exists (
    select 1
    from public.app_profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.jwt() ->> 'app_role',
    (
      select role
      from public.app_profiles
      where id = auth.uid()
      limit 1
    ),
    'viewer'
  );
$$;

grant execute on function public.current_app_role() to authenticated;

-- Suggested next step:
-- 1. Create users in Supabase Auth.
-- 2. Insert one app_profiles row per user.
-- 3. Set VITE_AUTH_MODE="supabase" locally and test login.
-- 4. Only after that, adapt/apply supabase-hardening-production.sql.
