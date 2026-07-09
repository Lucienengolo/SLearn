-- categories only ever had a SELECT policy (publicly readable) -- no
-- INSERT policy at all, so RLS defaulted to deny. CourseEditor's new
-- "add a custom category" field needs verified instructors to be able
-- to create one, at the same trust level already granted for creating
-- courses outright (0001_core_schema.sql's "verified instructors create
-- courses").
create policy "verified instructors create categories"
  on categories for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role = 'instructor' and p.verified = true
    )
  );
