-- Hardening pass driven by a real `supabase db advisors --linked` run against
-- the deployed project (hzcdcjtngxhxbzeirbmz), not a hypothetical review.
-- Four categories of finding, all fixed here:
--
-- 1. SECURITY: `handle_new_user()` (the on_auth_user_created trigger, SECURITY
--    DEFINER) had no EXECUTE restriction, so `anon`/`authenticated` could call
--    it directly via `/rest/v1/rpc/handle_new_user` with elevated privileges
--    instead of only via the trigger. Revoking EXECUTE doesn't affect the
--    trigger itself — trigger functions are invoked by the trigger manager,
--    not via the calling role's own EXECUTE grant.
-- 2. SECURITY: 5 trigger functions had a mutable search_path (none declared
--    one), which is a search_path-hijacking vector for SECURITY DEFINER-style
--    attacks. Pinning it doesn't change behavior — these only ever reference
--    already-schema-qualified or built-in (pg_catalog) objects.
-- 3. PERFORMANCE: every RLS policy in the schema (public + storage.objects)
--    called `auth.uid()` unwrapped in USING/WITH CHECK, which Postgres
--    re-evaluates per row instead of once per query (the classic Supabase RLS
--    initplan issue). Wrapped as `(select auth.uid())` throughout.
-- 4. PERFORMANCE: 8 foreign-key columns had no covering index (slow joins/
--    cascades at scale); added. Also merged 3 pairs of redundant permissive
--    SELECT policies (applicant-view + reviewer-view-all) into one policy
--    each, so Postgres doesn't OR-evaluate two separate policies per query.
--
-- Deliberately NOT touched: pg_net's extension registration shows as
-- "public" in pg_extension (flagged by the advisor as `extension_in_public`),
-- but pg_net is not relocatable and its actual functions already live in
-- their own `net` schema (confirmed: net.http_post, not public.http_post) —
-- there's no real public-schema pollution to fix, and dropping+recreating a
-- non-relocatable extension on a live project is a real risk for a cosmetic
-- finding. Also not touched: the lessons/quizzes/quiz_questions "instructor
-- manages (ALL)" + "visibility (SELECT)" policy pairs, which the advisor
-- flags the same way as the 3 merged above — fixing those means splitting
-- each ALL policy into separate INSERT/UPDATE/DELETE policies so a merged
-- SELECT policy doesn't have to duplicate ALL's condition, which is 3x the
-- surface area for the same class of fix. Left as a known, low-priority item.

-- 1. Lock down handle_new_user() to trigger-only invocation -----------------
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- 2. Pin search_path on trigger functions ------------------------------------
alter function public.profiles_set_updated_at() set search_path = public, pg_temp;
alter function public.courses_set_updated_at() set search_path = public, pg_temp;
alter function public.instructor_apps_set_updated_at() set search_path = public, pg_temp;
alter function public.notify_application_submitted() set search_path = public, pg_temp;
alter function public.notify_interview_scheduled() set search_path = public, pg_temp;

-- 3. ai_tutor_requests: grant didn't match the "service role is the only
--    writer" design intent stated in 0006 — RLS already blocked client
--    inserts (no INSERT policy exists), but the GRANT itself was broader
--    than intended. Tighten it so both layers agree.
revoke insert on ai_tutor_requests from anon, authenticated;

-- 4. RLS: wrap auth.uid() as (select auth.uid()) everywhere, and merge the
--    3 applicant/reviewer SELECT policy pairs -------------------------------

-- profiles
drop policy "users create their own profile" on profiles;
create policy "users create their own profile"
  on profiles for insert
  with check ((select auth.uid()) = id);

drop policy "users update their own profile" on profiles;
create policy "users update their own profile"
  on profiles for update
  using ((select auth.uid()) = id);

-- courses
drop policy "courses visible if published or owned by the instructor" on courses;
create policy "courses visible if published or owned by the instructor"
  on courses for select
  using (is_published = true or instructor_id = (select auth.uid()));

drop policy "verified instructors create courses" on courses;
create policy "verified instructors create courses"
  on courses for insert
  with check (
    instructor_id = (select auth.uid())
    and exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role = 'instructor' and p.verified = true
    )
  );

drop policy "instructors manage their own courses" on courses;
create policy "instructors manage their own courses"
  on courses for update
  using (instructor_id = (select auth.uid()));

drop policy "instructors delete their own courses" on courses;
create policy "instructors delete their own courses"
  on courses for delete
  using (instructor_id = (select auth.uid()));

