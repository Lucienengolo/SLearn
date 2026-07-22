-- Tutor marketplace MVP (see ~/.gstack CEO plan: 2026-07-20-tutor-marketplace-mvp.md).
-- Parents (plain role='student' profiles, per Eng Review E1 -- no new role,
-- profiles.role stays the single-role student/instructor CHECK from
-- 0003_single_role_enforcement.sql) request a tutor for their child; the
-- matching engine (edge function, separate task) auto-assigns a verified
-- instructor. Reuses V2's instructor_applications/profiles.verified as the
-- only trust gate -- no new verification system.

-- Tutor-specific profile fields ---------------------------------------------
-- One row per instructor who opts into tutoring. Kept separate from
-- `profiles` (not every instructor tutors) and from `instructor_applications`
-- (that table is the verification pipeline record, not the live public
-- profile fields shown on a tutor listing card).
create table tutor_profile_fields (
  tutor_id uuid primary key references profiles(id) on delete cascade,
  teaching_mode text not null check (teaching_mode in ('online', 'in_person', 'both')),
  neighborhood text not null,
  languages text[] not null default '{}',
  rate_per_session numeric not null check (rate_per_session > 0),
  response_time_minutes integer,
  -- Needed for the "Continue on WhatsApp" chat handoff (CEO plan item 4) --
  -- tutor_requests.whatsapp_contact only ever captured the PARENT's number;
  -- without this column there was nothing for a parent to hand off TO.
  whatsapp_contact text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function tutor_profile_fields_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tutor_profile_fields_set_updated_at
  before update on tutor_profile_fields
  for each row execute function tutor_profile_fields_set_updated_at();

-- Only a verified instructor can have tutor fields at all -- checked here
-- (defense in depth) in addition to whatever the frontend gate does, same
-- reasoning as profiles_set_updated_at's role/verified lockdown in
-- 0001_core_schema.sql.
create or replace function check_tutor_is_verified_instructor()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from profiles p
    where p.id = new.tutor_id and p.role = 'instructor' and p.verified = true
  ) then
    raise exception 'tutor_profile_fields.tutor_id must be a verified instructor';
  end if;
  return new;
end;
$$;

create trigger tutor_profile_fields_require_verified
  before insert or update on tutor_profile_fields
  for each row execute function check_tutor_is_verified_instructor();

-- Subjects a tutor teaches, many-to-many against the existing `categories`
-- taxonomy. Denormalized `neighborhood` copy lets the matching query filter
-- on (category_id, neighborhood) with one composite index instead of a join
-- through tutor_profile_fields -- worth it now because it's a single trigger
-- to keep in sync (see below), not because tutor volume needs it yet at
-- MVP scale (a plain join would be equally fast for dozens of tutors).
create table tutor_subjects (
  tutor_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  neighborhood text not null,
  primary key (tutor_id, category_id)
);

create index tutor_subjects_matching_idx on tutor_subjects(category_id, neighborhood);

create or replace function sync_tutor_subjects_neighborhood()
returns trigger language plpgsql as $$
begin
  update tutor_subjects set neighborhood = new.neighborhood where tutor_id = new.tutor_id;
  return new;
end;
$$;

create trigger tutor_profile_fields_sync_neighborhood
  after update of neighborhood on tutor_profile_fields
  for each row execute function sync_tutor_subjects_neighborhood();

