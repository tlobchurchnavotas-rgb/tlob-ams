-- TLOB AMS: Account management (Admin + Pastor can list/update all profiles; trigger creates profile + email on signup)
-- Run in Supabase SQL Editor after schema_auth_rls.sql

-- 1) Optional: store email on profile for staff UI (synced from auth.users)
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- 2) Auto-create profile when a new auth user is created (so roles can be assigned before first login)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, username, avatar_url, role, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'User'
    ),
    null,
    null,
    coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'Usher'),
    new.email
  );
  return new;
exception
  when unique_violation then
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3–4) RLS: Admin + Pastor may read/update all profiles (use SECURITY DEFINER helper
--     so policies do not subquery profiles directly — that causes infinite RLS recursion and HTTP 500)
create or replace function public.is_admin_or_pastor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('Admin', 'Pastor')
  );
$$;

grant execute on function public.is_admin_or_pastor() to authenticated;

drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff"
on public.profiles for select
to authenticated
using (public.is_admin_or_pastor());

drop policy if exists "profiles_update_staff" on public.profiles;
create policy "profiles_update_staff"
on public.profiles for update
to authenticated
using (public.is_admin_or_pastor())
with check (public.is_admin_or_pastor());
