-- League feature (founder request, 2026-07-27): a global, platform-wide XP
-- leaderboard for all students, plus a "classroom league" scoped to a
-- single course's (or one instructor's combined courses') lesson/quiz
-- activity. Reused by three call sites: the student's per-course league
-- dropdown, the instructor's per-course league tab, and the instructor's
-- "global" tab across every course they teach.
--
-- XP scope deliberately matches the course(s) actually being ranked --
-- using a student's platform-wide total XP for every scope would make
-- "course league" and "instructor global league" collapse into the exact
-- same ranking, which defeats the point of having two views. Computed live
-- from lesson_progress/quiz_attempts -- no new counters to keep in sync,
-- same "derive, don't duplicate" approach as lib/gamification.ts.
--
-- All three RPCs are security definer (so they can rank students without
-- each caller needing raw SELECT on other students' lesson_progress/
-- quiz_attempts) and therefore MUST enforce their own authorization, since
-- RLS is bypassed inside them.

-- Internal helper -- intentionally not granted to `authenticated`. Callers
-- go through get_course_league/get_instructor_league, which check who is
-- allowed to see which course_ids before ever calling this.
create or replace function compute_course_scoped_xp(p_course_ids uuid[])
returns table(student_id uuid, xp bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with scoped_lessons as (
    select id from lessons where course_id = any(p_course_ids)
  ),
  completed as (
    select lp.student_id, count(*) as c
    from lesson_progress lp
    where lp.completed and lp.lesson_id in (select id from scoped_lessons)
    group by lp.student_id
  ),
  passed as (
    select qa.student_id, count(distinct qa.quiz_id) as c
    from quiz_attempts qa
    join quizzes q on q.id = qa.quiz_id
    where qa.passed and q.lesson_id in (select id from scoped_lessons)
    group by qa.student_id
  ),
  enrolled as (
    select distinct student_id from enrollments where course_id = any(p_course_ids)
  )
  select e.student_id, (coalesce(c.c, 0) * 10 + coalesce(p.c, 0) * 15)::bigint as xp
  from enrolled e
  left join completed c on c.student_id = e.student_id
  left join passed p on p.student_id = e.student_id;
$$;

-- Global League: every student on the platform, ranked by all-time
-- platform-wide XP. Always includes the caller's own row even when it
-- falls outside p_limit, so the UI can show "you're #142" beneath the
-- visible top of the board without a second round trip.
create or replace function get_global_league(p_limit int default 50)
returns table(student_id uuid, full_name text, totem text, xp bigint, rank bigint, is_me boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with xp_totals as (
    select p.id as student_id, p.full_name, p.totem,
      (coalesce(lp.c, 0) * 10 + coalesce(qa.c, 0) * 15)::bigint as xp
    from profiles p
    left join (
      select student_id, count(*) as c from lesson_progress where completed group by student_id
    ) lp on lp.student_id = p.id
    left join (
      select student_id, count(distinct quiz_id) as c from quiz_attempts where passed group by student_id
    ) qa on qa.student_id = p.id
    where p.role = 'student'
  ),
  ranked as (
    select student_id, full_name, totem, xp,
      row_number() over (order by xp desc, student_id) as rnk
    from xp_totals
  )
  select student_id, full_name, totem, xp, rnk, (student_id = auth.uid())
  from ranked
  where rnk <= p_limit or student_id = auth.uid()
  order by rnk;
$$;

grant execute on function get_global_league(int) to authenticated;

-- Classroom League, single-course scope. Used both for a student's
-- per-course leaderboard (they pick the course from a dropdown) and for an
-- instructor's own per-course tab. Caller must either be enrolled in the
-- course or be its instructor -- anyone else gets rejected outright, since
-- this function bypasses RLS.
create or replace function get_course_league(p_course_id uuid, p_limit int default 50)
returns table(student_id uuid, full_name text, totem text, xp bigint, rank bigint, is_me boolean)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  -- Table aliases are required here, not stylistic -- get_course_league's
  -- own `student_id` OUT parameter otherwise shadows enrollments.student_id
  -- inside this EXISTS subquery (plpgsql binds bare column names to
  -- function-level variables before table columns).
  if not exists (
    select 1 from enrollments e where e.course_id = p_course_id and e.student_id = auth.uid()
  ) and not exists (
    select 1 from courses c where c.id = p_course_id and c.instructor_id = auth.uid()
  ) then
    raise exception 'Not authorized to view this course league';
  end if;

  return query
  with xp as (
    select * from compute_course_scoped_xp(array[p_course_id])
  ),
  ranked as (
    select x.student_id, p.full_name, p.totem, x.xp,
      row_number() over (order by x.xp desc, x.student_id) as rnk
    from xp x
    join profiles p on p.id = x.student_id
  )
  select r.student_id, r.full_name, r.totem, r.xp, r.rnk, (r.student_id = auth.uid())
  from ranked r
  where r.rnk <= p_limit or r.student_id = auth.uid()
  order by r.rnk;
end;
$$;

grant execute on function get_course_league(uuid, int) to authenticated;

-- Instructor League: the instructor's own read-only view of their
-- students -- either across every course they teach ("global",
-- p_course_id null) or scoped to one course. Always scoped to courses THEY
-- teach; never callable for someone else's course or students.
create or replace function get_instructor_league(p_course_id uuid default null, p_limit int default 100)
returns table(student_id uuid, full_name text, totem text, xp bigint, rank bigint)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_course_ids uuid[];
begin
  if p_course_id is not null then
    if not exists (select 1 from courses c where c.id = p_course_id and c.instructor_id = auth.uid()) then
      raise exception 'Not authorized to view this course league';
    end if;
    v_course_ids := array[p_course_id];
  else
    select array_agg(id) into v_course_ids from courses where instructor_id = auth.uid();
  end if;

  if v_course_ids is null then
    return;
  end if;

  return query
  with xp as (
    select * from compute_course_scoped_xp(v_course_ids)
  ),
  ranked as (
    select x.student_id, p.full_name, p.totem, x.xp,
      row_number() over (order by x.xp desc, x.student_id) as rnk
    from xp x
    join profiles p on p.id = x.student_id
  )
  select r.student_id, r.full_name, r.totem, r.xp, r.rnk
  from ranked r
  where r.rnk <= p_limit
  order by r.rnk;
end;
$$;

grant execute on function get_instructor_league(uuid, int) to authenticated;
