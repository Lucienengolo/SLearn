-- Category deletion (founder request, 2026-08-01, Batch 5 of the
-- beta-readiness roadmap: "add a clear option to add or delete a course
-- category"). No DELETE (or UPDATE) policy existed on `categories` at
-- all before this -- every delete attempt was RLS-denied for every role.
--
-- Scoped to verified instructors only (locked decision, tighter than the
-- current wide-open INSERT policy from 0041_parents_create_categories.sql,
-- since deleting is more consequential than creating -- it can affect
-- other people's published courses/tutor subjects, not just add a new
-- shared lookup value). Matches the ORIGINAL, more conservative
-- category-creation policy from 0028_instructor_create_categories.sql,
-- before parents were allowed to create ad-hoc ones for custom tutoring
-- subjects. There is no admin/moderator role anywhere in this app
-- (profiles.role is a hard check constraint: only 'student'/'instructor'),
-- so this is the tightest scoping available without a larger role-model
-- change.
--
-- Whether a category is actually SAFE to delete (not referenced by any
-- course/tutor_request/tutor_subject) is enforced at the app layer
-- (components/Dashboard/ManageCategoriesModal.tsx does an in-use check
-- before attempting the delete, and surfaces a friendly blocking message)
-- rather than solely relying on each table's own FK behavior, since that
-- behavior differs per table: courses.category_id is ON DELETE SET NULL
-- (safe, but would silently blank a course's category), tutor_requests.
-- category_id has no ON DELETE clause (defaults to RESTRICT -- blocks the
-- delete with a raw Postgres FK error), and tutor_subjects.category_id is
-- ON DELETE CASCADE (would silently delete a tutor's subject-matching
-- rows). The RLS policy below only answers "who," not "is it safe."
create policy "verified instructors delete categories"
  on categories for delete
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid())
        and p.role = 'instructor'
        and p.verified = true
    )
  );
