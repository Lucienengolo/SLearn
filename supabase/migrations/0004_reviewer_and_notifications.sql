-- Reviewer role for approving/rejecting instructor applications, plus
-- DB-triggered transactional email notifications (README §6 DO-4).
--
-- Decisions (approve/reject) always go through the instructor-approval edge
-- function, which uses the service role key — never through a client-side
-- update. That's why there is deliberately no UPDATE policy here letting a
-- reviewer move an application's status directly: only the privileged
-- function (and its own audit trail / email side-effects) can do that.
alter table profiles add column if not exists is_reviewer boolean not null default false;

-- Extend the profiles escalation guard from 0001 to also protect
-- is_reviewer — a client should no more be able to self-grant reviewer
-- status than they can self-grant the instructor role.
create or replace function profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  if new.role <> old.role or new.verified <> old.verified or new.is_reviewer <> old.is_reviewer then
    if auth.role() <> 'service_role' then
      new.role = old.role;
      new.verified = old.verified;
      new.is_reviewer = old.is_reviewer;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create policy "reviewers view all applications"
  on instructor_applications for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true));

create policy "reviewers view all credentials"
  on instructor_credentials for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true));

create policy "reviewers view all interviews"
  on interviews for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true));

-- Outbound notifications ---------------------------------------------------
-- pg_net is a Supabase-provided extension for fire-and-forget HTTP calls
-- from Postgres. It ships on every Supabase project; a bare/local Postgres
-- won't have it, so this line is only expected to succeed there.
create extension if not exists pg_net;

-- One-time setup after deploying the notify-application-email function
-- (Supabase SQL editor, run once per project):
--   alter database postgres set app.settings.notify_webhook_url =
--     'https://<project-ref>.functions.supabase.co/notify-application-email';
--   alter database postgres set app.settings.notify_webhook_secret =
--     '<random secret — also set as NOTIFY_WEBHOOK_SECRET on the function>';
-- Until both are set, these triggers no-op (webhook_url reads as null).
--
-- 'approved'/'rejected' emails are sent directly by the instructor-approval
-- function instead of from here, so a decision doesn't fire two emails.
create or replace function notify_application_submitted()
returns trigger language plpgsql as $$
declare
  webhook_url text := current_setting('app.settings.notify_webhook_url', true);
  webhook_secret text := current_setting('app.settings.notify_webhook_secret', true);
begin
  if new.status = 'submitted' and old.status is distinct from new.status and webhook_url is not null then
    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(webhook_secret, '')),
      body := jsonb_build_object('event', 'application_submitted', 'application_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger instructor_applications_notify_submitted
  after update on instructor_applications
  for each row execute function notify_application_submitted();

create or replace function notify_interview_scheduled()
returns trigger language plpgsql as $$
declare
  webhook_url text := current_setting('app.settings.notify_webhook_url', true);
  webhook_secret text := current_setting('app.settings.notify_webhook_secret', true);
begin
  if webhook_url is not null then
    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(webhook_secret, '')),
      body := jsonb_build_object('event', 'interview_scheduled', 'interview_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger interviews_notify_scheduled
  after insert on interviews
  for each row execute function notify_interview_scheduled();
