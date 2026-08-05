-- Founder feedback, 2026-08-05: TutorMatches.tsx ("My Matches" tab) shows
-- every match a tutor has ever had, forever, with no way to remove
-- finished ones -- completed and declined matches pile up indefinitely.
-- This only hides a match from the tutor's own list (tutor_dismissed_at
-- filter in fetchMyMatchesAsTutor); it never deletes the underlying row,
-- which stays intact for payment history, reviewer settlement records, and
-- notifications that reference it.
alter table matches add column tutor_dismissed_at timestamptz;

-- Scoped to the same terminal set TERMINAL_MATCH_STATUSES already uses in
-- lib/matches.ts (expired, declined, cancelled_refunded, completed) -- an
-- active match can't be dismissed out from under a parent still relying on
-- it, only ones that are actually finished.
create policy "tutors dismiss their own terminal matches"
  on matches for update
  using (tutor_id = (select auth.uid()) and status in ('expired', 'declined', 'cancelled_refunded', 'completed'))
  with check (tutor_id = (select auth.uid()) and status in ('expired', 'declined', 'cancelled_refunded', 'completed'));

-- Belt-and-suspenders, same reasoning as profiles_set_updated_at's
-- role/verified lockdown (0001_core_schema.sql): Postgres RLS policies for
-- the same command are OR'd together, and this table already has an older,
-- more permissive UPDATE policy ("match participants confirm the session
-- date") whose WITH CHECK only re-validates status = 'messaging' -- it
-- doesn't restrict which OTHER columns move. Verified directly: without
-- this trigger, a tutor could set tutor_dismissed_at on their own ACTIVE
-- 'messaging' match by riding that policy's looser USING/WITH CHECK,
-- defeating the terminal-only intent above. This trigger is the actual
-- backstop regardless of which policy admits the row.
create or replace function matches_guard_tutor_dismissal()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tutor_dismissed_at is distinct from old.tutor_dismissed_at then
    if not (
      new.tutor_id = (select auth.uid())
      and new.status in ('expired', 'declined', 'cancelled_refunded', 'completed')
    ) then
      new.tutor_dismissed_at = old.tutor_dismissed_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger matches_guard_tutor_dismissal
  before update on matches
  for each row execute function matches_guard_tutor_dismissal();