-- lessons
drop policy "lessons visible for free courses, enrollees, or the instructor" on lessons;
create policy "lessons visible for free courses, enrollees, or the instructor"
  on lessons for select
  using (
    exists (
      select 1 from courses c
      where c.id = lessons.course_id
        and c.is_published = true
        and (
          c.price = 0
          or c.instructor_id = (select auth.uid())
          or exists (
            select 1 from enrollments e
            where e.course_id = c.id and e.student_id = (select auth.uid())
          )
        )
    )
  );

drop policy "instructors manage lessons on their own courses" on lessons;
create policy "instructors manage lessons on their own courses"
  on lessons for all
  using (
    exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = (select auth.uid()))
  );

-- enrollments
drop policy "students view their own enrollments" on enrollments;
create policy "students view their own enrollments"
  on enrollments for select
  using (
    student_id = (select auth.uid())
    or exists (select 1 from courses c where c.id = enrollments.course_id and c.instructor_id = (select auth.uid()))
  );

drop policy "students enroll themselves" on enrollments;
create policy "students enroll themselves"
  on enrollments for insert
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'student')
  );

drop policy "students update their own enrollment progress" on enrollments;
create policy "students update their own enrollment progress"
  on enrollments for update
  using (student_id = (select auth.uid()));

-- lesson_progress
drop policy "students manage their own lesson progress" on lesson_progress;
create policy "students manage their own lesson progress"
  on lesson_progress for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- quizzes
drop policy "quizzes follow lesson visibility" on quizzes;
create policy "quizzes follow lesson visibility"
  on quizzes for select
  using (
    exists (
      select 1 from lessons l
      join courses c on c.id = l.course_id
      where l.id = quizzes.lesson_id
        and c.is_published = true
        and (
          c.price = 0
          or c.instructor_id = (select auth.uid())
          or exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = (select auth.uid()))
        )
    )
  );

drop policy "instructors manage quizzes on their own courses" on quizzes;
create policy "instructors manage quizzes on their own courses"
  on quizzes for all
  using (
    exists (
      select 1 from lessons l join courses c on c.id = l.course_id
      where l.id = quizzes.lesson_id and c.instructor_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from lessons l join courses c on c.id = l.course_id
      where l.id = quizzes.lesson_id and c.instructor_id = (select auth.uid())
    )
  );

-- quiz_questions
drop policy "quiz questions follow quiz visibility" on quiz_questions;
create policy "quiz questions follow quiz visibility"
  on quiz_questions for select
  using (
    exists (
      select 1 from quizzes q
      join lessons l on l.id = q.lesson_id
      join courses c on c.id = l.course_id
      where q.id = quiz_questions.quiz_id
        and c.is_published = true
        and (
          c.price = 0
          or c.instructor_id = (select auth.uid())
          or exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = (select auth.uid()))
        )
    )
  );

drop policy "instructors manage quiz questions on their own courses" on quiz_questions;
create policy "instructors manage quiz questions on their own courses"
  on quiz_questions for all
  using (
    exists (
      select 1 from quizzes q join lessons l on l.id = q.lesson_id join courses c on c.id = l.course_id
      where q.id = quiz_questions.quiz_id and c.instructor_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from quizzes q join lessons l on l.id = q.lesson_id join courses c on c.id = l.course_id
      where q.id = quiz_questions.quiz_id and c.instructor_id = (select auth.uid())
    )
  );

-- quiz_attempts
drop policy "students manage their own quiz attempts" on quiz_attempts;
create policy "students manage their own quiz attempts"
  on quiz_attempts for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- certificates
drop policy "certificates visible to their student or the course instructor" on certificates;
create policy "certificates visible to their student or the course instructor"
  on certificates for select
  using (
    student_id = (select auth.uid())
    or exists (select 1 from courses c where c.id = certificates.course_id and c.instructor_id = (select auth.uid()))
  );

drop policy "students issue their own certificates" on certificates;
create policy "students issue their own certificates"
  on certificates for insert
  with check (student_id = (select auth.uid()));

-- reviews
drop policy "enrolled students write their own review" on reviews;
create policy "enrolled students write their own review"
  on reviews for insert
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from enrollments e where e.course_id = reviews.course_id and e.student_id = (select auth.uid()))
  );

drop policy "students edit their own review" on reviews;
create policy "students edit their own review"
  on reviews for update
  using (student_id = (select auth.uid()));

