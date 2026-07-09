-- Previously an applicant could only edit their application/credentials
-- while status = 'draft' (or, for credentials, 'submitted') -- once a
-- reviewer touched it (moved to 'review'/'interview') or rejected it,
-- the applicant had no way to fix anything or resubmit. Broadening this
-- to any pre-decision status; 'approved' is deliberately excluded (the
-- applicant is already an instructor at that point, editing an old
-- application form is moot) and remains staff/service-role only for the
-- actual approve/reject transition either way (instructor-approval edge
-- function, not this policy).
drop policy "applicants edit their draft and submit once" on instructor_applications;
create policy "applicants edit their application before a final decision"
  on instructor_applications for update
  using (
    applicant_id = (select auth.uid())
    and status in ('draft', 'submitted', 'review', 'interview', 'rejected')
  )
  with check (
    applicant_id = (select auth.uid())
    and status in ('draft', 'submitted', 'review', 'interview', 'rejected')
  );

drop policy "applicants upload credentials while draft or submitted" on instructor_credentials;
create policy "applicants upload credentials before a final decision"
  on instructor_credentials for insert
  with check (
    exists (
      select 1 from instructor_applications a
      where a.id = instructor_credentials.application_id
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'submitted', 'review', 'interview', 'rejected')
    )
  );
