-- TLOB AMS (Supabase) secure schema: Auth + Profiles + per-user KV + RLS
-- Run this in Supabase SQL Editor.

-- 1) Profiles table (ties roles/names to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text,
  avatar_url text,
  role text not null default 'Usher',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward-compatible upgrades (safe to re-run)
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 2) Per-user KV store (secure; each user only sees their own keys)
drop table if exists public.app_kv;

create table public.app_kv (
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

drop trigger if exists trg_app_kv_updated_at on public.app_kv;
create trigger trg_app_kv_updated_at
before update on public.app_kv
for each row
execute function public.set_updated_at();

alter table public.app_kv enable row level security;

drop policy if exists "app_kv_select_own" on public.app_kv;
create policy "app_kv_select_own"
on public.app_kv for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "app_kv_insert_own" on public.app_kv;
create policy "app_kv_insert_own"
on public.app_kv for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "app_kv_update_own" on public.app_kv;
create policy "app_kv_update_own"
on public.app_kv for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

