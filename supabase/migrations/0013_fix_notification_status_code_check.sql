-- Fixes a second real bug in process_application_notifications(), again
-- only found by invoking it against the live project and checking the
-- actual state afterward, not just reading the code.
--
-- `resp net.http_response; select * into resp from net._http_response`
-- looked reasonable (names line up) but is wrong: net.http_response is a
-- 3-field composite (status_code, headers, body) used for
-- http_collect_response's return value, NOT the shape of the
-- net._http_response table, which has 8 columns in a different order (id,
-- status_code, content_type, headers, content, timed_out, error_msg,
-- created). `select * into` a fixed composite type matches by position,
-- not name, and silently took only the first 3 columns — so
-- resp.status_code actually held the row's `id`, not its real status
-- code. Confirmed directly: dispatched a real request that got a genuine
-- 200 back, and the message still didn't get deleted because `id` (a
-- small integer like 4) never falls in 200..299.
--
-- Fix: select the one column we actually need, by name, into a plain int.
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
  resp_status_code int;
  new_request_id bigint;
begin
  select decrypted_secret into webhook_url from vault.decrypted_secrets where name = 'notify_webhook_url';
  if webhook_url is null then
    return;
  end if;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'notify_webhook_secret';

  for dispatch in select * from notification_dispatch loop
    select status_code into resp_status_code from net._http_response where id = dispatch.request_id;

    if found then
      if resp_status_code between 200 and 299 then
        perform pgmq.delete('application_notifications', dispatch.msg_id);
      end if;
      delete from notification_dispatch where msg_id = dispatch.msg_id;
    elsif dispatch.dispatched_at < now() - interval '2 minutes' then
      delete from notification_dispatch where msg_id = dispatch.msg_id;
    end if;
  end loop;

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
