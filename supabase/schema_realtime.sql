-- Enable live kiosk/dashboard updates when visitors self-register.
-- Run once in Supabase → SQL Editor.

alter table public.attendance replica identity full;
alter table public.visitors replica identity full;
alter table public.members replica identity full;
alter table public.events replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.attendance;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.visitors;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
end $$;
-- Enable live kiosk/dashboard updates when visitors self-register.
-- Run once in Supabase → SQL Editor.

alter table public.attendance replica identity full;
alter table public.visitors replica identity full;
alter table public.members replica identity full;
alter table public.events replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.attendance;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.visitors;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
end $$;
-- Enable live kiosk/dashboard updates when visitors self-register.
-- Run once in Supabase → SQL Editor.

alter table public.attendance replica identity full;
alter table public.visitors replica identity full;
alter table public.members replica identity full;
alter table public.events replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.attendance;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.visitors;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
end $$;
