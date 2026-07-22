-- Tutor session payments: balance confirmation RPC (T7). Deposit
-- creation/webhook and cancellation/refund logic live in edge functions
-- (create-tutor-deposit-checkout, stripe-webhook, cancel-tutor-booking) --
-- this migration only adds the one DB-side piece that's a simple atomic
-- multi-table update: the tutor confirming they received the in-person/
-- mobile-money balance.
--
-- tutor_session_payments deliberately has no client insert/update RLS
-- policy (0030_tutor_marketplace.sql's comment: "balance confirmation is
-- written by a service-role RPC the tutor calls") -- this function is that
-- RPC, matching create_tutor_request()'s precedent for atomic,
-- security-definer writes instead of a raw RLS-gated client update.
create or replace function confirm_balance_received(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tutor_id uuid;
  v_balance_status text;
begin
  select m.tutor_id, p.balance_status into v_tutor_id, v_balance_status
  from matches m
  join tutor_session_payments p on p.match_id = m.id
  where m.id = p_match_id;

  if v_tutor_id is null then
    raise exception 'No payment record found for match %', p_match_id;
  end if;

  if v_tutor_id <> auth.uid() then
    raise exception 'Only the assigned tutor can confirm balance receipt';
  end if;

  -- Idempotent: a second confirmation on an already-settled booking is a
  -- no-op (CEO plan's Error & Rescue Registry), not an error -- a tutor
  -- double-tapping the confirm button shouldn't see a scary failure.
  if v_balance_status = 'confirmed' then
    return;
  end if;

  update tutor_session_payments
  set balance_status = 'confirmed', balance_confirmed_at = now(), balance_confirmed_by = auth.uid()
  where match_id = p_match_id;

  update matches
  set status = 'completed', completed_at = now()
  where id = p_match_id and status = 'in_progress';
end;
$$;

grant execute on function confirm_balance_received to authenticated;
