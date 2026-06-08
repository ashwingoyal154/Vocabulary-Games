-- Lexicon — per-user saved game progress.
-- Run this once in the Supabase SQL editor (Database -> SQL editor -> New query).
--
-- One row per user holds their entire game state as JSON. Row-level security
-- ensures a signed-in user can only read and write their own row.

create table if not exists public.game_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.game_state enable row level security;

-- Drop-and-recreate policies so this script is safe to re-run.
drop policy if exists "Read own game_state"   on public.game_state;
drop policy if exists "Insert own game_state" on public.game_state;
drop policy if exists "Update own game_state" on public.game_state;

create policy "Read own game_state"
  on public.game_state for select
  using (auth.uid() = user_id);

create policy "Insert own game_state"
  on public.game_state for insert
  with check (auth.uid() = user_id);

create policy "Update own game_state"
  on public.game_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
