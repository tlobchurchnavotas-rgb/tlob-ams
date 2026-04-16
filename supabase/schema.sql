-- TLOB AMS (Supabase) minimal schema
-- This stores the app's existing persisted state (members, events, attendance, etc.)
-- as JSON, keyed by the same "tlob_*" keys currently used in localStorage.

create table if not exists public.app_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_kv_updated_at on public.app_kv;
create trigger trg_app_kv_updated_at
before update on public.app_kv
for each row
execute function public.set_updated_at();

-- SECURITY NOTE:
-- For a quick setup in a client-only app, this allows reads/writes using the anon key.
-- For real security, switch to Supabase Auth + RLS policies per user/church later.
alter table public.app_kv enable row level security;

drop policy if exists "app_kv_select_all" on public.app_kv;
create policy "app_kv_select_all"
on public.app_kv for select
to anon, authenticated
using (true);

drop policy if exists "app_kv_insert_all" on public.app_kv;
create policy "app_kv_insert_all"
on public.app_kv for insert
to anon, authenticated
with check (true);

drop policy if exists "app_kv_update_all" on public.app_kv;
create policy "app_kv_update_all"
on public.app_kv for update
to anon, authenticated
using (true)
with check (true);

