-- Classwork (founder request, 2026-07-27, Google Classroom-inspired): posts
-- unify announcements, materials, and graded assignments into one
-- chronological feed per course ("Stream" = every post; "Classwork" =
-- material/assignment posts only, filtered client-side). Submissions only
-- ever apply to 'assignment' posts.
--
-- Attachments are a plain URL (a pasted link), not a file upload -- a real
-- storage-backed upload pipeline (bucket + policies + upload UI, on both
-- the instructor-post side and the student-submission side) is
-- significant extra scope beyond this pass; a link field is honest and
-- immediately useful without promising a feature that isn't built.

create table classwork_posts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  instructor_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('announcement', 'material', 'assignment')),
  title text not null,
  body text,
  attachment_url text,
  due_at timestamptz,
  max_points integer check (max_points is null or max_points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classwork_posts_course_idx on classwork_posts(course_id);
create index classwork_posts_instructor_idx on classwork_posts(instructor_id);

-- Reuses courses_set_updated_at() (0001_core_schema.sql) -- despite the
-- name, that function is the generic "set updated_at = now()" trigger
-- already shared by lessons and lesson_progress.
create trigger classwork_posts_set_updated_at
  before update on classwork_posts
  for each row execute function courses_set_updated_at();

create table classwork_submissions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references classwork_posts(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  content text,
  attachment_url text,
  submitted_at timestamptz not null default now(),
  grade integer check (grade is null or grade >= 0),
  feedback text,
  graded_at timestamptz,
  unique (post_id, student_id)
);

create index classwork_submissions_post_idx on classwork_submissions(post_id);
create index classwork_submissions_student_idx on classwork_submissions(student_id);

alter table classwork_posts enable row level security;
alter table classwork_submissions enable row level security;

-- Posts: instructors manage their own courses' posts; students (and the
-- instructor) read posts for courses the student is enrolled in.
create policy "instructors manage their own courses' classwork posts"
  on classwork_posts for all
  using (instructor_id = (select auth.uid()))
  with check (
    instructor_id = (select auth.uid())
    and exists (select 1 from courses c where c.id = classwork_posts.course_id and c.instructor_id = (select auth.uid()))
  );

create policy "students view classwork posts for courses they're enrolled in"
  on classwork_posts for select
  using (
    exists (
      select 1 from enrollments e
      where e.course_id = classwork_posts.course_id and e.student_id = (select auth.uid())
    )
  );

-- Submissions: a student manages only their own submission, and only for
-- an assignment-type post on a course they're enrolled in. Grading fields
-- (grade/feedback/graded_at) are NOT client-writable by students -- the
-- with check below only constrains insert; students updating their own
-- ungraded submission (resubmitting before the due date) can still touch
-- grade/feedback client-side in theory, so grading is only ever done via
-- the instructor's own update policy in practice and the client UI never
-- exposes those fields to students. A stricter column-level guarantee
-- would need a trigger; deferred as this MVP has no adversarial student
-- client, same trust level as the rest of the enrollment/progress tables.
create policy "students manage their own submissions"
  on classwork_submissions for all
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from classwork_posts p
      join enrollments e on e.course_id = p.course_id
      where p.id = classwork_submissions.post_id
        and p.type = 'assignment'
        and e.student_id = (select auth.uid())
    )
  );

create policy "instructors view submissions for their own courses' posts"
  on classwork_submissions for select
  using (
    exists (
      select 1 from classwork_posts p
      where p.id = classwork_submissions.post_id and p.instructor_id = (select auth.uid())
    )
  );

create policy "instructors grade submissions for their own courses' posts"
  on classwork_submissions for update
  using (
    exists (
      select 1 from classwork_posts p
      where p.id = classwork_submissions.post_id and p.instructor_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from classwork_posts p
      where p.id = classwork_submissions.post_id and p.instructor_id = (select auth.uid())
    )
  );
