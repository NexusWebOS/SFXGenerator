-- NightCode Net: accounts, "who's online" and the message board for
-- nightcode.coletechsystems.com and ColeForge.exe's NightCode Net program.
--
-- Run it in a Supabase project of its own (SQL Editor > New query > paste > Run).
-- It is safe to run twice.
--
-- Do not run it in the Nexus II project. Nexus II approves every new auth
-- user as a Nexus viewer, so NightCode sign-ups made
-- there would be able to read Nexus data. The check below stops the script
-- if it finds Nexus tables.

do $$
begin
  if to_regclass('public.nexus_bootstrap_admins') is not null
     or to_regclass('public.profiles') is not null and exists (
          select 1 from pg_trigger where tgname = 'on_auth_user_created_nexus_profile') then
    raise exception 'This looks like the Nexus II project. NightCode Net needs its own Supabase project: every account made here would also become a Nexus viewer.';
  end if;
end $$;

-- ------------------------------------------------------------------ profiles
create table if not exists public.nc_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text,
  bio          text not null default '' check (char_length(bio) <= 280),
  role         text not null default 'user' check (role in ('user', 'sysop')),
  created_at   timestamptz not null default now(),
  last_seen    timestamptz,
  constraint nc_username_format check (username ~ '^[A-Za-z0-9_]{3,16}$')
);
create unique index if not exists nc_profiles_username_key on public.nc_profiles (lower(username));

-- A profile is made with the auth user. The username comes from the sign-up
-- metadata ({ "username": "..." }).
create or replace function public.nc_handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uname text := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
begin
  if uname is null then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if uname !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception using errcode = '22023', message = 'Usernames are 3-16 letters, numbers or underscores.';
  end if;
  if exists (select 1 from public.nc_profiles where lower(username) = lower(uname)) then
    raise exception using errcode = '23505', message = 'That username is taken.';
  end if;
  insert into public.nc_profiles (id, username, display_name)
  values (new.id, uname, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), uname))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists nc_on_auth_user_created on auth.users;
create trigger nc_on_auth_user_created
  after insert on auth.users for each row execute function public.nc_handle_new_user();

alter table public.nc_profiles enable row level security;
drop policy if exists "nc profiles are visible to members" on public.nc_profiles;
create policy "nc profiles are visible to members" on public.nc_profiles
  for select to authenticated using (true);
drop policy if exists "nc members edit their own profile" on public.nc_profiles;
create policy "nc members edit their own profile" on public.nc_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Only these columns can be changed from the browser; role and username can't.
revoke all on public.nc_profiles from anon, authenticated;
grant select on public.nc_profiles to authenticated;
grant update (display_name, bio) on public.nc_profiles to authenticated;

-- ------------------------------------------------------------------ board
create table if not exists public.nc_posts (
  id         bigint generated always as identity primary key,
  author     uuid not null default auth.uid() references public.nc_profiles (id) on delete cascade,
  board      text not null default 'main' check (board ~ '^[a-z0-9_]{1,16}$'),
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists nc_posts_board_created on public.nc_posts (board, created_at desc);
alter table public.nc_posts enable row level security;
drop policy if exists "nc posts are visible to members" on public.nc_posts;
create policy "nc posts are visible to members" on public.nc_posts
  for select to authenticated using (true);
drop policy if exists "nc members post as themselves" on public.nc_posts;
create policy "nc members post as themselves" on public.nc_posts
  for insert to authenticated with check (author = auth.uid());
drop policy if exists "nc authors and sysops delete posts" on public.nc_posts;
create policy "nc authors and sysops delete posts" on public.nc_posts
  for delete to authenticated using (
    author = auth.uid() or exists (select 1 from public.nc_profiles p where p.id = auth.uid() and p.role = 'sysop'));
revoke all on public.nc_posts from anon, authenticated;
grant select, insert, delete on public.nc_posts to authenticated;

-- Posts with their author's name, newest first.
create or replace view public.nc_board with (security_invoker = true) as
  select p.id, p.board, p.body, p.created_at, p.author, pr.username
    from public.nc_posts p join public.nc_profiles pr on pr.id = p.author;
grant select on public.nc_board to authenticated;

-- ------------------------------------------------------------------ functions
-- Heartbeat: the terminal calls this every minute while you're signed in.
create or replace function public.nc_touch()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.nc_profiles set last_seen = now() where id = auth.uid();
$$;
revoke all on function public.nc_touch() from public, anon;
grant execute on function public.nc_touch() to authenticated;

-- Who has been on in the last five minutes.
create or replace function public.nc_who()
returns table (username text, role text, last_seen timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select username, role, last_seen from public.nc_profiles
   where last_seen > now() - interval '5 minutes'
   order by last_seen desc limit 100;
$$;
revoke all on function public.nc_who() from public, anon;
grant execute on function public.nc_who() to authenticated;

-- The sign-up screen checks a name before asking for the rest.
create or replace function public.nc_username_available(name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select name ~ '^[A-Za-z0-9_]{3,16}$'
     and not exists (select 1 from public.nc_profiles where lower(username) = lower(name));
$$;
revoke all on function public.nc_username_available(text) from public;
grant execute on function public.nc_username_available(text) to anon, authenticated;

-- Make yourself the sysop after creating your account (SQL Editor):
--   update public.nc_profiles set role = 'sysop' where lower(username) = 'yourname';
