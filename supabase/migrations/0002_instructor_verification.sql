-- Instructor verification pipeline.
-- Applicants are students until a reviewer approves them; role never flips at signup.
create extension if not exists pgcrypto;

alter table profiles
  add column if not exists verified boolean not null default false;

create type instructor_application_status as enum (
  'draft', 'submitted', 'review', 'interview', 'approved', 'rejected'
);

create type instructor_credential_type as enum (
  'government_id', 'degree', 'certificate', 'cv', 'portfolio', 'sample_lesson', 'other'
);

create type background_check_status as enum (
  'not_started', 'in_progress', 'clear', 'flagged'
);

create type interview_outcome as enum (
  'pending', 'pass', 'fail', 'no_show', 'rescheduled'
);

-- One application per user; the wizard updates this row in place until submission.
create table instructor_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references profiles(id) on delete cascade,
  status instructor_application_status not null default 'draft',
  full_name text,
  headline text,
  bio text,
  qualifications text,
  years_experience integer,
  areas_of_expertise text[],
  proposed_course_title text,
  proposed_course_description text,
  proposed_course_category_id uuid references categories(id),
  background_check_status background_check_status not null default 'not_started',
  submitted_at timestamptz,
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index instructor_applications_status_idx on instructor_applications(status);

create table instructor_credentials (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references instructor_applications(id) on delete cascade,
  credential_type instructor_credential_type not null,
  storage_path text not null,
  file_name text,
  verified boolean not null default false,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index instructor_credentials_application_idx on instructor_credentials(application_id);

-- Interview slots are managed by staff (service role); applicants only read + book.
create table interview_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  panelist_id uuid references profiles(id),
  is_booked boolean not null default false,
  created_at timestamptz not null default now()
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references instructor_applications(id) on delete cascade,
  slot_id uuid references interview_slots(id),
  scheduled_at timestamptz,
  panelist_id uuid references profiles(id),
  outcome interview_outcome not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interviews_application_idx on interviews(application_id);

create or replace function instructor_apps_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger instructor_applications_set_updated_at
  before update on instructor_applications
  for each row execute function instructor_apps_set_updated_at();

create trigger interviews_set_updated_at
  before update on interviews
  for each row execute function instructor_apps_set_updated_at();

-- RLS -------------------------------------------------------------------

alter table instructor_applications enable row level security;
alter table instructor_credentials enable row level security;
alter table interview_slots enable row level security;
alter table interviews enable row level security;

create policy "applicants view their own application"
  on instructor_applications for select
  using (applicant_id = auth.uid());

create policy "applicants create their own draft application"
  on instructor_applications for insert
  with check (applicant_id = auth.uid() and status = 'draft');

-- Applicants may edit only while in draft, and the only transition they can
-- make themselves is draft -> submitted. Everything past that (review,
-- interview, approved/rejected, verified) is staff-only via the service role
-- (see instructor-approval edge function, DO-4).
create policy "applicants edit their draft and submit once"
  on instructor_applications for update
  using (applicant_id = auth.uid() and status = 'draft')
  with check (applicant_id = auth.uid() and status in ('draft', 'submitted'));

create policy "applicants view their own credentials"
  on instructor_credentials for select
  using (
    exists (
      select 1 from instructor_applications a
      where a.id = instructor_credentials.application_id
        and a.applicant_id = auth.uid()
    )
  );

-- Uploads are immutable once written: no update/delete policy for applicants.
-- Reviewers verify credentials out-of-band via the service role.
create policy "applicants upload credentials while draft or submitted"
  on instructor_credentials for insert
  with check (
    exists (
      select 1 from instructor_applications a
      where a.id = instructor_credentials.application_id
        and a.applicant_id = auth.uid()
        and a.status in ('draft', 'submitted')
    )
  );

create policy "authenticated users can view open interview slots"
  on interview_slots for select
  to authenticated
  using (true);

-- Applicants can book an open slot for themselves; they cannot un-book or
-- reassign it. Slot creation/removal stays staff-only (service role).
create policy "applicants can book an open slot"
  on interview_slots for update
  to authenticated
  using (is_booked = false)
  with check (is_booked = true);

create policy "applicants view their own interview"
  on interviews for select
  using (
    exists (
      select 1 from instructor_applications a
      where a.id = interviews.application_id
        and a.applicant_id = auth.uid()
    )
  );

create policy "applicants schedule their own interview once submitted"
  on interviews for insert
  with check (
    exists (
      select 1 from instructor_applications a
      where a.id = interviews.application_id
        and a.applicant_id = auth.uid()
        and a.status = 'submitted'
    )
  );

-- Private storage for ID/credential uploads --------------------------------

insert into storage.buckets (id, name, public)
values ('instructor-credentials', 'instructor-credentials', false)
on conflict (id) do nothing;

create policy "applicants upload to their own credential folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'instructor-credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "applicants view their own credential files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'instructor-credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
