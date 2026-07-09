-- Courses previously went live the moment an instructor flipped
-- is_published -- no admin sign-off at all. Adds a moderation gate: a
-- course is only publicly visible once both is_published = true AND an
-- admin/reviewer has approved it.
alter table courses add column moderation_status text not null default 'pending'
  check (moderation_status in ('pending', 'approved', 'rejected'));
alter table courses add column moderation_notes text;

-- Backfill: courses already live before this migration existed shouldn't
-- suddenly vanish pending a retroactive review.
update courses set moderation_status = 'approved' where is_published = true;

-- Same self-escalation-guard pattern as profiles_set_updated_at
-- (0001_core_schema.sql) for role/verified/is_reviewer: RLS's WITH CHECK
-- can constrain the shape of a row, but can't easily compare against the
-- pre-update value to stop an instructor simply setting
-- moderation_status='approved' on their own UPDATE. A trigger can.
create or replace function courses_guard_moderation()
returns trigger language plpgsql as $$
declare
  caller_is_reviewer boolean;
begin
  caller_is_reviewer := auth.role() = 'service_role'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true);

  if not caller_is_reviewer then
    if new.moderation_status is distinct from old.moderation_status then
      new.moderation_status := old.moderation_status;
    end if;
    -- Publishing (false -> true) always re-queues for review, even if
    -- moderation_status still reads 'approved' from a prior publish
    -- cycle -- otherwise unpublish+republish would skip moderation.
    if new.is_published = true and old.is_published = false then
      new.moderation_status := 'pending';
      new.moderation_notes := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger courses_guard_moderation_trigger
  before update on courses
  for each row execute function courses_guard_moderation();

-- Public/enrollee visibility now requires admin approval too -- the
-- instructor's own view of their course (published or not, decided or
-- not) is unaffected.
drop policy "courses visible if published or owned by the instructor" on courses;
create policy "courses visible if published or owned by the instructor"
  on courses for select
  using (
    (is_published = true and moderation_status = 'approved')
    or instructor_id = (select auth.uid())
  );

-- Reviewers need to see pending courses to act on them (their own-course
-- visibility above doesn't cover courses owned by OTHER instructors).
create policy "reviewers view all courses"
  on courses for select
  using (exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_reviewer = true));

-- enrollments: same gap -- a student could otherwise insert an
-- enrollment row directly (bypassing the UI, which wouldn't show a
-- pending course at all) for a free course still awaiting moderation.
drop policy "students enroll themselves" on enrollments;
create policy "students enroll themselves"
  on enrollments for insert
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'student')
    and exists (
      select 1 from courses c
      where c.id = enrollments.course_id and c.price = 0 and c.is_published = true and c.moderation_status = 'approved'
    )
  );

-- lessons: the free/public-discovery branch needs the same moderation
-- gate as courses -- otherwise a pending/rejected course's free lessons
-- would still leak through via "is_published = true" even though the
-- course itself is correctly hidden from the catalog above. The
-- instructor-owner and already-enrolled-student branches are
-- deliberately left ungated by moderation_status: an instructor must
-- still see their own course's lessons while it's pending review (to
-- keep editing it), and a student who enrolled before a course was
-- later flagged shouldn't lose access mid-course.
drop policy "lessons visible for free courses, enrollees, or the instructor" on lessons;
create policy "lessons visible for free courses, enrollees, or the instructor"
  on lessons for select
  using (
    exists (
      select 1 from courses c
      where c.id = lessons.course_id
        and c.is_published = true
        and (
          (c.price = 0 and c.moderation_status = 'approved')
          or c.instructor_id = (select auth.uid())
          or exists (
            select 1 from enrollments e
            where e.course_id = c.id and e.student_id = (select auth.uid())
          )
        )
    )
  );
