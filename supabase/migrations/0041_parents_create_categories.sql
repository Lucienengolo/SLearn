-- Founder feedback (2026-07-30): the tutor-request subject picker only
-- offers a fixed category list, with no way for a parent to specify a
-- subject that isn't there yet. Mirrors 0028_instructor_create_categories.sql's
-- "add a custom category" precedent, but for any authenticated user rather
-- than verified-instructors-only -- a parent creating a tutor request has no
-- verified/instructor trust level to check, and a new category row is a
-- low-risk, publicly-readable lookup value (same shape as the instructor
-- case), so this simply widens who may add one rather than introducing a
-- new trust boundary.
create policy "authenticated users create categories"
  on categories for insert
  to authenticated
  with check (true);
