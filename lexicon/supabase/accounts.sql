-- Lexicon — accounts roster: one row per person who signs up / logs in.
--
-- Run this once in the Supabase SQL editor (Database -> SQL editor -> New query),
-- in the SAME project as schema.sql / events.sql. It is independent of those —
-- you can run any combination.
--
-- WHY: auth.users (Supabase's private auth schema) already holds the raw login
-- identities, but the app had no readable, app-owned table answering "who has an
-- account, and when did they last sign in?". This creates that roster and keeps
-- it filled automatically via triggers — no app code change, and it can't be
-- forged from the browser (writes happen only inside SECURITY DEFINER triggers).

-- ---------------------------------------------------------------------------
-- 1. The roster table: one row per account.
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text,
  created_at    timestamptz not null default now(),  -- when the account was created
  last_login_at timestamptz,                          -- most recent successful sign-in
  login_count   integer     not null default 0,       -- successful sign-ins (new sessions)
  updated_at    timestamptz not null default now()
);

alter table public.accounts enable row level security;

-- A signed-in user may read ONLY their own roster row (used to verify the flow
-- end-to-end, and available for future "your account" UI). There is deliberately
-- NO insert/update/delete policy: the rows are written exclusively by the
-- SECURITY DEFINER triggers below, so the browser/anon key can never forge or
-- tamper with the roster. (Drop-first so this script is safe to re-run.)
drop policy if exists "Read own account" on public.accounts;
create policy "Read own account"
  on public.accounts for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Account creation -> insert a roster row when a new auth user is created.
--    Fires on sign-up even when email confirmation is still pending (the
--    auth.users row exists immediately; only the session is gated).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.accounts (user_id, email, created_at)
  values (new.id, new.email, coalesce(new.created_at, now()))
  on conflict (user_id) do update set email = excluded.email, updated_at = now();
  return new;
exception when others then
  return new;  -- never block sign-up on a roster-write failure
end;
$$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.handle_new_account();

-- ---------------------------------------------------------------------------
-- 3. Login -> bump last_login_at + login_count when a new session is opened.
--    Each successful password sign-in inserts an auth.sessions row; token
--    refreshes UPDATE the existing session and so are not double-counted.
--    Upserts in case the create-trigger above didn't run (e.g. pre-existing user).
-- ---------------------------------------------------------------------------
create or replace function public.handle_account_login()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.accounts (user_id, email, last_login_at, login_count)
  values (
    new.user_id,
    (select u.email from auth.users u where u.id = new.user_id),
    now(),
    1
  )
  on conflict (user_id) do update
    set last_login_at = now(),
        login_count   = public.accounts.login_count + 1,
        updated_at    = now();
  return new;
exception when others then
  return new;  -- never block login on a roster-write failure
end;
$$;

drop trigger if exists on_auth_session_created_account on auth.sessions;
create trigger on_auth_session_created_account
  after insert on auth.sessions
  for each row execute function public.handle_account_login();

-- ---------------------------------------------------------------------------
-- 4. Backfill: capture any users that already existed before this script ran.
-- ---------------------------------------------------------------------------
insert into public.accounts (user_id, email, created_at, last_login_at)
select u.id, u.email, u.created_at, u.last_sign_in_at
from auth.users u
on conflict (user_id) do nothing;
