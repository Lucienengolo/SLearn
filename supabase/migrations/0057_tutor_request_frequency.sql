-- Founder request, 2026-08-06: how many times per week a tutor will teach
-- a given child, visible on both sides throughout the whole matching
-- process. This is a property of the request (the parent's desired
-- frequency), not tutor capacity -- no tutor-capacity concept exists
-- anywhere in this schema or in scoring.ts (which deliberately excludes
-- budget too, per Eng Review E6: neighborhood/language/response-time only),
-- and building one isn't part of this ask. Rides along as informational
-- metadata everywhere the existing grade/neighborhood summary already
-- appears; doesn't affect matching/scoring.
alter table tutor_requests add column if not exists sessions_per_week integer not null default 1 check (sessions_per_week between 1 and 7);

-- Pre-existing bug found while touching this function: 0040 widened
-- create_tutor_request with two new trailing parameters via CREATE OR
-- REPLACE, but Postgres identifies a function by its full parameter type
-- list -- adding parameters doesn't replace the old signature, it
-- overloads it. Confirmed live against production: the original 8-param
-- version from 0030 was still sitting there alongside 0040's 10-param
-- one -- BOTH need dropping, not just the 8-param one (caught the first
-- deploy attempt only dropped one of the two, leaving the 10-param
-- version to accumulate as a THIRD overload alongside this migration's
-- new 11-param one; verified against production directly and fixed
-- before this migration file's history was final). Working "by accident"
-- only because every real caller (lib/tutorRequests.ts) always sends
-- every parameter PostgREST needs to resolve the newest overload -- not
-- a guarantee.
drop function if exists create_tutor_request(uuid, text, text, numeric, numeric, text, text, text);
drop function if exists create_tutor_request(uuid, text, text, numeric, numeric, text, text, text, numeric, numeric);

create or replace function create_tutor_request(
  p_category_id uuid,
  p_grade text,
  p_neighborhood text,
  p_budget_min numeric,
  p_budget_max numeric,
  p_whatsapp_contact text,
  p_child_identifier text,
  p_preferred_language text default 'fr',
  p_location_lat numeric default null,
  p_location_lng numeric default null,
  p_sessions_per_week integer default 1
) returns tutor_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing tutor_requests;
  v_new tutor_requests;
begin
  if p_preferred_language not in ('fr', 'en') then
    raise exception 'p_preferred_language must be fr or en';
  end if;

  if p_sessions_per_week < 1 or p_sessions_per_week > 7 then
    raise exception 'p_sessions_per_week must be between 1 and 7';
  end if;

  select * into v_existing
  from tutor_requests
  where parent_id = auth.uid()
    and category_id = p_category_id
    and grade = p_grade
    and created_at > now() - interval '60 seconds'
  order by created_at desc
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into tutor_requests (
    parent_id, category_id, grade, neighborhood, budget_min, budget_max,
    whatsapp_contact, child_identifier, preferred_language, location_lat, location_lng,
    sessions_per_week
  ) values (
    auth.uid(), p_category_id, p_grade, p_neighborhood, p_budget_min, p_budget_max,
    p_whatsapp_contact, p_child_identifier, p_preferred_language, p_location_lat, p_location_lng,
    p_sessions_per_week
  ) returning * into v_new;

  return v_new;
end;
$$;

-- Both already join tutor_requests -- adding sessions_per_week to their
-- return shape is additive, not a new join. CREATE OR REPLACE can't widen
-- a RETURNS TABLE(...) signature in place (confirmed live against
-- ci_test: "cannot change return type of existing function" / "Row type
-- defined by OUT parameters is different"), so both need an explicit
-- drop first.
drop function if exists get_pending_match_settlements();
drop function if exists get_all_matches_admin();

create or replace function get_pending_match_settlements()
returns table(
  match_id uuid,
  confirmed_session_date timestamptz,
  parent_name text,
  parent_whatsapp text,
  tutor_name text,
  tutor_whatsapp text,
  rate_per_session numeric,
  sessions_per_week integer
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true) then
    return;
  end if;

  return query
    select m.id, m.confirmed_session_date,
           pp.full_name, r.whatsapp_contact,
           tp.full_name, tf.whatsapp_contact,
           tf.rate_per_session,
           r.sessions_per_week
    from matches m
    join tutor_requests r on r.id = m.request_id
    join profiles pp on pp.id = r.parent_id
    join profiles tp on tp.id = m.tutor_id
    join tutor_profile_fields tf on tf.tutor_id = m.tutor_id
    where m.status = 'messaging'
      and m.confirmed_session_date is not null
    order by m.confirmed_session_date asc;
end;
$$;

create or replace function get_all_matches_admin()
returns table(
  match_id uuid,
  status text,
  confirmed_session_date timestamptz,
  parent_name text,
  tutor_name text,
  created_at timestamptz,
  sessions_per_week integer
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    return;
  end if;

  return query
    select m.id, m.status, m.confirmed_session_date, pp.full_name, tp.full_name, m.created_at, r.sessions_per_week
    from matches m
    join tutor_requests r on r.id = m.request_id
    join profiles pp on pp.id = r.parent_id
    join profiles tp on tp.id = m.tutor_id
    order by m.created_at desc;
end;
$$;
