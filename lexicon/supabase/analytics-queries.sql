-- Lexicon analytics — copy/paste these into the Supabase SQL editor
-- (Database -> SQL editor). The editor runs as the table owner and bypasses RLS,
-- so it can read the whole `events` table even though the public anon key cannot.
--
-- Events the app sends (see src/lib/analytics.ts):
--   app_open      — once per page load
--   mode_open     — opened a mode/library      props: { mode }
--   round_start   — a game round began         props: { mode, again? }
--   round_finish  — a game round completed      props: { mode, correct, total, points, bestCombo?, missed?, mistakes? }
--   sign_up       — created an account          props: { needsConfirm }
--   sign_in       — signed in
-- Every row also carries: ts, anon_id (browser), user_id (when signed in), session_id (page load).


-- 1) Activity by day — visitors, signed-in users, page loads, total events.
select date_trunc('day', ts)::date                              as day,
       count(distinct anon_id)                                  as visitors,
       count(distinct user_id) filter (where user_id is not null) as signed_in_users,
       count(*) filter (where name = 'app_open')                as app_opens,
       count(*)                                                 as events
from public.events
group by 1
order by 1 desc
limit 30;


-- 2) Mode popularity + completion funnel.
--    (study/library shows opens only — it has no start/finish.)
select coalesce(props->>'mode', 'unknown')               as mode,
       count(*) filter (where name = 'mode_open')        as opens,
       count(*) filter (where name = 'round_start')      as starts,
       count(*) filter (where name = 'round_finish')     as finishes,
       round(100.0 * count(*) filter (where name = 'round_finish')
                   / nullif(count(*) filter (where name = 'round_start'), 0), 1) as finish_rate_pct
from public.events
where name in ('mode_open', 'round_start', 'round_finish')
group by 1
order by finishes desc nulls last;


-- 3) How well people score, by mode (from round_finish payloads).
select props->>'mode'                                                          as mode,
       count(*)                                                                as rounds,
       round(avg((props->>'correct')::numeric), 2)                            as avg_correct,
       round(avg((props->>'total')::numeric), 2)                              as avg_total,
       round(avg((props->>'points')::numeric), 1)                             as avg_points,
       round(100.0 * avg((props->>'correct')::numeric
                   / nullif((props->>'total')::numeric, 0)), 1)               as avg_pct
from public.events
where name = 'round_finish'
group by 1
order by rounds desc;


-- 4) Overall round completion rate (started vs finished).
select count(*) filter (where name = 'round_start')   as rounds_started,
       count(*) filter (where name = 'round_finish')  as rounds_finished,
       round(100.0 * count(*) filter (where name = 'round_finish')
                   / nullif(count(*) filter (where name = 'round_start'), 0), 1) as finish_rate_pct
from public.events;


-- 5) Retention — visitors who came back on 2+ distinct days.
select count(*) filter (where active_days >= 2) as returning_visitors,
       count(*)                                 as total_visitors,
       round(100.0 * count(*) filter (where active_days >= 2)
                   / nullif(count(*), 0), 1)    as returning_pct
from (
  select anon_id, count(distinct ts::date) as active_days
  from public.events
  group by 1
) v;


-- 6) Account funnel — opens vs sign-ups vs sign-ins, and guest/account split.
select count(*) filter (where name = 'app_open')                          as app_opens,
       count(*) filter (where name = 'sign_up')                           as sign_ups,
       count(*) filter (where name = 'sign_in')                           as sign_ins,
       count(distinct anon_id)                                            as unique_browsers,
       count(distinct user_id) filter (where user_id is not null)         as unique_accounts
from public.events;


-- 7) Raw recent events — handy for sanity-checking that tracking works.
select ts, name, props, anon_id, user_id, session_id
from public.events
order by ts desc
limit 100;
