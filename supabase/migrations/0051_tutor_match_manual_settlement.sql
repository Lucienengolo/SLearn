-- Founder report, 2026-08-04: "tutor matching don't end -- after a user
-- finds a tutor and the tutor approves and schedules a date, the session
-- never ends." Root cause: once a match reaches status='messaging' and a
-- session date is confirmed, there is no path forward while
-- PAYMENTS_ENABLED=false (lib/paymentsConfig.ts) -- the parent's only
-- action was a "Pay deposit" button that always errors, and no RLS policy,
-- cron, or edge function can move matches.status out of 'messaging' other
-- than the tutor's own matched->declined policy.
--
-- Founder's fix: once both parties mutually agree (tutor accepted + date
-- confirmed), both are redirected to WhatsApp with an admin
-- (+237659802679, hardcoded per founder, see lib/adminContact.ts) to
-- finalize payment out-of-band, plus a minimal reviewer-only "mark
-- settled" action to actually close the booking out (an explicit, scoped
-- exception to the "no custom admin UI" decision in TODOS.md -- this
-- reuses the existing ReviewQueue.tsx surface, not a new admin panel).

-- 1. Bug fix: expire_unresponsive_parent_matches() didn't check
-- confirmed_session_date, so a healthy, mutually-agreed booking (which can
-- never reach deposit_paid_at while payments are off) got silently
-- auto-expired 48h after messaging_started_at -- punishing exactly the
-- case the founder is describing, not just genuinely abandoned matches.
create or replace function expire_unresponsive_parent_matches()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  with expired as (
    update matches
    set status = 'expired'
    where status = 'messaging'
      and deposit_paid_at is null
      and confirmed_session_date is null
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

-- 2. Staleness net for the new manual-settlement step: a match with a
-- confirmed date no longer auto-expires (above), so without this, a
-- booking the admin forgets to settle after the WhatsApp handoff would
-- silently sit in 'messaging' forever -- the exact class of bug this
-- whole fix is meant to close. Reuses mark_stalled_bookings()'s existing
-- loop/notify pattern (same function, same cron schedule) rather than a
-- new job.
create or replace function mark_stalled_bookings()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stalled_match_id uuid;
begin
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

  -- Mutually-agreed booking (messaging + confirmed date), 5+ days past the
  -- session date, still not manually settled -- flag for reviewer
  -- follow-up the same way, without expiring or otherwise touching it.
  for v_stalled_match_id in
    select m.id
    from matches m
    where m.status = 'messaging'
      and m.confirmed_session_date is not null
      and m.confirmed_session_date < now() - interval '5 days'
      and not exists (
        select 1 from notifications n
        where n.link = format('admin/matches/%s', m.id)
          and n.title = 'Booking settlement overdue'
      )
  loop
    insert into notifications (user_id, title, body, link)
    select r.id,
           'Booking settlement overdue',
           format('Match %s was confirmed for a session 5+ days ago and still needs manual settlement.', v_stalled_match_id),
           format('admin/matches/%s', v_stalled_match_id)
    from profiles r
    where r.is_reviewer = true;
  end loop;
end;
$$;

-- 3. Reviewer-facing read: everything the settlement UI needs in one call,
-- security-definer so no new broad RLS grant is needed on matches/
-- tutor_requests/tutor_profile_fields for reviewers (same pattern as
-- get_course_instructor_email, 0046_restrict_profile_email.sql).
create or replace function get_pending_match_settlements()
returns table(
  match_id uuid,
  confirmed_session_date timestamptz,
  parent_name text,
  parent_whatsapp text,
  tutor_name text,
  tutor_whatsapp text,
  rate_per_session numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true) then
    return;
  end if;

  return query
    select m.id, m.confirmed_session_date,
           pp.full_name, r.whatsapp_contact,
           tp.full_name, tf.whatsapp_contact,
           tf.rate_per_session
    from matches m
    join tutor_requests r on r.id = m.request_id
    join profiles pp on pp.id = r.parent_id
    join profiles tp on tp.id = m.tutor_id
    join tutor_profile_fields tf on tf.tutor_id = m.tutor_id
    where m.status = 'messaging'
      and m.confirmed_session_date is not null
    order by m.confirmed_session_date asc;
end;
$$;

grant execute on function get_pending_match_settlements() to authenticated;

-- 4. The one write path a reviewer needs: close out a mutually-agreed
-- match once the admin has confirmed payment was finalized on WhatsApp.
-- Goes straight to 'completed' (no fake deposit_paid/in_progress
-- interstitial -- this models a single manual out-of-band collection, not
-- a Stripe split-payment that never happened).
create or replace function settle_match_manually(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tutor_id uuid;
  v_parent_id uuid;
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

  select r.parent_id into v_parent_id
  from matches m
  join tutor_requests r on r.id = m.request_id
  where m.id = p_match_id;

  insert into notifications (user_id, title, body, link)
  values
    (v_tutor_id, 'Booking settled', 'Your tutor booking has been confirmed as settled by our team.', 'tutor-matches'),
    (v_parent_id, 'Booking settled', 'Your tutor booking has been confirmed as settled by our team.', 'tutor-matches');
end;
$$;

grant execute on function settle_match_manually(uuid) to authenticated;
