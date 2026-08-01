-- New-chat-message notifications (founder request, 2026-08-01, Batch 4 of
-- the beta-readiness roadmap). lib/matches.ts's sendMessage() inserts
-- directly into `messages` as the authenticated sender -- notifications'
-- own INSERT policy only allows a user to notify themselves
-- ("users create only their own notifications", 0023_notifications.sql),
-- so a plain client-side insert can't notify the OTHER party in the
-- conversation. A security-definer trigger runs with the migration
-- owner's privileges, bypassing that self-only restriction for exactly
-- this one, narrow, server-controlled side effect -- the same pattern the
-- existing edge functions already use via the service-role key, just
-- expressed as a trigger since messages are inserted directly by the
-- client (no edge function in that path to add the notification to).
--
-- Recipient resolution: a match has a tutor_id (matches.tutor_id) and a
-- parent (via matches.request_id -> tutor_requests.parent_id). The
-- recipient is whichever of the two is NOT the message sender. `link`
-- uses the same flat-page-string convention already established by
-- match-tutor-request's own notification inserts (no per-match deep link
-- support in NotificationBell today) -- 'tutor-matches' for a tutor
-- recipient, 'my-requests' for a parent recipient.
create or replace function notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_parent_id uuid;
  v_recipient_id uuid;
  v_link text;
  v_sender_name text;
begin
  select m.tutor_id, tr.parent_id
    into v_tutor_id, v_parent_id
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
    v_link := 'my-requests';
  else
    v_recipient_id := v_tutor_id;
    v_link := 'tutor-matches';
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

create trigger on_message_notify_recipient
  after insert on messages
  for each row
  execute function notify_on_new_message();
