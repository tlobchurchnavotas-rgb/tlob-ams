-- TLOB AMS (Supabase) real tables + RLS (per signed-in user)
-- Run this AFTER `supabase/schema_auth_rls.sql`.

-- Helper: updated_at trigger (created in schema_auth_rls.sql)
-- If you didn't run it, run schema_auth_rls.sql first.

-- Members
create table if not exists public.members (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  contact text,
  ministry text,
  age_group text,
  status text,
  joined date,
  photo text,
  archived boolean not null default false,
  birthday date,
  anniversary date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at
before update on public.members
for each row
execute function public.set_updated_at();

alter table public.members enable row level security;
drop policy if exists "members_rw_own" on public.members;
create policy "members_rw_own"
on public.members
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Events
create table if not exists public.events (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  type text,
  date date,
  time text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

alter table public.events enable row level security;
drop policy if exists "events_rw_own" on public.events;
create policy "events_rw_own"
on public.events
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Attendance
create table if not exists public.attendance (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  member_id text,
  event_id text,
  timestamp timestamptz,
  member_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
before update on public.attendance
for each row
execute function public.set_updated_at();

alter table public.attendance enable row level security;
drop policy if exists "attendance_rw_own" on public.attendance;
create policy "attendance_rw_own"
on public.attendance
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Visitors
create table if not exists public.visitors (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  contact text,
  event_id text,
  date date,
  invited_by text,
  notes text,
  converted_to_member boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

drop trigger if exists trg_visitors_updated_at on public.visitors;
create trigger trg_visitors_updated_at
before update on public.visitors
for each row
execute function public.set_updated_at();

alter table public.visitors enable row level security;
drop policy if exists "visitors_rw_own" on public.visitors;
create policy "visitors_rw_own"
on public.visitors
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

