-- Lexicon — append-only product-analytics event log.
--
-- Run this once in the Supabase SQL editor (Database -> SQL editor -> New query),
-- in the SAME project as schema.sql. It's independent of game_state — you can run
-- either or both.
--
-- The browser inserts one row per tracked action through the public anon key
-- (see src/lib/analytics.ts). Row-level security lets anyone INSERT but nobody
-- SELECT through the API, so the public key can't read other people's events.
-- You read and aggregate them here in the dashboard SQL editor, which runs as the
-- table owner and bypasses RLS (see supabase/analytics-queries.sql for queries).

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  anon_id     text not null,                                       -- random per-browser id (localStorage)
  user_id     uuid references auth.users (id) on delete set null,  -- set when signed in
  session_id  text not null,                                       -- random per page-load id
  name        text not null check (char_length(name) <= 64),       -- event name, e.g. 'round_finish'
  props       jsonb not null default '{}'::jsonb                    -- event payload
);

-- Query helpers: time-series, per-event-type, and per-visitor lookups.
create index if not exists events_ts_idx      on public.events (ts);
create index if not exists events_name_ts_idx on public.events (name, ts);
create index if not exists events_anon_idx    on public.events (anon_id, ts);

alter table public.events enable row level security;

-- Append-only from the client: INSERT is allowed for both anonymous and signed-in
-- visitors; there is NO select/update/delete policy, so the API can neither read
-- nor change rows. (Drop-first so this script is safe to re-run.)
drop policy if exists "Anyone can insert events" on public.events;
create policy "Anyone can insert events"
  on public.events for insert
  to anon, authenticated
  with check (true);

grant insert on public.events to anon, authenticated;