-- Parent tutor requests ------------------------------------------------------
create table tutor_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id),
  grade text not null,
  neighborhood text not null,
  budget_min numeric,
  budget_max numeric,
  whatsapp_contact text not null,
  child_identifier text,
  -- Implicit signal for the matching engine's language score (Eng Review
  -- E6) -- there is no separate "preferred language" field on the request
  -- form itself (would be scope creep on a form the CEO/Design reviews
  -- already locked); this is captured from the parent's current bilingual
  -- UI toggle state (D10: locale-detect, French fallback) at submit time.
  preferred_language text not null default 'fr' check (preferred_language in ('fr', 'en')),
  status text not null default 'searching' check (status in ('searching', 'matched', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Backs the idempotency check (parent_id + category_id + grade within a 60s
-- window, per CEO plan item 2) -- see create_tutor_request() below, which is
-- the only intended write path for parents.
create index tutor_requests_idempotency_idx on tutor_requests(parent_id, category_id, grade, created_at);
create index tutor_requests_parent_idx on tutor_requests(parent_id, created_at desc);

create or replace function check_parent_is_student()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from profiles p where p.id = new.parent_id and p.role = 'student'
  ) then
    raise exception 'tutor_requests.parent_id must be a student-role profile';
  end if;
  return new;
end;
$$;

create trigger tutor_requests_require_student_parent
  before insert on tutor_requests
  for each row execute function check_parent_is_student();

-- Atomic, idempotent request creation: if a matching request (same parent,
-- subject, grade) was created in the prior 60 seconds, return it instead of
-- inserting a duplicate. Doing this inside a single security-definer
-- function makes the check-then-insert atomic -- a client-side check then
-- insert would race under a double-click the same way the matching engine's
-- assignment race does (Post-Spec-Review item 22).
create or replace function create_tutor_request(
  p_category_id uuid,
  p_grade text,
  p_neighborhood text,
  p_budget_min numeric,
  p_budget_max numeric,
  p_whatsapp_contact text,
  p_child_identifier text,
  p_preferred_language text default 'fr'
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
    whatsapp_contact, child_identifier, preferred_language
  ) values (
    auth.uid(), p_category_id, p_grade, p_neighborhood, p_budget_min, p_budget_max,
    p_whatsapp_contact, p_child_identifier, p_preferred_language
  ) returning * into v_new;

  return v_new;
end;
$$;

grant execute on function create_tutor_request to authenticated;

-- Matches ---------------------------------------------------------------
-- One row per match attempt. A single tutor_request can accumulate several
-- matches over its life if earlier ones time out or get declined (Row 14,
-- Row 16) -- request_id is intentionally NOT unique.
create table matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references tutor_requests(id) on delete cascade,
  tutor_id uuid not null references profiles(id),
  -- 'matched' is the initial status -- a row only ever exists once the
  -- matching engine has already assigned a tutor (see the CEO plan's match
  -- state machine: "pending" there describes tutor_requests.status =
  -- 'searching', BEFORE any matches row exists, not a per-match state).
  status text not null default 'matched' check (status in (
    'matched', 'messaging', 'deposit_paid', 'in_progress',
    'completed', 'cancelled_refunded', 'dispute_review', 'stalled',
    'expired', 'declined'
  )),
  matched_at timestamptz not null default now(),
  tutor_responded_at timestamptz,
  tutor_timeout_at timestamptz,
  decline_reason text,
  messaging_started_at timestamptz,
  parent_timeout_at timestamptz,
  confirmed_session_date timestamptz,
  deposit_paid_at timestamptz,
  in_progress_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  stalled_at timestamptz,
  created_at timestamptz not null default now()
);

create index matches_request_idx on matches(request_id);
create index matches_tutor_idx on matches(tutor_id);

-- Prevents the exact race Post-Spec-Review item 22 flagged: two concurrent
-- requests both scoring the same single available tutor. A tutor can have
-- at most one ACTIVE (non-terminal) match at a time; the matching engine's
-- INSERT into this table is what the DB-level lock actually is -- this
-- unique index makes a second concurrent insert for the same tutor fail
-- instead of silently double-booking them.
create unique index matches_one_active_per_tutor_idx on matches(tutor_id)
  where status in ('matched', 'messaging', 'deposit_paid', 'in_progress');

create or replace function check_match_tutor_is_verified()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from profiles p
    where p.id = new.tutor_id and p.role = 'instructor' and p.verified = true
  ) then
    raise exception 'matches.tutor_id must be a verified instructor';
  end if;
  return new;
end;
$$;

create trigger matches_require_verified_tutor
  before insert on matches
  for each row execute function check_match_tutor_is_verified();

-- Messages ---------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Eng Review E3.
create index messages_match_created_idx on messages(match_id, created_at);

