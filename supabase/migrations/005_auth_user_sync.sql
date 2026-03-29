-- ============================================================================
-- Sync auth.users → public.users on signup
-- ============================================================================

-- Function: create a public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'member'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: fire after insert on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: sync any existing auth.users that don't have a public.users row
insert into public.users (id, email, display_name, role)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1)),
  'member'
from auth.users au
where not exists (select 1 from public.users pu where pu.id = au.id)
on conflict (email) do update set
  id = excluded.id,
  updated_at = now();
