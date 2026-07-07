-- Reliable delivery for application/interview notification emails.
--
-- Previously (0004/0008), notify_application_submitted() and
-- notify_interview_scheduled() called net.http_post directly from the
-- trigger: fire-and-forget, no retry. A transient failure (edge function
-- cold start, momentary 5xx, RESEND_API_KEY briefly unset) silently dropped
-- the notification forever — there was no record it even happened.
--
-- Now the triggers only enqueue (pgmq — Supabase's Postgres-native queue).
-- A pg_cron job every minute calls process_application_notifications(),
-- which sends the HTTP request and blocks on net.http_collect_response to
-- learn the real outcome within the same call — so it only deletes a
-- message once notify-application-email actually returned 2xx. Anything
-- else stays in the queue and becomes visible again after the visibility
-- timeout for the next run to retry, up to 5 attempts, after which it's
-- archived (not lost — inspectable in pgmq.a_application_notifications)
-- rather than retried forever against a permanently broken deployment.
create extension if not exists pgmq;

select pgmq.create('application_notifications');

create or replace function notify_application_submitted()
returns trigger
language plpgsql
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
set search_path = public, pgmq, pg_temp
as $$
begin
  perform pgmq.send('application_notifications', jsonb_build_object('event', 'interview_scheduled', 'interview_id', new.id));
  return new;
end;
$$;

create or replace function process_application_notifications()
returns void
language plpgsql
security definer
set search_path = public, pgmq, net, vault, pg_temp
as $$
declare
  webhook_url text;
  webhook_secret text;
  msg record;
  request_id bigint;
  result net.http_response_result;
begin
  select decrypted_secret into webhook_url from vault.decrypted_secrets where name = 'notify_webhook_url';
  if webhook_url is null then
    return;
  end if;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';

  for msg in select * from pgmq.read('application_notifications', 60, 10) loop
    request_id := net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(webhook_secret, '')),
      body := msg.message
    );

    -- Blocks (bounded by pg_net's own request timeout) until the response
    -- is in, so success/failure is known before this function returns.
    result := net.http_collect_response(request_id, async := false);

    if result.status = 'SUCCESS' and result.response is not null and (result.response).status_code between 200 and 299 then
      perform pgmq.delete('application_notifications', msg.msg_id);
    elsif msg.read_ct >= 5 then
      perform pgmq.archive('application_notifications', msg.msg_id);
    end if;
    -- else: leave it — becomes visible again after the vt above for retry.
  end loop;
end;
$$;

select cron.schedule('process-application-notifications', '* * * * *', $$select process_application_notifications()$$);
