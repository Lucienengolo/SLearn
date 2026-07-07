-- Cal.com-backed instructor interview scheduling, replacing the bare
-- interview_slots/manual-insert flow (README §5.B: the interview step had
-- no real booking UX — just DB rows an applicant picked from and staff had
-- to populate by hand). Applicants now book through a real Cal.com event
-- type instead — real availability management, calendar sync, a video
-- link, and reminders, none of which interview_slots ever had.
--
-- interview_slots is intentionally left in place (not dropped): it's just
-- no longer written to by the app going forward. Dropping a table that
-- might still hold rows staff created is a separate, deliberate decision
-- for later, not a side effect of this migration.
alter table interviews
  add column if not exists cal_booking_uid text unique,
  add column if not exists meeting_url text;

-- Applicants previously self-inserted an interviews row by picking a slot
-- client-side. Now the only writer is cal-webhook (service role), once
-- Cal.com actually confirms a booking — same "no client insert" pattern as
-- payments/ai_tutor_requests.
drop policy if exists "applicants schedule their own interview once submitted" on interviews;
