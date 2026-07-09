-- Adds optional "completion quizzes": a quiz can now be attached either to a
-- lesson (gates that lesson's completion) or directly to a course (gates
-- overall course completion / certificate issuance), instead of only ever
-- being lesson-scoped. Per product decision, gating is implicit: if a quiz
-- exists for a lesson/course, passing it is required; if none exists, the
-- existing simple mark-complete flow is unchanged. At most one quiz per
-- lesson and one per course (a real UI concept, not just a DB nicety --
-- CourseEditor's quiz builder assumes 0-or-1 per scope).

alter table quizzes alter column lesson_id drop not null;
alter table quizzes add column course_id uuid references courses(id) on delete cascade;

alter table quizzes add constraint quizzes_scope_check check (
  (lesson_id is not null and course_id is null) or (lesson_id is null and course_id is not null)
);

create unique index quizzes_lesson_unique on quizzes(lesson_id) where lesson_id is not null;
create unique index quizzes_course_unique on quizzes(course_id) where course_id is not null;

-- quizzes: rewrite visibility/management policies to resolve the owning
-- course via either the lesson join (existing case) or quizzes.course_id
-- directly (new case), instead of assuming lesson_id is always set.
drop policy "quizzes follow lesson visibility" on quizzes;
create policy "quizzes follow lesson visibility"
  on quizzes for select
  using (
    exists (
      select 1 from courses c
      where c.id = coalesce(quizzes.course_id, (select l.course_id from lessons l where l.id = quizzes.lesson_id))
        and c.is_published = true
        and (
          c.price = 0
          or c.instructor_id = (select auth.uid())
          or exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = (select auth.uid()))
        )
    )
  );

drop policy "instructors manage quizzes on their own courses" on quizzes;
create policy "instructors manage quizzes on their own courses"
  on quizzes for all
  using (
    exists (
      select 1 from courses c
      where c.id = coalesce(quizzes.course_id, (select l.course_id from lessons l where l.id = quizzes.lesson_id))
        and c.instructor_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from courses c
      where c.id = coalesce(quizzes.course_id, (select l.course_id from lessons l where l.id = quizzes.lesson_id))
        and c.instructor_id = (select auth.uid())
    )
  );

-- quiz_questions: same coalesce treatment, one level removed (via quizzes).
drop policy "quiz questions follow quiz visibility" on quiz_questions;
create policy "quiz questions follow quiz visibility"
  on quiz_questions for select
  using (
    exists (
      select 1
      from quizzes q
      left join lessons l on l.id = q.lesson_id
      join courses c on c.id = coalesce(q.course_id, l.course_id)
      where q.id = quiz_questions.quiz_id
        and c.is_published = true
        and (
          c.price = 0
          or c.instructor_id = (select auth.uid())
          or exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = (select auth.uid()))
        )
    )
  );

drop policy "instructors manage quiz questions on their own courses" on quiz_questions;
create policy "instructors manage quiz questions on their own courses"
  on quiz_questions for all
  using (
    exists (
      select 1
      from quizzes q
      left join lessons l on l.id = q.lesson_id
      join courses c on c.id = coalesce(q.course_id, l.course_id)
      where q.id = quiz_questions.quiz_id
        and c.instructor_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from quizzes q
      left join lessons l on l.id = q.lesson_id
      join courses c on c.id = coalesce(q.course_id, l.course_id)
      where q.id = quiz_questions.quiz_id
        and c.instructor_id = (select auth.uid())
    )
  );