-- Tutor session payments --------------------------------------------------
-- Dedicated table (Row 8), not an extension of the existing `payments`
-- table, so the V1 course-payment path is untouched. Same Stripe
-- webhook-only-write pattern as 0009_payments.sql for the deposit; the
-- balance is manual (instructor confirms cash/mobile-money received
-- in-person), which is why balance_status has no Stripe fields at all.
create table tutor_session_payments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id) on delete cascade,
  deposit_amount numeric not null check (deposit_amount > 0),
  deposit_status text not null default 'pending' check (deposit_status in ('pending', 'paid', 'failed')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  balance_amount numeric not null check (balance_amount > 0),
  balance_status text not null default 'pending' check (balance_status in ('pending', 'confirmed')),
  balance_confirmed_at timestamptz,
  balance_confirmed_by uuid references profiles(id),
  cancellation_status text not null default 'none' check (cancellation_status in ('none', 'cancelled_refunded', 'dispute_review')),
  cancelled_at timestamptz,
  refund_status text check (refund_status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function tutor_session_payments_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tutor_session_payments_set_updated_at
  before update on tutor_session_payments
  for each row execute function tutor_session_payments_set_updated_at();

-- RLS -------------------------------------------------------------------
-- Eng Review Row 12 + Post-Spec-Review item 23: extended to all three new
-- sensitive tables, not just tutor_requests. Parent sees only their own;
-- tutor sees only rows tied to matches they're part of, never the full
-- pending pool; staff/service-role sees all (writes to matches/payments are
-- service-role-only, same "no client insert/update policy" pattern as
-- payments in 0009_payments.sql).

alter table tutor_profile_fields enable row level security;
alter table tutor_subjects enable row level security;
alter table tutor_requests enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table tutor_session_payments enable row level security;

-- Helper functions to break an RLS cross-reference cycle between
-- tutor_requests and matches: a policy on tutor_requests querying matches,
-- whose own policy queries back into tutor_requests, produces "infinite
-- recursion detected in policy for relation matches" under a real
-- authenticated role (confirmed directly against Postgres while building
-- the chat feature -- earlier testing only ever ran as the postgres
-- superuser, which bypasses RLS entirely and never hit this). SECURITY
-- DEFINER functions run with the function owner's privileges, so their
-- internal queries don't re-enter RLS policy evaluation at all -- the
-- standard fix for this class of bug, not a workaround.
create or replace function is_tutor_requests_owner(p_request_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from tutor_requests r where r.id = p_request_id and r.parent_id = auth.uid());
$$;

create or replace function tutor_has_match_on_request(p_request_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from matches m where m.request_id = p_request_id and m.tutor_id = auth.uid());
$$;

create or replace function is_match_participant(p_match_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from matches m
    join tutor_requests r on r.id = m.request_id
    where m.id = p_match_id and (m.tutor_id = auth.uid() or r.parent_id = auth.uid())
  );
$$;

grant execute on function is_tutor_requests_owner to authenticated;
grant execute on function tutor_has_match_on_request to authenticated;
grant execute on function is_match_participant to authenticated;

create policy "tutor profile fields are publicly readable"
  on tutor_profile_fields for select
  using (true);

create policy "tutors manage their own profile fields"
  on tutor_profile_fields for all
  using (tutor_id = (select auth.uid()))
  with check (tutor_id = (select auth.uid()));

create policy "tutor subjects are publicly readable"
  on tutor_subjects for select
  using (true);

create policy "tutors manage their own subjects"
  on tutor_subjects for all
  using (tutor_id = (select auth.uid()))
  with check (tutor_id = (select auth.uid()));

create policy "parents view their own requests"
  on tutor_requests for select
  using (parent_id = (select auth.uid()));

-- Tutors need to see the request tied to a match they're part of (subject/
-- grade/neighborhood/child_identifier shown in chat), but never the broader
-- pending pool of other parents' requests.
create policy "tutors view requests tied to their own matches"
  on tutor_requests for select
  using (tutor_has_match_on_request(tutor_requests.id));

-- No direct client INSERT policy -- create_tutor_request() above is
-- security definer and is the only intended write path (enforces the
-- idempotency check atomically). No UPDATE/DELETE policy for parents either;
-- status transitions (searching -> matched -> cancelled) are service-role
-- only, driven by the matching engine and cron jobs.

create policy "parents view matches tied to their own requests"
  on matches for select
  using (is_tutor_requests_owner(matches.request_id));

create policy "tutors view their own matches"
  on matches for select
  using (tutor_id = (select auth.uid()));

-- Tutors CAN update their own match rows, but only for the two actions this
-- MVP gives them directly: responding (tutor_responded_at) and declining
-- (status -> 'declined' + decline_reason). Every other transition (timeouts,
-- deposit/session-date/completion state) is service-role only.
create policy "tutors respond to or decline their own new match"
  on matches for update
  using (tutor_id = (select auth.uid()) and status = 'matched')
  with check (
    tutor_id = (select auth.uid())
    and status in ('messaging', 'declined')
  );

-- CEO plan item 5b: the session date is a structured field set via an
-- explicit chat-UI action, not free text -- either match participant can
-- set it once messaging has started, but only while status stays
-- 'messaging' (status itself can't be changed by this policy; that's the
-- tutor-only policy above and the payment flow, not this one).
create policy "match participants confirm the session date"
  on matches for update
  using (
    status = 'messaging'
    and (tutor_id = (select auth.uid()) or is_tutor_requests_owner(matches.request_id))
  )
  with check (status = 'messaging');

create policy "match participants view messages"
  on messages for select
  using (is_match_participant(messages.match_id));

create policy "match participants send messages"
  on messages for insert
  with check (
    sender_id = (select auth.uid())
    and is_match_participant(messages.match_id)
    and exists (
      select 1 from matches m
      where m.id = messages.match_id
        and m.status in ('matched', 'messaging', 'deposit_paid', 'in_progress')
    )
  );

create policy "match participants view their own session payments"
  on tutor_session_payments for select
  using (is_match_participant(tutor_session_payments.match_id));

-- No client insert/update policy -- same pattern as payments in
-- 0009_payments.sql. Deposit rows are written by the Stripe webhook
-- (service role); balance confirmation is written by a service-role RPC the
-- tutor calls (so the "instructor confirms balance received" action can
-- still be idempotent server-side, matching the plan's Error & Rescue
-- Registry row for double-confirmation), not a raw client UPDATE.

grant usage on schema public to anon, authenticated, service_role;
grant select on tutor_session_payments to authenticated, service_role;
grant insert, update on tutor_session_payments to service_role;
