-- Idempotent migration for operational workflow fields.
-- Execute in Supabase SQL Editor before relying on patient contact/pickup queues.

alter table registrations add column if not exists patient_notified_at timestamptz;
alter table registrations add column if not exists patient_notified_by text;
alter table registrations add column if not exists patient_notification_channel text;
alter table registrations add column if not exists picked_up_at timestamptz;
alter table registrations add column if not exists picked_up_by text;
alter table registrations add column if not exists pickup_note text;
alter table registrations add column if not exists last_accessed_at timestamptz;
alter table registrations add column if not exists last_accessed_by text;

create index if not exists idx_registrations_patient_notified_at on registrations(patient_notified_at);
create index if not exists idx_registrations_picked_up_at on registrations(picked_up_at);
create index if not exists idx_registrations_last_accessed_at on registrations(last_accessed_at);
