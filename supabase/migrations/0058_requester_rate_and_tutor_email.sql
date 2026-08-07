-- Founder request, 2026-08-06/07: rate should be negotiated from what the
-- parent requests, not tutor-quoted -- tutors no longer set a rate anywhere
-- (TutorProfileForm.tsx, ApplicationWizard.tsx), so the column must accept
-- null for every tutor going forward. The existing `> 0` check already
-- evaluates to UNKNOWN (not FALSE) for null, so it doesn't need touching.
alter table tutor_profile_fields alter column rate_per_session drop not null;

-- Companion to budget_min/budget_max: a bare number range doesn't say
-- per-what. Nullable -- only meaningful once a parent actually enters a
-- budget, same optionality as budget_min/budget_max themselves.
alter table tutor_requests add column if not exists budget_period text check (budget_period in ('weekly', 'monthly'));

-- The WhatsApp handoff message (PaymentStatus.tsx) now needs the tutor's
-- email alongside their name/phone. public_profiles deliberately excludes
-- email (0046_restrict_profile_email.sql) -- a narrow RPC, gated by the
-- pre-existing is_match_participant() helper (0030_tutor_marketplace.sql,
-- already used for messages/tutor_session_payments RLS), is the consistent
-- way to expose it to just the two people on that match.
create or replace function get_match_tutor_email(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_email text;
begin
  if not is_match_participant(p_match_id) then
    raise exception 'not a participant in this match';
  end if;

  select p.email into v_email
  from matches m
  join profiles p on p.id = m.tutor_id
  where m.id = p_match_id;

  return v_email;
end;
$$;

grant execute on function get_match_tutor_email to authenticated;

-- Same "tarif = requester's, not the tutor's" shift applied to the admin
-- oversight surfaces, not just the WhatsApp message. CREATE OR REPLACE
-- can't widen a RETURNS TABLE(...) signature in place (hit this in 0057
-- too) -- drop first.
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
  budget_min numeric,
  budget_max numeric,
  budget_period text,
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
           r.budget_min, r.budget_max, r.budget_period,
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
  sessions_per_week integer,
  budget_min numeric,
  budget_max numeric,
  budget_period text
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
    select m.id, m.status, m.confirmed_session_date, pp.full_name, tp.full_name, m.created_at, r.sessions_per_week,
           r.budget_min, r.budget_max, r.budget_period
    from matches m
    join tutor_requests r on r.id = m.request_id
    join profiles pp on pp.id = r.parent_id
    join profiles tp on tp.id = m.tutor_id
    order by m.created_at desc;
end;
$$;

-- Pre-existing bug found while touching this function (same class of issue
-- as 0057's create_tutor_request fix): 0057 added p_sessions_per_week as
-- an 11th parameter via CREATE OR REPLACE, which overloads rather than
-- replaces. p_budget_period below is a 12th parameter on the same function,
-- so the 11-param overload from 0057 needs dropping too, or it will sit
-- alongside this one as dead weight (working "by accident" only because
-- lib/tutorRequests.ts always sends every parameter).
drop function if exists create_tutor_request(uuid, text, text, numeric, numeric, text, text, text, numeric, numeric, integer);

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
  p_sessions_per_week integer default 1,
  p_budget_period text default null
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

  if p_budget_period is not null and p_budget_period not in ('weekly', 'monthly') then
    raise exception 'p_budget_period must be weekly or monthly';
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
    sessions_per_week, budget_period
  ) values (
    auth.uid(), p_category_id, p_grade, p_neighborhood, p_budget_min, p_budget_max,
    p_whatsapp_contact, p_child_identifier, p_preferred_language, p_location_lat, p_location_lng,
    p_sessions_per_week, p_budget_period
  ) returning * into v_new;

  return v_new;
end;
$$;
