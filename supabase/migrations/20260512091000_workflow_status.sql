-- Safe, idempotent migration for the CIPF workflow status model.
-- Run in Supabase SQL Editor before using the professional approval/issue flow.
-- This does not apply restrictive RLS/Auth rules.

update registrations
set status = case
  when status = 'active' then 'issued'
  when status = 'pending' then 'under_review'
  when status in ('under_review', 'approved', 'issued', 'expired', 'cancelled') then status
  else 'under_review'
end;

update public_validations
set status = case
  when status = 'active' then 'issued'
  when status = 'pending' then 'under_review'
  when status in ('under_review', 'approved', 'issued', 'expired', 'cancelled') then status
  else 'under_review'
end;

update registration_index
set
  status = case
    when status = 'active' then 'issued'
    when status = 'pending' then 'under_review'
    when status in ('under_review', 'approved', 'issued', 'expired', 'cancelled') then status
    else 'under_review'
  end,
  updated_at = now();

alter table registrations alter column status set default 'under_review';
alter table registration_index alter column status set default 'under_review';
alter table public_validations alter column status set default 'under_review';

create index if not exists idx_registrations_status on registrations(status);
create index if not exists idx_public_validations_signature on public_validations("visualSignature");
create index if not exists idx_registration_index_status on registration_index(status);
