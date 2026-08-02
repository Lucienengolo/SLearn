-- Pre-beta security review, 2026-08-02: continuing the negative-path RLS
-- sweep (0047) into the remaining tables found 3 more real, live-exploitable
-- gaps, all in graded/assessed content:
--
--   1. quiz_questions.correct_answer was selectable by any student who could
--      see the quiz at all (QuizViewer.tsx did `select('*')` to grade
--      client-side) -- opening DevTools' Network tab before answering a
--      single question gets the full answer key.
--   2. quiz_attempts.score/total_points/passed were plain client-submitted
--      values with zero server verification -- independent of #1, a direct
--      API call could insert a fabricated "passed: true" attempt without
--      ever fetching the real questions.
--   3. classwork_submissions.grade/feedback/graded_at (reviewer/instructor-
--      owned columns) had no column restriction on the "students manage
--      their own submissions" ALL policy -- a student could self-grade their
--      own assignment via the exact same policy that lets them submit it.
--
-- (Also reviewed and ruled out as non-issues: `categories`' two INSERT
-- policies are a deliberate founder decision documented in
-- 0041_parents_create_categories.sql, not a leftover bug; `interview_slots`
-- has a real RLS gap but is dead code -- interviews are booked through
-- Cal.com per supabase/functions/cal-webhook, nothing in the client reads
-- or writes this table -- so it's noted, not fixed, since there's no live
-- exploit path.)

-- 1 & 2: quiz grading becomes fully server-side and authoritative.
-- compute_quiz_grade() is the single source of truth for "how was this
-- answer set graded" -- called live (by anon guests previewing a quiz AND
-- signed-in students, for the immediate on-screen result) and reused by the
-- quiz_attempts grading trigger below (so the persisted record can never
-- drift from what a live call would have computed). It returns the grade,
-- never the answers themselves.
create or replace function compute_quiz_grade(p_quiz_id uuid, p_answers jsonb)
returns table(
  total_points integer,
  score_percentage integer,
  passed boolean,
  correct_count integer,
  total_questions integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_total_points integer := 0;
  v_score_points integer := 0;
  v_passing_score integer;
  v_correct_count integer := 0;
  v_total_questions integer := 0;
  v_percentage integer;
begin
  select passing_score into v_passing_score from quizzes where id = p_quiz_id;

  select
    coalesce(sum(qq.points), 0),
    coalesce(sum(case when (p_answers ->> qq.id::text) = qq.correct_answer then qq.points else 0 end), 0),
    count(*),
    coalesce(sum(case when (p_answers ->> qq.id::text) = qq.correct_answer then 1 else 0 end), 0)
  into v_total_points, v_score_points, v_total_questions, v_correct_count
  from quiz_questions qq
  where qq.quiz_id = p_quiz_id;

  v_percentage := case when v_total_points = 0 then 0 else round((v_score_points::numeric / v_total_points) * 100)::integer end;

  return query select
    v_total_points,
    v_percentage,
    v_percentage >= coalesce(v_passing_score, 70),
    v_correct_count,
    v_total_questions;
end;
$$;

grant execute on function compute_quiz_grade(uuid, jsonb) to anon, authenticated;

-- The one legitimate reason to read a full quiz_questions row including
-- correct_answer: the owning instructor editing their own quiz
-- (CourseEditor.tsx's loadQuizDraft). Mirrors the exact relationship check
-- the existing "instructors manage quiz questions on their own courses"
-- policy already uses.
create or replace function get_quiz_questions_for_editing(p_quiz_id uuid)
returns setof quiz_questions
language sql
security definer
set search_path = public
stable
as $$
  select qq.*
  from quiz_questions qq
  join quizzes q on q.id = qq.quiz_id
  left join lessons l on l.id = q.lesson_id
  join courses c on c.id = coalesce(q.course_id, l.course_id)
  where qq.quiz_id = p_quiz_id
    and c.instructor_id = (select auth.uid())
  order by qq.order_index;
$$;

grant execute on function get_quiz_questions_for_editing(uuid) to authenticated;

-- Close the direct leak: same table-level-grant-replacement technique as
-- 0046_restrict_profile_email.sql (a column-level revoke alone would be a
-- no-op against Supabase's default broad table-level grant). Every column
-- except correct_answer stays selectable -- QuizBuilder/CourseEditor still
-- write it fine (INSERT/UPDATE grants are untouched), they just can't read
-- an existing question's answer back via a plain query anymore, hence the
-- RPC above for that one case.
revoke select on quiz_questions from anon, authenticated;
grant select (id, quiz_id, question_text, question_type, options, points, order_index) on quiz_questions to anon, authenticated;

-- The persisted record becomes authoritative regardless of what a client
-- claims: recompute score/total_points/passed from the real correct
-- answers on every insert, via the same compute_quiz_grade() used for live
-- display. answers itself (the student's submitted choices) is left alone
-- -- that's the one field that's supposed to reflect exactly what the
-- caller sent.
create or replace function quiz_attempts_grade_authoritatively()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grade record;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select * into v_grade from compute_quiz_grade(new.quiz_id, new.answers);
  new.total_points = v_grade.total_points;
  new.score = v_grade.score_percentage;
  new.passed = v_grade.passed;

  return new;
end;
$$;

create trigger quiz_attempts_grade_authoritatively_trigger
  before insert on quiz_attempts
  for each row execute function quiz_attempts_grade_authoritatively();

-- 3: classwork_submissions.grade/feedback/graded_at are reviewer-owned
-- (the instructor grading the assignment, via the separate "instructors
-- grade submissions" policy) -- guarded the same profiles_set_updated_at-
-- style way, but checking real course ownership rather than service_role,
-- since grading here is a normal client-side instructor action, not an
-- edge-function-only one.
create or replace function classwork_submissions_guard_grading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owning_instructor boolean;
begin
  if new.grade is distinct from old.grade
     or new.feedback is distinct from old.feedback
     or new.graded_at is distinct from old.graded_at then

    if auth.role() = 'service_role' then
      return new;
    end if;

    select exists (
      select 1 from classwork_posts p
      where p.id = new.post_id and p.instructor_id = auth.uid()
    ) into v_is_owning_instructor;

    if not v_is_owning_instructor then
      new.grade = old.grade;
      new.feedback = old.feedback;
      new.graded_at = old.graded_at;
    end if;
  end if;

  return new;
end;
$$;

create trigger classwork_submissions_guard_grading_trigger
  before update on classwork_submissions
  for each row execute function classwork_submissions_guard_grading();
