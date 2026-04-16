-- Fix HTTP 500 on GET /profiles when "profiles_select_staff" policies exist.
-- Cause: policies that subquery public.profiles re-enter RLS → infinite recursion.
-- Run this once in Supabase SQL Editor (after schema_account_management.sql).

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
