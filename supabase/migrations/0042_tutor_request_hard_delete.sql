-- Founder feedback (2026-07-30): "when a request is deleted that means it
-- should completely deleted from the DB and remove on the UI" -- the
-- previous "Supprimer la demande" action only soft-cancelled the row
-- (status = 'cancelled'), which then kept showing up in "My Requests" with
-- a cancelled label instead of disappearing. Scoped to status = 'searching'
-- only -- the same boundary as the existing update policy -- since a
-- request that already has a match has conversation/payment history
-- (matches/chat_messages/tutor_session_payments) cascading from it via
-- "on delete cascade" foreign keys; the delete action in the UI is already
-- only ever offered on the "still searching" screen, so this changes
-- nothing about *when* delete is available, only what it does underneath.
create policy "parents delete their own still-searching request"
  on tutor_requests for delete
  using (parent_id = (select auth.uid()) and status = 'searching');
