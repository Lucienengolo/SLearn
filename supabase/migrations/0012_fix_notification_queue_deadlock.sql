-- Fixes a real deadlock in 0011_notification_queue.sql, found by actually
-- invoking process_application_notifications() against the live project
-- rather than only reading the code: net.http_collect_response(request_id,
-- async := false) never returned. Root cause — net.http_post() and the
-- collect call it fed both ran inside the *same* plpgsql function call,
-- i.e. the same transaction. The queued request row it inserts into
-- net.http_request_queue isn't visible to pg_net's background worker until
-- that transaction commits, so the worker never picks it up, and the
-- blocking collect polled forever for a response that could never arrive.
-- (Confirmed directly: the backend sat in a PgSleep wait for over a minute
-- with zero rows ever appearing in net._http_response, and had to be
-- pg_terminate_backend'd. The new cron job was unscheduled immediately
-- after to stop it recurring every minute during the fix.)
--
-- Fix: split dispatch and outcome-checking across separate invocations
-- (separate transactions), so by the time we check for a response, the
-- request that generated it was committed at least one cron run ago and
-- pg_net's worker has long since processed it — a plain SELECT against
-- net._http_response, not a blocking wait.
create table if not exists notification_dispatch (
  msg_id bigint primary key,
  request_id bigint not null,
  dispatched_at timestamptz not null default now()
);

-- Only ever written by process_application_notifications() (security
-- definer, service role) — same pattern as ai_tutor_requests/payments:
-- no client grant at all, this is purely internal bookkeeping.
alter table notification_dispatch enable row level security;

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
  dispatch record;
  resp net.http_response;
  new_request_id bigint;
begin
  select decrypted_secret into webhook_url from vault.decrypted_secrets where name = 'notify_webhook_url';
  if webhook_url is null then
    return;
  end if;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';

  -- Phase 1: resolve outcomes of requests dispatched on an earlier
  -- (already-committed) run.
  for dispatch in select * from notification_dispatch loop
    select * into resp from net._http_response where id = dispatch.request_id;

    if found then
      if resp.status_code between 200 and 299 then
        perform pgmq.delete('application_notifications', dispatch.msg_id);
      end if;
      -- else: leave the pgmq message as-is — it reappears once its
      -- visibility timeout (set in phase 2) elapses, and gets retried or
      -- eventually archived there based on read_ct.
      delete from notification_dispatch where msg_id = dispatch.msg_id;
    elsif dispatch.dispatched_at < now() - interval '2 minutes' then
      -- No response after 2 minutes (pg_net worker down, or the request
      -- itself is somehow stuck) — stop waiting on this one; the pgmq
      -- message's own visibility timeout still governs its retry.
      delete from notification_dispatch where msg_id = dispatch.msg_id;
    end if;
  end loop;

  -- Phase 2: dispatch newly-visible messages. vt is long enough that this
  -- same message won't be re-read next run while its phase-1 check is
  -- still pending.
  for msg in select * from pgmq.read('application_notifications', 120, 10) loop
    if msg.read_ct >= 6 then
      perform pgmq.archive('application_notifications', msg.msg_id);
      continue;
    end if;

    new_request_id := net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(webhook_secret, '')),
      body := msg.message
    );

    insert into notification_dispatch (msg_id, request_id, dispatched_at)
    values (msg.msg_id, new_request_id, now())
    on conflict (msg_id) do update set request_id = excluded.request_id, dispatched_at = now();
  end loop;
end;
$$;

select cron.schedule('process-application-notifications', '* * * * *', $$select process_application_notifications()$$);
