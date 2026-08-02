-- Pre-beta security review, 2026-08-02: profiles' "publicly readable" RLS
-- policy (0001_core_schema.sql, using (true), meant to expose full_name/
-- role/verified/avatar_url for course/review/tutor-match attribution) has
-- no column restriction -- RLS filters rows, not columns. A plain
-- unauthenticated select=* against production returns email for every
-- user on the platform, confirmed live via curl.
--
-- email is genuinely needed in 3 legitimate relationships beyond "my own
-- row" (found by auditing every .email usage against a profiles-shaped
-- object across the client codebase): an instructor viewing their own
-- enrolled students' emails, a reviewer viewing an instructor
-- applicant's/course-owner's email during moderation, and the "Add
-- Student by email" lookup. Each gets its own security-definer RPC below
-- that independently re-verifies the relationship server-side (never
-- trusting the caller's input alone) -- same security definer + search_path
-- pattern already used today for notify_on_new_message().

-- 1. Close the direct leak for every role, including reading one's own
-- row via the generic table/embed path. The client's "my own profile"
-- display now uses the Supabase Auth session's own email (already
-- available via useAuth()'s `user` object) instead of profiles.email, so
-- this is safe -- no client code needs to select email from this table
-- directly anymore.
--
-- A column-level REVOKE alone is NOT enough here -- Supabase's default
-- setup already grants anon/authenticated a broad TABLE-level SELECT
-- (verified locally: `\z profiles` shows `anon=arwd/postgres`, i.e. every
-- column, not just an aggregate of column-level grants). A table-level
-- grant covering a column always wins over a narrower column-level
-- revoke of that same column, so the only way to actually restrict a
-- single column is to revoke the table-level grant entirely and replace
-- it with an explicit column list that simply omits `email`. This also
-- means any FUTURE column added to `profiles` is unexposed by default
-- (fails closed) unless someone deliberately re-grants it -- a genuinely
-- safer posture than the blanket grant this replaces.
-- Every column except email -- deliberately not re-designing exposure for
-- is_reviewer/updated_at/etc. beyond what this fix is actually for; those
-- were already just as exposed before this migration as they are after
-- it. Scoped to the one column that was the actual finding.
revoke select on profiles from anon, authenticated;
grant select (id, full_name, role, verified, is_reviewer, avatar_url, bio, totem, created_at, updated_at) on profiles to anon, authenticated;

-- 2. The public-safe projection, formalizing what course/review/tutor-
-- match attribution has always actually needed. Not required to keep
-- existing embeds working today (none of them select email), but locks
-- in the safe contract against a future regression (e.g. someone adding
-- a `select=*` somewhere and assuming it's safe).
create view public_profiles as
  select id, full_name, role, verified, is_reviewer, avatar_url, bio, totem, created_at, updated_at
  from profiles;

grant select on public_profiles to anon, authenticated;

-- 3. Instructor -> their own enrolled students. Covers both the
-- per-course (CourseStudents.tsx) and aggregated-across-courses
-- (instructorLearners.ts) cases with one function.
create or replace function get_my_students_emails(p_course_id uuid default null)
returns table(student_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select e.student_id, p.email
  from enrollments e
  join courses c on c.id = e.course_id
  join profiles p on p.id = e.student_id
  where c.instructor_id = auth.uid()
    and (p_course_id is null or e.course_id = p_course_id);
$$;

grant execute on function get_my_students_emails(uuid) to authenticated;

-- 4. Reviewer -> the instructor whose course is under moderation.
create or replace function get_course_instructor_email(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_email text;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true) then
    return null;
  end if;

  select p.email into v_email
  from courses c
  join profiles p on p.id = c.instructor_id
  where c.id = p_course_id;

  return v_email;
end;
$$;

grant execute on function get_course_instructor_email(uuid) to authenticated;

-- 5. Reviewer -> the applicant whose instructor application is under
-- moderation.
create or replace function get_application_applicant_email(p_application_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_email text;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true) then
    return null;
  end if;

  select p.email into v_email
  from instructor_applications a
  join profiles p on p.id = a.applicant_id
  where a.id = p_application_id;

  return v_email;
end;
$$;

grant execute on function get_application_applicant_email(uuid) to authenticated;

-- 6. "Add Student by email" lookup (lib/instructorEnrollment.ts). Never
-- returns the email itself -- just id/role, matching the existing
-- friendly-error UX ("no account found" / "not a student account").
-- Tightened to VERIFIED INSTRUCTORS ONLY, a real positive tightening --
-- the previous direct-table lookup had no relationship check at all
-- (any authenticated caller could probe "does this email exist"), even
-- though the downstream enrollments INSERT was already properly gated
-- (0037_instructor_manual_enrollment.sql).
create or replace function find_student_id_by_email(p_email text)
returns table(id uuid, role text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'instructor' and p.verified = true
  ) then
    return;
  end if;

  return query
    select p.id, p.role from profiles p where p.email = p_email;
end;
$$;

grant execute on function find_student_id_by_email(text) to authenticated;
