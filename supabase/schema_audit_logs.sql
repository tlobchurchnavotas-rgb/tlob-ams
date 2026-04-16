-- TLOB AMS: Audit logs table + staff read policy
-- Run this in Supabase SQL Editor.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid null references public.profiles(id) on delete set null,
  actor_name text null,
  actor_role text null,
  action text not null,
  target text null,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'app'
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff"
on public.audit_logs for select
to authenticated
using (public.is_admin_or_pastor());

drop policy if exists "audit_logs_insert_service" on public.audit_logs;
create policy "audit_logs_insert_service"
on public.audit_logs for insert
to authenticated
with check (public.is_admin_or_pastor());
