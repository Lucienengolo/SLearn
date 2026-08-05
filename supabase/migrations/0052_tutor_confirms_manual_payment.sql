-- Founder feedback, 2026-08-05: closing a WhatsApp-handoff booking
-- (0051_tutor_match_manual_settlement.sql) required a reviewer to
-- personally mark every match settled -- the tutor, who's the one who
-- actually knows payment was finalized on WhatsApp, should be able to
-- close it themselves. Mirrors confirm_balance_received's exact structure
-- (0032_tutor_payments.sql): same "verify caller is the assigned tutor"
-- check, same idempotent-no-op-if-already-completed convention. The
-- reviewer's settle_match_manually (0051) stays as a manual override for
-- the rare case a tutor never confirms -- already covered by that
-- migration's staleness notification.
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

  select r.parent_id into v_parent_id
  from tutor_requests r
  join matches m on m.request_id = r.id
  where m.id = p_match_id;

  insert into notifications (user_id, title, body, link)
  values (v_parent_id, 'Booking settled', 'Your tutor confirmed payment was received -- this booking is now complete.', 'tutor-matches');
end;
$$;

grant execute on function confirm_manual_payment_received(uuid) to authenticated;
