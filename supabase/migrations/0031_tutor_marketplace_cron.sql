-- Tutor marketplace timeout/cadence cron jobs (CEO plan Row 14/21, Eng
-- Review E8). Pure SQL state transitions, same convention as
-- 0010_scheduled_cleanup_cron.sql -- deliberately NOT the pgmq+vault+net
-- HTTP pattern from 0008/0011, because that pattern exists to reliably
-- deliver an EXTERNAL webhook call. Re-triggering the matching engine after
-- a timeout doesn't need an HTTP hop at all: these functions just flip
-- tutor_requests.status back to 'searching', and the parent's own
-- already-authenticated client (subscribed to their request via Realtime)
-- re-calls match-tutor-request itself, the same path used for the initial
-- match. No cron-to-edge-function call, no service-role auth story to
-- design for that edge function.
--
-- Eng Review E8: timeout-check crons run hourly (not the naive "every 48h"
-- reading of "48h timeout", which could let a match silently drift toward
-- 72h before anyone checks); the session-date-passed cron stays daily,
-- matching E8's explicit split.

create or replace function expire_unresponsive_tutor_matches()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Tutor never responded within 48h (CEO plan Row 14) -- auto-return to
  -- pool. The request goes back to 'searching' so the parent's "still
  -- looking" screen picks it up and shows the D5 transparency message
  -- ("your previous match didn't work out") rather than a silent reset.
  with expired as (
    update matches
    set status = 'expired'
    where status = 'matched'
      and tutor_responded_at is null
      and tutor_timeout_at < now()
    returning request_id
  )
  update tutor_requests
  set status = 'searching'
  where id in (select request_id from expired)
    and status = 'matched';
end;
$$;

create or replace function expire_unresponsive_parent_matches()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Symmetric parent-side 48h timeout (Post-Spec-Review item 21): parent
  -- never messaged or paid a deposit after being matched. The tutor is
  -- freed (this match becomes terminal); the request goes back to
  -- 'searching' too, so a later active parent session can still retry --
  -- but nothing proactively re-notifies a parent who's gone silent.
  with expired as (
    update matches
    set status = 'expired'
    where status = 'messaging'
      and deposit_paid_at is null
      and parent_timeout_at is not null
      and parent_timeout_at < now()
    returning request_id
  )
  update tutor_requests
  set status = 'searching'
  where id in (select request_id from expired)
    and status = 'matched';
end;
$$;

create or replace function mark_stalled_bookings()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stalled_match_id uuid;
begin
  -- No balance confirmation 3 days after the session should have happened
  -- (CEO plan's Error & Rescue Registry) -- flagged for staff follow-up,
  -- not silently left in_progress forever.
  for v_stalled_match_id in
    update matches m
    set status = 'stalled', stalled_at = now()
    from tutor_session_payments p
    where p.match_id = m.id
      and m.status = 'in_progress'
      and p.balance_status = 'pending'
      and m.in_progress_at < now() - interval '3 days'
    returning m.id
  loop
    insert into notifications (user_id, title, body, link)
    select r.id,
           'Booking follow-up needed',
           format('Match %s has been in_progress for 3+ days with no balance confirmation.', v_stalled_match_id),
           format('admin/matches/%s', v_stalled_match_id)
    from profiles r
    where r.is_reviewer = true;
  end loop;
end;
$$;

create or replace function advance_confirmed_sessions_to_in_progress()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update matches
  set status = 'in_progress', in_progress_at = now()
  where status = 'deposit_paid'
    and confirmed_session_date is not null
    and confirmed_session_date < now();
end;
$$;

select cron.schedule('expire-unresponsive-tutor-matches', '0 * * * *', $$select expire_unresponsive_tutor_matches()$$);
select cron.schedule('expire-unresponsive-parent-matches', '0 * * * *', $$select expire_unresponsive_parent_matches()$$);
select cron.schedule('mark-stalled-bookings', '0 * * * *', $$select mark_stalled_bookings()$$);
select cron.schedule('advance-confirmed-sessions', '0 3 * * *', $$select advance_confirmed_sessions_to_in_progress()$$);
