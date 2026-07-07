-- Fixes a real regression introduced by 0011_notification_queue.sql, found
-- by actually exercising the trigger path end-to-end (a synthetic
-- cal-webhook call, service-role INSERT into interviews) rather than only
-- testing process_application_notifications() directly via SQL as postgres.
--
-- notify_application_submitted() and notify_interview_scheduled() call
-- pgmq.send(), but pgmq's functions are NOT security definer (confirmed via
-- pg_proc.prosecdef) and USAGE on schema pgmq is only granted to postgres.
-- Neither function was marked security definer in 0011, so they ran as
-- whichever role's action fired the trigger — authenticated (an applicant
-- submitting) or service_role (an edge function inserting an interview) —
-- and both lack pgmq schema access: "permission denied for schema pgmq".
-- This meant submitting an instructor application was broken from the
-- moment 0011 shipped until this migration.
--
-- Fix: same pattern already used for vault access in 0008 — security
-- definer (runs as postgres, which owns pgmq) plus a pinned search_path,
-- narrowly on just these two trigger functions rather than widening pgmq
-- grants to authenticated/service_role generally.
create or replace function notify_application_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
begin
  if new.status = 'submitted' and old.status is distinct from new.status then
    perform pgmq.send('application_notifications', jsonb_build_object('event', 'application_submitted', 'application_id', new.id));
  end if;
  return new;
end;
$$;

create or replace function notify_interview_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
begin
  perform pgmq.send('application_notifications', jsonb_build_object('event', 'interview_scheduled', 'interview_id', new.id));
  return new;
end;
$$;
