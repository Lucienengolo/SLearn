-- Lets an instructor manually enroll a student into their OWN course (the
-- "Add Student" action on the classroom/student-management page, adapted
-- from the Slearn classroom.png reference, 2026-07-24). Real use case:
-- payment settled outside Stripe (bank transfer, mobile money on-site) --
-- same shape of gap as the tutor-marketplace's split-payment work, not
-- speculative. Scoped tightly: only for courses the instructor themselves
-- own, and only a student-role profile can be the enrollee.
create policy "instructors enroll students into their own courses"
  on enrollments for insert
  to authenticated
  with check (
    exists (
      select 1 from courses c
      where c.id = enrollments.course_id
        and c.instructor_id = auth.uid()
    )
    and exists (
      select 1 from profiles p
      where p.id = enrollments.student_id
        and p.role = 'student'
    )
  );
