-- Accounts are single-role: a profile is either a student or an instructor,
-- never both (see README §5.A). The enrollments insert policy only checked
-- student_id = auth.uid(), which let an instructor account enroll in a
-- course as a "student" via a direct API call even though the UI hid the
-- button. Require the inserting profile to actually be a student.
drop policy "students enroll themselves" on enrollments;

create policy "students enroll themselves"
  on enrollments for insert
  with check (
    student_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'student')
  );
