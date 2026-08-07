-- Founder report, 2026-08-07: clicking a match-related notification (e.g.
-- "Booking settled") never opened the specific booking -- App.tsx's
-- handleNavigate collapsed every such `link` down to a bare section name
-- ('tutor-matches'), discarding any entity id. Worse for parents: that
-- section name is tutor-only (SLearnClassroom.tsx), so a parent's
-- notification was a complete dead end, not just a generic list. Fix (see
-- App.tsx/SLearnClassroom.tsx for the matching client-side change): encode
-- the specific match id for tutor-facing links (tutor-matches/<matchId>,
-- newly hash-routable), and the specific request id for parent-facing
-- links (tutor-request-<requestId>, already a fully working deep link via
-- MatchStatus.tsx -- zero new client code needed for the parent side).

create or replace function settle_match_manually(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tutor_id uuid;
  v_parent_id uuid;
  v_request_id uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true) then
    raise exception 'Only reviewers can settle a match manually';
  end if;

  update matches
  set status = 'completed', completed_at = now()
  where id = p_match_id
    and status = 'messaging'
    and confirmed_session_date is not null
  returning tutor_id into v_tutor_id;

  if v_tutor_id is null then
    raise exception 'Match not eligible for manual settlement';
  end if;

  select r.parent_id, r.id into v_parent_id, v_request_id
  from matches m
  join tutor_requests r on r.id = m.request_id
  where m.id = p_match_id;

  insert into notifications (user_id, title, body, link)
  values
    (v_tutor_id, 'Booking settled', 'Your tutor booking has been confirmed as settled by our team.', format('tutor-matches/%s', p_match_id)),
    (v_parent_id, 'Booking settled', 'Your tutor booking has been confirmed as settled by our team.', format('tutor-request-%s', v_request_id));
end;
$$;

create or replace function confirm_manual_payment_received(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tutor_id uuid;
  v_status text;
  v_confirmed_date timestamptz;
  v_parent_id uuid;
  v_request_id uuid;
begin
  select m.tutor_id, m.status, m.confirmed_session_date into v_tutor_id, v_status, v_confirmed_date
  from matches m
  where m.id = p_match_id;

  if v_tutor_id is null then
    raise exception 'Match not found';
  end if;

  if v_tutor_id <> auth.uid() then
    raise exception 'Only the assigned tutor can confirm payment receipt';
  end if;

  -- Idempotent: a tutor double-tapping the confirm button shouldn't see an
  -- error, same convention as confirm_balance_received.
  if v_status = 'completed' then
    return;
  end if;

  if v_status <> 'messaging' or v_confirmed_date is null then
    raise exception 'Match not eligible for manual payment confirmation';
  end if;

  update matches
  set status = 'completed', completed_at = now()
  where id = p_match_id;

  select r.parent_id, r.id into v_parent_id, v_request_id
  from tutor_requests r
  join matches m on m.request_id = r.id
  where m.id = p_match_id;

  insert into notifications (user_id, title, body, link)
  values (v_parent_id, 'Booking settled', 'Your tutor confirmed payment was received -- this booking is now complete.', format('tutor-request-%s', v_request_id));
end;
$$;

create or replace function resolve_dispute(p_match_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tutor_id uuid;
  v_parent_id uuid;
  v_request_id uuid;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Only an admin can resolve a dispute';
  end if;

  if p_resolution not in ('cancelled_refunded', 'completed') then
    raise exception 'Invalid resolution: %', p_resolution;
  end if;

  update matches
  set status = p_resolution,
      cancelled_at = case when p_resolution = 'cancelled_refunded' then now() else cancelled_at end,
      completed_at = case when p_resolution = 'completed' then now() else completed_at end
  where id = p_match_id and status = 'dispute_review'
  returning tutor_id into v_tutor_id;

  if v_tutor_id is null then
    raise exception 'No dispute-review match found for that id';
  end if;

  update tutor_session_payments
  set cancellation_status = case when p_resolution = 'cancelled_refunded' then 'cancelled_refunded' else 'none' end,
      refund_status = case when p_resolution = 'cancelled_refunded' then refund_status else null end
  where match_id = p_match_id;

  select r.parent_id, r.id into v_parent_id, v_request_id
  from matches m join tutor_requests r on r.id = m.request_id
  where m.id = p_match_id;

  perform log_admin_action('resolve_dispute', 'match', p_match_id, p_resolution);

  insert into notifications (user_id, title, body, link)
  values
    (v_tutor_id, 'Dispute resolved', 'An administrator has resolved the dispute on your booking.', format('tutor-matches/%s', p_match_id)),
    (v_parent_id, 'Dispute resolved', 'An administrator has resolved the dispute on your booking.', format('tutor-request-%s', v_request_id));
end;
$$;

create or replace function notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_parent_id uuid;
  v_request_id uuid;
  v_recipient_id uuid;
  v_link text;
  v_sender_name text;
begin
  select m.tutor_id, tr.parent_id, tr.id
    into v_tutor_id, v_parent_id, v_request_id
  from matches m
  join tutor_requests tr on tr.id = m.request_id
  where m.id = new.match_id;

  if v_tutor_id is null then
    -- Match/request row missing (shouldn't happen given the FK, but don't
    -- block the message insert over a notification failure).
    return new;
  end if;

  if new.sender_id = v_tutor_id then
    v_recipient_id := v_parent_id;
    v_link := format('tutor-request-%s', v_request_id);
  else
    v_recipient_id := v_tutor_id;
    v_link := format('tutor-matches/%s', new.match_id);
  end if;

  select full_name into v_sender_name from profiles where id = new.sender_id;

  -- Sending the message is the primary action; notifying the recipient is
  -- a side effect. A notification-insert failure (unexpected constraint,
  -- etc.) must never roll back the message itself -- mirrors the existing
  -- edge functions' own "log and continue" leniency around notification
  -- inserts (e.g. match-tutor-request/index.ts).
  begin
    insert into notifications (user_id, title, body, link)
    values (
      v_recipient_id,
      'Nouveau message de ' || coalesce(v_sender_name, 'un utilisateur'),
      left(new.body, 140),
      v_link
    );
  exception when others then
    raise warning 'notify_on_new_message: failed to insert notification for message %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
