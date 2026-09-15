-- Spekooh partner integration: S@Learn instructors mark exam papers routed
-- from Spekooh's own instructor-subject queue. Spekooh treats instructor_id
-- as an opaque, partner-owned string (its own "golden rule": it never owns
-- instructor accounts) -- the two apps agreed to reuse the same S@Learn
-- profile id as that opaque value, so instructor_id here is a real FK, not
-- a denormalized copy.
--
-- Rows are written only by the spekooh-webhook edge function (service role,
-- on a real inbound push from Spekooh) or by spekooh-respond (service role,
-- after a verified outbound call to Spekooh succeeds) -- never directly by
-- a client, hence no client-facing insert/update policy below.
create table spekooh_marking_requests (
  id uuid primary key default gen_random_uuid(),
  spekooh_request_id bigint not null unique,
  spekooh_paper_id bigint not null,
  instructor_id uuid not null references profiles(id) on delete cascade,
  subject text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'submitted')),
  sent_at timestamptz not null,
  responds_by timestamptz,
  guide_deadline timestamptz,
  content jsonb,
  day4_reminder_at timestamptz,
  day6_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spekooh_marking_requests_instructor_id_idx on spekooh_marking_requests (instructor_id);

alter table spekooh_marking_requests enable row level security;

-- Instructors can see only their own requests -- everything else (the
-- insert on a new_request push, the update on accept/reject/submit) goes
-- through the two edge functions' service-role client, which independently
-- re-verifies the HMAC signature (spekooh-webhook) or the caller's own JWT
-- against instructor_id (spekooh-respond) before writing.
create policy "Instructors can view their own marking requests"
  on spekooh_marking_requests for select
  using (instructor_id = auth.uid());

create or replace function spekooh_marking_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger spekooh_marking_requests_set_updated_at
  before update on spekooh_marking_requests
  for each row
  execute function spekooh_marking_requests_set_updated_at();
