-- NightCode Net, part 2: the NightCode desktop on the website.
--   - nc_desktop: each member's desktop (settings, My Documents, NightAmp, ...) saved in the cloud, so
--     it follows them from browser to browser.
--   - Sign in with GitHub: accounts made through GitHub get a username from their GitHub login.
--   - nc_stats(): member / post / online counts for NightOps.
-- Run after 20260925000000_nightcode_net.sql. Safe to run twice.

-- ------------------------------------------------------------------ cloud desktop
create table if not exists public.nc_desktop (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null check (key ~ '^cf\.[A-Za-z0-9_.-]{1,80}$'),
  value      text not null check (octet_length(value) <= 5242880),     -- 5 MB per key
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.nc_desktop enable row level security;
drop policy if exists "nc members read their own desktop" on public.nc_desktop;
create policy "nc members read their own desktop" on public.nc_desktop
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "nc members write their own desktop" on public.nc_desktop;
create policy "nc members write their own desktop" on public.nc_desktop
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "nc members update their own desktop" on public.nc_desktop;
create policy "nc members update their own desktop" on public.nc_desktop
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "nc members delete their own desktop" on public.nc_desktop;
create policy "nc members delete their own desktop" on public.nc_desktop
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.nc_desktop from anon, authenticated;
grant select, insert, update, delete on public.nc_desktop to authenticated;

create or replace function public.nc_desktop_touch()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists nc_desktop_touch on public.nc_desktop;
create trigger nc_desktop_touch before insert or update on public.nc_desktop
  for each row execute function public.nc_desktop_touch();

-- ------------------------------------------------------------------ usernames for GitHub sign-ins
-- Sign-ups from the terminal pick a username and a clash is an error. Accounts made by signing in with
-- GitHub take the GitHub login instead, cleaned up to the username rules, with a number added if taken.
create or replace function public.nc_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  chosen text := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  base   text;
  uname  text;
  n      int := 1;
begin
  if chosen is not null then
    if chosen !~ '^[A-Za-z0-9_]{3,16}$' then
      raise exception using errcode = '22023', message = 'Usernames are 3-16 letters, numbers or underscores.';
    end if;
    if exists (select 1 from public.nc_profiles where lower(username) = lower(chosen)) then
      raise exception using errcode = '23505', message = 'That username is taken.';
    end if;
    uname := chosen;
  else
    base := regexp_replace(coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username',
                                    split_part(coalesce(new.email, ''), '@', 1), ''), '[^A-Za-z0-9_]', '_', 'g');
    base := left(base, 12);
    if char_length(base) < 3 then base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 6); end if;
    uname := base;
    while exists (select 1 from public.nc_profiles where lower(username) = lower(uname)) loop
      n := n + 1;
      uname := left(base, 16 - char_length(n::text)) || n::text;
    end loop;
  end if;
  insert into public.nc_profiles (id, username, display_name)
  values (new.id, uname, coalesce(nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), ''), uname))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------------ stats
create or replace function public.nc_stats()
returns table (members bigint, posts bigint, online bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select (select count(*) from public.nc_profiles),
         (select count(*) from public.nc_posts),
         (select count(*) from public.nc_profiles where last_seen > now() - interval '5 minutes');
$$;
revoke all on function public.nc_stats() from public, anon;
grant execute on function public.nc_stats() to authenticated;
