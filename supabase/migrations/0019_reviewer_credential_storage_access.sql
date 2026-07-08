-- Reviewers can already see instructor_credentials *rows* (0007's
-- "applicants and reviewers view credentials" policy), but the actual
-- uploaded files live in the private instructor-credentials storage
-- bucket, whose only SELECT policy ("applicants view their own credential
-- files") scopes to the uploading applicant's own folder. A reviewer
-- opening the review queue could see that a government ID was uploaded
-- but not actually view the image -- storage RLS is separate from table
-- RLS and this bucket had no reviewer-facing policy at all.
create policy "reviewers view all credential files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'instructor-credentials'
    and exists (
      select 1 from profiles p where p.id = (select auth.uid()) and p.is_reviewer = true
    )
  );
