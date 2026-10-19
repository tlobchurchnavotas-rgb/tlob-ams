-- Reset only the signed-in user's AMS data. Profiles and auth accounts are preserved.
-- Run this in the Supabase SQL Editor after schema_real_tables.sql and schema_auth_rls.sql.

drop function if exists public.reset_own_ams_data();

create or replace function public.reset_own_ams_data(p_include_members boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requesting_user uuid := auth.uid();
  removed_count integer;
  removed jsonb := '{}'::jsonb;
begin
  if requesting_user is null then
    raise exception 'Authentication is required to reset AMS data.';
  end if;

  delete from public.attendance where owner_id = requesting_user;
  get diagnostics removed_count = row_count;
  removed := removed || jsonb_build_object('attendance', removed_count);

  delete from public.visitors where owner_id = requesting_user;
  get diagnostics removed_count = row_count;
  removed := removed || jsonb_build_object('visitors', removed_count);

  delete from public.events where owner_id = requesting_user;
  get diagnostics removed_count = row_count;
  removed := removed || jsonb_build_object('events', removed_count);

  if p_include_members then
    delete from public.members where owner_id = requesting_user;
    get diagnostics removed_count = row_count;
    removed := removed || jsonb_build_object('members', removed_count);
  else
    removed := removed || jsonb_build_object('members', 0);
  end if;

  delete from public.app_kv where owner_id = requesting_user;
  get diagnostics removed_count = row_count;
  removed := removed || jsonb_build_object('settings', removed_count);

  if to_regclass('public.member_reengagement_queue') is not null then
    execute 'delete from public.member_reengagement_queue where owner_id = $1' using requesting_user;
    get diagnostics removed_count = row_count;
    removed := removed || jsonb_build_object('reengagement_queue', removed_count);
  end if;

  if to_regclass('public.audit_logs') is not null then
    execute 'delete from public.audit_logs where actor_id = $1' using requesting_user;
    get diagnostics removed_count = row_count;
    removed := removed || jsonb_build_object('audit_logs', removed_count);
  end if;

  return removed;
end;
$$;

revoke all on function public.reset_own_ams_data(boolean) from public, anon;
grant execute on function public.reset_own_ams_data(boolean) to authenticated;