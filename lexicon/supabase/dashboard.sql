-- Lexicon — read side for the in-app analytics dashboard.
--
-- Run this once in the Supabase SQL editor, AFTER events.sql. It adds a few
-- aggregate functions the dashboard calls (src/modes/Dashboard.tsx). They run as
-- SECURITY DEFINER so they can read the RLS-locked `events` table, but each one
-- first checks that the caller is the analytics admin — so even though any
-- signed-in user *could* call them, only you get data back.
--
-- >>> CHANGE THIS EMAIL to the account you'll sign in with on the dashboard. <<<
-- (It must be an account that exists in Authentication -> Users — create it from
--  the app's "Sign in -> Create account" once, then sign in with it at /#admin.)

create or replace function public.is_analytics_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'email') = 'ashwingoyal154@gmail.com', false);
$$;

-- Headline counters for the selected window.
create or replace function public.analytics_overview(p_days int default 30)
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
    'days',            p_days,
    'events',          count(*),
    'visitors',        count(distinct anon_id),
    'signed_in_users', count(distinct user_id) filter (where user_id is not null),
    'app_opens',       count(*) filter (where name = 'app_open'),
    'rounds_started',  count(*) filter (where name = 'round_start'),
    'rounds_finished', count(*) filter (where name = 'round_finish'),
    'sign_ups',        count(*) filter (where name = 'sign_up'),
    'sign_ins',        count(*) filter (where name = 'sign_in')
  )
  into result
  from public.events
  where ts >= now() - make_interval(days => p_days);
  return result;
end;
$$;

-- One row per day: visitors, total events, rounds finished.
create or replace function public.analytics_daily(p_days int default 30)
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
  select coalesce(json_agg(t order by t.day), '[]'::json)
  into result
  from (
    select to_char(date_trunc('day', ts), 'YYYY-MM-DD')   as day,
           count(distinct anon_id)                         as visitors,
           count(*)                                        as events,
           count(*) filter (where name = 'round_finish')   as finishes
    from public.events
    where ts >= now() - make_interval(days => p_days)
    group by 1
  ) t;
  return result;
end;
$$;

-- One row per mode: opens, starts, finishes, completion %, avg points.
create or replace function public.analytics_by_mode(p_days int default 30)
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
  select coalesce(json_agg(t order by t.finishes desc nulls last), '[]'::json)
  into result
  from (
    select coalesce(props->>'mode', 'unknown')                  as mode,
           count(*) filter (where name = 'mode_open')           as opens,
           count(*) filter (where name = 'round_start')         as starts,
           count(*) filter (where name = 'round_finish')        as finishes,
           round(avg((props->>'points')::numeric)
                 filter (where name = 'round_finish'), 1)        as avg_points,
           round(100.0 * avg((props->>'correct')::numeric
                 / nullif((props->>'total')::numeric, 0))
                 filter (where name = 'round_finish'), 1)        as avg_pct
    from public.events
    where name in ('mode_open', 'round_start', 'round_finish')
      and ts >= now() - make_interval(days => p_days)
    group by 1
  ) t;
  return result;
end;
$$;

-- Newest events, for a live "what's happening now" feed.
create or replace function public.analytics_recent(p_limit int default 40)
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
    select ts, name, props, anon_id, user_id
    from public.events
    order by ts desc
    limit least(p_limit, 200)
  ) t;
  return result;
end;
$$;

grant execute on function public.is_analytics_admin()        to anon, authenticated;
grant execute on function public.analytics_overview(int)     to authenticated;
grant execute on function public.analytics_daily(int)        to authenticated;
grant execute on function public.analytics_by_mode(int)      to authenticated;
grant execute on function public.analytics_recent(int)       to authenticated;
