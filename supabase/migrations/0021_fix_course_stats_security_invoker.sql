-- 0020's course_stats used security_invoker = true, which means its
-- enrollment_count aggregate is silently filtered by enrollments' own RLS
-- ("students view their own enrollments") -- so a browsing student or
-- guest would see 0 or 1, never the real total. This isn't new: the N+1
-- code course_stats replaced had the exact same bug (a plain count query
-- against enrollments is just as RLS-filtered), it was just less obvious
-- one course card at a time than it is staring at the view directly.
--
-- The product intent is clearly a public marketplace stat ("50 students
-- enrolled"), and the aggregate itself doesn't leak which students --
-- unlike student_course_progress (kept security_invoker = true), which
-- must stay scoped to the querying student's own rows since it's their
-- personal completion data, not a public count.
drop view course_stats;

create view course_stats
  with (security_invoker = false) as
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

grant select on course_stats to anon, authenticated;
