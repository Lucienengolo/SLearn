-- Core S@Learn schema: profiles, catalog, progress, quizzes, certificates, reviews.
-- This must run before 0002_instructor_verification.sql, which adds a
-- foreign key from instructor_applications to categories.
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'instructor')),
  verified boolean not null default false,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  instructor_id uuid not null references profiles(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  thumbnail_url text,
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  duration_hours numeric not null default 0,
  price numeric not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_instructor_idx on courses(instructor_id);
create index courses_category_idx on courses(category_id);
create index courses_published_idx on courses(is_published);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  description text,
  content text,
  video_url text,
  video_file_url text,
  pdf_notes_url text,
  order_index integer not null default 0,
  duration_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_course_idx on lessons(course_id);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  progress_percentage integer not null default 0,
  unique (student_id, course_id)
);

create index enrollments_student_idx on enrollments(student_id);
create index enrollments_course_idx on enrollments(course_id);

create table lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  last_position_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index lesson_progress_student_idx on lesson_progress(student_id);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  description text,
  passing_score integer not null default 70,
  created_at timestamptz not null default now()
);

create index quizzes_lesson_idx on quizzes(lesson_id);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false')),
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  points integer not null default 1,
  order_index integer not null default 0
);

create index quiz_questions_quiz_idx on quiz_questions(quiz_id);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  score integer not null,
  total_points integer not null,
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now()
);

create index quiz_attempts_student_idx on quiz_attempts(student_id);
create index quiz_attempts_quiz_idx on quiz_attempts(quiz_id);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  certificate_url text,
  unique (student_id, course_id)
);

create index certificates_student_idx on certificates(student_id);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index reviews_course_idx on reviews(course_id);

-- Keep profiles.updated_at honest, and stop clients from self-granting the
-- instructor role or verified flag directly (the only legitimate path is the
-- instructor-approval backend, which uses the service role and bypasses RLS
-- and this trigger). Without this, a client could bypass the whole
-- verification pipeline with a single `update profiles set role = 'instructor'`.
create or replace function profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  if new.role <> old.role or new.verified <> old.verified then
    if auth.role() <> 'service_role' then
      new.role = old.role;
      new.verified = old.verified;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function profiles_set_updated_at();

create or replace function courses_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at
  before update on courses
  for each row execute function courses_set_updated_at();

create trigger lessons_set_updated_at
  before update on lessons
  for each row execute function courses_set_updated_at();

create trigger lesson_progress_set_updated_at
  before update on lesson_progress
  for each row execute function courses_set_updated_at();

-- RLS -------------------------------------------------------------------

alter table profiles enable row level security;
alter table categories enable row level security;
alter table courses enable row level security;
alter table lessons enable row level security;
alter table enrollments enable row level security;
alter table lesson_progress enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table certificates enable row level security;
alter table reviews enable row level security;

-- Profiles are a semi-public directory (instructor attribution on course
-- cards, review authorship, guest-mode home page stats) so SELECT is public.
-- role/verified can't be changed by the row owner (see trigger above).
create policy "profiles are publicly readable"
  on profiles for select
  using (true);

create policy "users create their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "users update their own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "categories are publicly readable"
  on categories for select
  using (true);

create policy "courses visible if published or owned by the instructor"
  on courses for select
  using (is_published = true or instructor_id = auth.uid());

create policy "verified instructors create courses"
  on courses for insert
  with check (
    instructor_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'instructor' and p.verified = true
    )
  );

create policy "instructors manage their own courses"
  on courses for update
  using (instructor_id = auth.uid());

create policy "instructors delete their own courses"
  on courses for delete
  using (instructor_id = auth.uid());

-- Lesson content for free, published courses is open (guest mode); paid
-- courses require enrollment or being the owning instructor.
create policy "lessons visible for free courses, enrollees, or the instructor"
  on lessons for select
  using (
    exists (
      select 1 from courses c
      where c.id = lessons.course_id
        and c.is_published = true
        and (
          c.price = 0
          or c.instructor_id = auth.uid()
          or exists (
            select 1 from enrollments e
            where e.course_id = c.id and e.student_id = auth.uid()
          )
        )
    )
  );

create policy "instructors manage lessons on their own courses"
  on lessons for all
  using (
    exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = auth.uid())
  )
  with check (
    exists (select 1 from courses c where c.id = lessons.course_id and c.instructor_id = auth.uid())
  );

create policy "students view their own enrollments"
  on enrollments for select
  using (
    student_id = auth.uid()
    or exists (select 1 from courses c where c.id = enrollments.course_id and c.instructor_id = auth.uid())
  );

