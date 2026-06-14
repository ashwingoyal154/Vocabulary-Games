-- Lexicon — user feedback table (bug reports, suggestions, ratings, general notes).
--
-- Run this once in the Supabase SQL editor, in the SAME project as schema.sql /
-- events.sql. It is independent of game_state and events. The read functions at
-- the bottom reuse `public.is_analytics_admin()` from dashboard.sql, so run this
-- AFTER dashboard.sql (or change the admin check below).
--
-- The browser inserts one row per submission through the public anon key
-- (see src/lib/feedback.ts). Row-level security lets anyone INSERT but nobody
-- SELECT through the API, so the public key can't read other people's feedback.
-- You read it via the admin-only functions (in the app's #admin dashboard, or
-- straight from the SQL editor which bypasses RLS as the table owner).

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  anon_id     text not null,                                       -- random per-browser id (localStorage)
  user_id     uuid references auth.users (id) on delete set null,  -- set when signed in
  session_id  text,                                                -- random per page-load id
  kind        text not null check (kind in ('bug','feedback','rating','suggestion')),
  rating      int  check (rating between 1 and 5),                 -- only for kind = 'rating'
  message     text check (char_length(message) <= 4000),
  email       text check (email is null or char_length(email) <= 200),  -- optional reply-to
  props       jsonb not null default '{}'::jsonb,                  -- route, user-agent, etc.
  -- every row must carry SOMETHING: a star rating, or a non-empty message
  constraint feedback_has_content
    check (rating is not null or (message is not null and char_length(btrim(message)) > 0))
);

create index if not exists feedback_ts_idx   on public.feedback (ts);
create index if not exists feedback_kind_idx on public.feedback (kind, ts);

alter table public.feedback enable row level security;

-- Append-only from the client: INSERT only, for anonymous and signed-in visitors.
-- No select/update/delete policy, so the API can neither read nor change rows.
drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (true);

grant insert on public.feedback to anon, authenticated;

-- ------------------------------------------------------------------
-- Read side (admin only) — newest feedback, and a small summary.
-- SECURITY DEFINER so they can read the RLS-locked table, but each first checks
-- that the caller is the analytics admin (is_analytics_admin() from dashboard.sql).
-- ------------------------------------------------------------------

create or replace function public.feedback_recent(p_limit int default 50)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.is_analytics_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select coalesce(json_agg(t order by t.ts desc), '[]'::json)
  into result
  from (
    select id, ts, kind, rating, message, email, user_id, anon_id, props
    from public.feedback
    order by ts desc
    limit least(p_limit, 200)
  ) t;
  return result;
end;
$$;

create or replace function public.feedback_summary(p_days int default 90)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.is_analytics_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select json_build_object(
    'days',         p_days,
    'total',        count(*),
    'bugs',         count(*) filter (where kind = 'bug'),
    'suggestions',  count(*) filter (where kind = 'suggestion'),
    'general',      count(*) filter (where kind = 'feedback'),
    'ratings',      count(*) filter (where kind = 'rating'),
    'avg_rating',   round(avg(rating) filter (where rating is not null), 2),
    'rating_count', count(*) filter (where rating is not null)
  )
  into result
  from public.feedback
  where ts >= now() - make_interval(days => p_days);
  return result;
end;
$$;

grant execute on function public.feedback_recent(int)  to authenticated;
grant execute on function public.feedback_summary(int) to authenticated;