drop policy "students delete their own review" on reviews;
create policy "students delete their own review"
  on reviews for delete
  using (student_id = (select auth.uid()));

-- instructor_applications: wrap + merge the applicant/reviewer SELECT pair
drop policy "applicants view their own application" on instructor_applications;
drop policy "reviewers view all applications" on instructor_applications;
create policy "applicants and reviewers view applications"
  on instructor_applications for select
  using (
    applicant_id = (select auth.uid())
    or exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_reviewer = true)
  );

drop policy "applicants create their own draft application" on instructor_applications;
create policy "applicants create their own draft application"
  on instructor_applications for insert
  with check (applicant_id = (select auth.uid()) and status = 'draft');

drop policy "applicants edit their draft and submit once" on instructor_applications;
create policy "applicants edit their draft and submit once"
  on instructor_applications for update
  using (applicant_id = (select auth.uid()) and status = 'draft')
  with check (applicant_id = (select auth.uid()) and status in ('draft', 'submitted'));

-- instructor_credentials: wrap + merge
drop policy "applicants view their own credentials" on instructor_credentials;
drop policy "reviewers view all credentials" on instructor_credentials;
create policy "applicants and reviewers view credentials"
  on instructor_credentials for select
  using (
    exists (
      select 1 from instructor_applications a
      where a.id = instructor_credentials.application_id and a.applicant_id = (select auth.uid())
    )
    or exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_reviewer = true)
  );

drop policy "applicants upload credentials while draft or submitted" on instructor_credentials;
create policy "applicants upload credentials while draft or submitted"
  on instructor_credentials for insert
  with check (
    exists (
      select 1 from instructor_applications a
      where a.id = instructor_credentials.application_id
        and a.applicant_id = (select auth.uid())
        and a.status in ('draft', 'submitted')
    )
  );

-- interviews: wrap + merge
drop policy "applicants view their own interview" on interviews;
drop policy "reviewers view all interviews" on interviews;
create policy "applicants and reviewers view interviews"
  on interviews for select
  using (
    exists (
      select 1 from instructor_applications a
      where a.id = interviews.application_id and a.applicant_id = (select auth.uid())
    )
    or exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_reviewer = true)
  );

drop policy "applicants schedule their own interview once submitted" on interviews;
create policy "applicants schedule their own interview once submitted"
  on interviews for insert
  with check (
    exists (
      select 1 from instructor_applications a
      where a.id = interviews.application_id
        and a.applicant_id = (select auth.uid())
        and a.status = 'submitted'
    )
  );

-- ai_tutor_requests
drop policy "users view their own tutor usage" on ai_tutor_requests;
create policy "users view their own tutor usage"
  on ai_tutor_requests for select
  using (user_id = (select auth.uid()));

-- storage.objects (not flagged by the advisor, which appears scoped to
-- `public` — but the same per-row-reevaluation cost applies here too)
drop policy "instructors upload videos for their own courses" on storage.objects;
create policy "instructors upload videos for their own courses"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = (select auth.uid())
    )
  );

drop policy "instructors delete videos for their own courses" on storage.objects;
create policy "instructors delete videos for their own courses"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = (select auth.uid())
    )
  );

drop policy "instructors upload pdfs for their own courses" on storage.objects;
create policy "instructors upload pdfs for their own courses"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lesson-pdfs'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = (select auth.uid())
    )
  );

drop policy "instructors delete pdfs for their own courses" on storage.objects;
create policy "instructors delete pdfs for their own courses"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lesson-pdfs'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = (select auth.uid())
    )
  );

drop policy "applicants upload to their own credential folder" on storage.objects;
create policy "applicants upload to their own credential folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'instructor-credentials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy "applicants view their own credential files" on storage.objects;
create policy "applicants view their own credential files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'instructor-credentials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 5. Missing foreign-key covering indexes ------------------------------------
create index if not exists ai_tutor_requests_lesson_idx on ai_tutor_requests(lesson_id);
create index if not exists certificates_course_idx on certificates(course_id);
create index if not exists instructor_applications_category_idx on instructor_applications(proposed_course_category_id);
create index if not exists instructor_credentials_verified_by_idx on instructor_credentials(verified_by);
create index if not exists interview_slots_panelist_idx on interview_slots(panelist_id);
create index if not exists interviews_panelist_idx on interviews(panelist_id);
create index if not exists interviews_slot_idx on interviews(slot_id);
create index if not exists lesson_progress_lesson_idx on lesson_progress(lesson_id);
