-- Pre-beta security review, 2026-08-02: a negative-path sweep across every
-- self-service INSERT/UPDATE RLS policy (not just the "does the owner
-- succeed" happy path, but "is a non-owner or an out-of-scope column
-- change actually blocked") found 4 real, live-exploitable gaps. Each
-- shares the same root cause as `profiles`/`courses` before their existing
-- guard triggers (`profiles_set_updated_at`, `courses_guard_moderation`):
-- a self-service policy scoped by row ownership, but with no `with_check`
-- (or an incomplete one) restricting which columns/values can be written.
-- profiles/courses happened to already have a guard trigger backstopping
-- the sensitive columns; these four didn't.
--
-- Confirmed live-exploitable against ci_test with policy text matching
-- production exactly before this migration:
--   1. A student could insert a `certificates` row for any course_id,
--      including one they were never enrolled in -- the INSERT policy only
--      checked `student_id = auth.uid()`.
--   2. A student could set their own `enrollments.progress_percentage` and
--      `completed_at` to any value directly, with zero relationship to
--      actual `lesson_progress`/`quiz_attempts` data -- the UPDATE policy
--      had no `with_check` at all.
--   3. Either match participant could reassign their own `matches.tutor_id`
--      (or `request_id`) to a completely different, non-consenting tutor
--      via the "confirm the session date" UPDATE policy, whose `with_check`
--      only pinned `status = 'messaging'`.
--   4. An instructor applicant could self-clear their own
--      `background_check_status` (and rewrite `decision_notes`/
--      `decided_at`, which are meant to be reviewer-only) via the
--      applicant-edit UPDATE policy, whose `with_check` only restricted
--      `applicant_id`/`status`.

-- 1 & 2: enrollments.progress_percentage/completed_at become server-computed,
-- not client-writable. A BEFORE UPDATE trigger recomputes both from the
-- student's actual lesson_progress (and, if the course has a final exam,
-- quiz_attempts) every time, overriding whatever the client sent -- the
-- exact same computation the client already did in
-- LessonViewer.tsx's updateCourseProgress(), just made authoritative.
-- This makes the existing "no with_check" UPDATE policy safe to leave as
-- ownership-only: the client can still call it (that's how legitimate
-- progress updates happen), but it can no longer lie about the result.
-- security definer + a pinned search_path (same pattern as every other
-- server-authoritative function this session) so the trigger reads
-- lessons/lesson_progress/quiz_attempts as the table owner, not gated by
-- the caller's own RLS visibility into those tables.
create or replace function enrollments_recompute_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_lessons integer;
  v_completed_lessons integer;
  v_final_exam_id uuid;
  v_passed boolean;
begin
  -- service_role (edge functions, admin tooling) bypasses recomputation --
  -- there is no such caller today, but this keeps the door open the same
  -- way profiles_set_updated_at/courses_guard_moderation do.
  if auth.role() = 'service_role' then
    return new;
  end if;

  select count(*) into v_total_lessons from lessons where course_id = new.course_id;

  select count(*) into v_completed_lessons
  from lesson_progress lp
  join lessons l on l.id = lp.lesson_id
  where lp.student_id = new.student_id and l.course_id = new.course_id and lp.completed = true;

  new.progress_percentage = case
    when v_total_lessons = 0 then 0
    else round((v_completed_lessons::numeric / v_total_lessons) * 100)::integer
  end;

  if new.progress_percentage = 100 then
    select id into v_final_exam_id from quizzes where course_id = new.course_id;
    if v_final_exam_id is not null then
      select exists(
        select 1 from quiz_attempts
        where student_id = new.student_id and quiz_id = v_final_exam_id and passed = true
      ) into v_passed;
      new.completed_at = case when v_passed then coalesce(old.completed_at, now()) else null end;
    else
      new.completed_at = coalesce(old.completed_at, now());
    end if;
  else
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create trigger enrollments_recompute_progress_trigger
  before update on enrollments
  for each row execute function enrollments_recompute_progress();

-- 1: certificates can now safely be gated on enrollments.completed_at,
-- since that column is server-computed as of the trigger above and no
-- longer just whatever the client claims.
drop policy "students issue their own certificates" on certificates;
create policy "students issue their own certificates"
  on certificates for insert
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from enrollments e
      where e.student_id = certificates.student_id
        and e.course_id = certificates.course_id
        and e.completed_at is not null
    )
  );

-- 3: matches.tutor_id/request_id can't be reassigned via ANY self-service
-- UPDATE policy, regardless of which one was used to make the change --
-- same silently-revert-unless-service_role pattern as
-- profiles_set_updated_at, since RLS with_check clauses have no OLD
-- reference to compare against (a policy alone can't express "this column
-- must not change", only a trigger can).
create or replace function matches_guard_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tutor_id <> old.tutor_id or new.request_id <> old.request_id then
    if auth.role() <> 'service_role' then
      new.tutor_id = old.tutor_id;
      new.request_id = old.request_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger matches_guard_reassignment_trigger
  before update on matches
  for each row execute function matches_guard_reassignment();

-- 4: background_check_status/decided_at/decision_notes are reviewer-owned
-- columns (set by the review pipeline, not the applicant) -- guarded the
-- same way, mirroring profiles_set_updated_at's role/verified/is_reviewer
-- guard exactly.
create or replace function instructor_applications_guard_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.background_check_status <> old.background_check_status
     or new.decided_at is distinct from old.decided_at
     or new.decision_notes is distinct from old.decision_notes then
    if auth.role() <> 'service_role' then
      new.background_check_status = old.background_check_status;
      new.decided_at = old.decided_at;
      new.decision_notes = old.decision_notes;
    end if;
  end if;
  return new;
end;
$$;

create trigger instructor_applications_guard_review_fields_trigger
  before update on instructor_applications
  for each row execute function instructor_applications_guard_review_fields();
