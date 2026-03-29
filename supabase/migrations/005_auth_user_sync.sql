-- ============================================================================
-- Sync auth.users → public.users on signup
-- ============================================================================

-- Function: create a public.users row when a new auth user signs up.
-- The very first user is auto-promoted to admin.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_count int;
  user_role  text;
begin
  select count(*) into user_count from public.users;
  -- First user gets admin, everyone else gets member
  user_role := case when user_count = 0 then 'admin' else 'member' end;

  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    user_role
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.users.display_name),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: fire after insert on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: allow authenticated users to read their own profile
drop policy if exists users_select on users;
create policy users_select on users for select using (
  auth.uid() = id
  or exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
);

-- RLS: allow users to update their own profile
drop policy if exists users_update_self on users;
create policy users_update_self on users for update using (
  auth.uid() = id
);

-- RLS: allow the trigger function (security definer) to insert
drop policy if exists users_insert_service on users;
create policy users_insert_service on users for insert
  with check (true);

-- Backfill: sync any existing auth.users that don't have a public.users row
insert into public.users (id, email, display_name, role)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1)),
  case when (select count(*) from public.users) = 0 then 'admin' else 'member' end
from auth.users au
where not exists (select 1 from public.users pu where pu.id = au.id)
on conflict (email) do update set
  id = excluded.id,
  updated_at = now();
