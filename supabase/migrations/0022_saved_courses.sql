-- Save-for-later / wishlist: a student can bookmark a course without
-- enrolling. Same owner-scoped pattern as reviews/enrollments.
create table saved_courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index saved_courses_student_idx on saved_courses(student_id);
create index saved_courses_course_idx on saved_courses(course_id);

alter table saved_courses enable row level security;

create policy "students manage their own saved courses"
  on saved_courses for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
