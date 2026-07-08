-- Replaces the N+1 pattern in CourseList/HomePage/StudentDashboard/
-- InstructorDashboard, where every rendered course/enrollment triggered 2-3
-- follow-up count queries client-side (e.g. 20 courses on the Courses page
-- meant 1 + 20*2 = 41 requests on load). These views compute the
-- aggregates in the database instead, so the client does one extra query
-- for however many rows it's displaying, not one per row.
--
-- security_invoker = true (available since PG15, this project runs PG17):
-- the view runs with the QUERYING user's own RLS-checked permissions, not
-- the view creator's -- otherwise a view would silently bypass RLS on its
-- underlying tables, which defeats the whole point of having RLS. None of
-- this data is actually sensitive (enrollment/lesson/review counts are
-- already publicly visible via the tables' own "publicly readable"
-- policies), but security_invoker is the correct default regardless.

create view course_stats
  with (security_invoker = true) as
select
  c.id as course_id,
  count(distinct l.id) as lesson_count,
  count(distinct e.id) as enrollment_count,
  count(distinct r.id) as review_count,
  coalesce(avg(r.rating), 0) as average_rating
from courses c
left join lessons l on l.course_id = c.id
left join enrollments e on e.course_id = c.id
left join reviews r on r.course_id = c.id
group by c.id;

-- Per-student, per-course completed-lesson count -- what StudentDashboard
-- previously computed with 2 queries per enrollment (total lesson count +
-- completed count, the second needing the first course's lesson id list).
create view student_course_progress
  with (security_invoker = true) as
select
  lp.student_id,
  l.course_id,
  count(*) filter (where lp.completed) as completed_lesson_count
from lesson_progress lp
join lessons l on l.id = lp.lesson_id
group by lp.student_id, l.course_id;

grant select on course_stats to anon, authenticated;
grant select on student_course_progress to authenticated;