create policy "students enroll themselves"
  on enrollments for insert
  with check (student_id = auth.uid());

create policy "students update their own enrollment progress"
  on enrollments for update
  using (student_id = auth.uid());

create policy "students manage their own lesson progress"
  on lesson_progress for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

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
          or c.instructor_id = auth.uid()
          or exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = auth.uid())
        )
    )
  );

create policy "instructors manage quizzes on their own courses"
  on quizzes for all
  using (
    exists (
      select 1 from lessons l join courses c on c.id = l.course_id
      where l.id = quizzes.lesson_id and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lessons l join courses c on c.id = l.course_id
      where l.id = quizzes.lesson_id and c.instructor_id = auth.uid()
    )
  );

-- NOTE: quiz_questions.correct_answer is readable by anyone who can see the
-- quiz, which is the same trust model the client already uses (QuizViewer
-- grades locally before submitting). That's a pre-existing integrity gap —
-- a determined student can read correct answers from the network tab. Closing
-- it needs server-side grading (an edge function) and is tracked separately;
-- RLS alone can't hide one column from an otherwise-authorized row.
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
          or c.instructor_id = auth.uid()
          or exists (select 1 from enrollments e where e.course_id = c.id and e.student_id = auth.uid())
        )
    )
  );

create policy "instructors manage quiz questions on their own courses"
  on quiz_questions for all
  using (
    exists (
      select 1 from quizzes q join lessons l on l.id = q.lesson_id join courses c on c.id = l.course_id
      where q.id = quiz_questions.quiz_id and c.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from quizzes q join lessons l on l.id = q.lesson_id join courses c on c.id = l.course_id
      where q.id = quiz_questions.quiz_id and c.instructor_id = auth.uid()
    )
  );

create policy "students manage their own quiz attempts"
  on quiz_attempts for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "certificates visible to their student or the course instructor"
  on certificates for select
  using (
    student_id = auth.uid()
    or exists (select 1 from courses c where c.id = certificates.course_id and c.instructor_id = auth.uid())
  );

create policy "students issue their own certificates"
  on certificates for insert
  with check (student_id = auth.uid());

create policy "reviews are publicly readable"
  on reviews for select
  using (true);

create policy "enrolled students write their own review"
  on reviews for insert
  with check (
    student_id = auth.uid()
    and exists (select 1 from enrollments e where e.course_id = reviews.course_id and e.student_id = auth.uid())
  );

create policy "students edit their own review"
  on reviews for update
  using (student_id = auth.uid());

create policy "students delete their own review"
  on reviews for delete
  using (student_id = auth.uid());

-- Public storage for lesson media (lib/storage.ts uploads here and serves
-- via getPublicUrl). Bucket is public for read; writes are instructor-owned.
insert into storage.buckets (id, name, public)
values ('lesson-videos', 'lesson-videos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lesson-pdfs', 'lesson-pdfs', true)
on conflict (id) do nothing;

create policy "instructors upload videos for their own courses"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = auth.uid()
    )
  );

create policy "instructors delete videos for their own courses"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = auth.uid()
    )
  );

create policy "instructors upload pdfs for their own courses"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'lesson-pdfs'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = auth.uid()
    )
  );

create policy "instructors delete pdfs for their own courses"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'lesson-pdfs'
    and exists (
      select 1 from courses c
      where c.id::text = (storage.foldername(name))[1] and c.instructor_id = auth.uid()
    )
  );

-- Seed data ---------------------------------------------------------------

insert into categories (name, description) values
  ('Web Development', 'Frontend, backend, and full-stack web courses'),
  ('Data Science', 'Data analysis, machine learning, and statistics'),
  ('Business', 'Entrepreneurship, management, and finance'),
  ('Design', 'UI/UX, graphic design, and product design'),
  ('Marketing', 'Digital marketing, SEO, and social media'),
  ('Personal Development', 'Productivity, leadership, and soft skills')
on conflict (name) do nothing;

-- Sample courses are intentionally not seeded here: courses.instructor_id
-- is a foreign key into profiles/auth.users, and a migration can't create a
-- real authenticated user. Once at least one verified instructor account
-- exists, insert sample courses referencing that profile's id, e.g.:
--
--   insert into courses (title, description, instructor_id, category_id, is_published)
--   select 'Intro to SQL', 'Learn SQL from scratch', p.id, c.id, true
--   from profiles p, categories c
--   where p.role = 'instructor' and c.name = 'Data Science'
--   limit 1;
