-- Institutional inquiries (Schools & Universities / Business / Government
-- audience-nav tracks, founder feedback 2026-07-22 item #7). These account
-- types don't exist yet -- profiles.role stays a DB-enforced
-- student/instructor CHECK constraint (0003_single_role_enforcement.sql).
-- Building real multi-tenant account types is a separate, larger initiative
-- (see TODOS.md P2). This table only captures interest/contact requests from
-- the new marketing pages, same shape as a lead-gen contact form.
create table institutional_inquiries (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('school_university', 'business', 'government')),
  organization_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  message text,
  created_at timestamptz not null default now()
);

create index institutional_inquiries_created_idx on institutional_inquiries(created_at desc);

alter table institutional_inquiries enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant insert on institutional_inquiries to anon, authenticated;
grant select on institutional_inquiries to authenticated, service_role;

-- Public submission, no login required -- same trust level as a marketing
-- contact form. Basic non-empty checks only; not a substitute for spam
-- protection if this ever gets abused at volume.
create policy "anyone can submit an institutional inquiry"
  on institutional_inquiries for insert
  to anon, authenticated
  with check (
    length(trim(organization_name)) > 0
    and length(trim(contact_name)) > 0
    and length(trim(contact_email)) > 0
  );

create policy "reviewers view institutional inquiries"
  on institutional_inquiries for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true)
  );
