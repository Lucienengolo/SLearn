/*
  # Online Learning Platform Schema

  ## Overview
  This migration creates a comprehensive online learning platform with courses, lessons, 
  quizzes, enrollments, progress tracking, and certificates.

  ## 1. New Tables
  
  ### `profiles`
  - `id` (uuid, FK to auth.users) - User profile ID
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'student' or 'instructor'
  - `avatar_url` (text) - Profile picture URL
  - `bio` (text) - User biography
  - `created_at` (timestamptz) - Profile creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `categories`
  - `id` (uuid, PK) - Category ID
  - `name` (text) - Category name
  - `description` (text) - Category description
  - `created_at` (timestamptz) - Creation timestamp

  ### `courses`
  - `id` (uuid, PK) - Course ID
  - `title` (text) - Course title
  - `description` (text) - Course description
  - `instructor_id` (uuid, FK to profiles) - Course instructor
  - `category_id` (uuid, FK to categories) - Course category
  - `thumbnail_url` (text) - Course thumbnail image
  - `level` (text) - Difficulty level: 'beginner', 'intermediate', 'advanced'
  - `duration_hours` (integer) - Estimated course duration
  - `price` (decimal) - Course price (0 for free)
  - `is_published` (boolean) - Publication status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `lessons`
  - `id` (uuid, PK) - Lesson ID
  - `course_id` (uuid, FK to courses) - Parent course
  - `title` (text) - Lesson title
  - `description` (text) - Lesson description
  - `content` (text) - Lesson content/text
  - `video_url` (text) - Video URL
  - `order_index` (integer) - Lesson order in course
  - `duration_minutes` (integer) - Lesson duration
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `enrollments`
  - `id` (uuid, PK) - Enrollment ID
  - `student_id` (uuid, FK to profiles) - Enrolled student
  - `course_id` (uuid, FK to courses) - Enrolled course
  - `enrolled_at` (timestamptz) - Enrollment timestamp
  - `completed_at` (timestamptz) - Completion timestamp
  - `progress_percentage` (integer) - Course progress (0-100)
  - Unique constraint on (student_id, course_id)

  ### `lesson_progress`
  - `id` (uuid, PK) - Progress ID
  - `student_id` (uuid, FK to profiles) - Student
  - `lesson_id` (uuid, FK to lessons) - Lesson
  - `completed` (boolean) - Completion status
  - `completed_at` (timestamptz) - Completion timestamp
  - `last_position_seconds` (integer) - Video playback position
  - Unique constraint on (student_id, lesson_id)

  ### `quizzes`
  - `id` (uuid, PK) - Quiz ID
  - `lesson_id` (uuid, FK to lessons) - Associated lesson
  - `title` (text) - Quiz title
  - `description` (text) - Quiz description
  - `passing_score` (integer) - Minimum passing score percentage
  - `created_at` (timestamptz) - Creation timestamp

  ### `quiz_questions`
  - `id` (uuid, PK) - Question ID
  - `quiz_id` (uuid, FK to quizzes) - Parent quiz
  - `question_text` (text) - Question content
  - `question_type` (text) - Type: 'multiple_choice', 'true_false'
  - `options` (jsonb) - Answer options array
  - `correct_answer` (text) - Correct answer
  - `points` (integer) - Points for correct answer
  - `order_index` (integer) - Question order

  ### `quiz_attempts`
  - `id` (uuid, PK) - Attempt ID
  - `student_id` (uuid, FK to profiles) - Student
  - `quiz_id` (uuid, FK to quizzes) - Quiz
  - `score` (integer) - Score achieved
  - `total_points` (integer) - Total possible points
  - `passed` (boolean) - Pass/fail status
  - `answers` (jsonb) - Student's answers
  - `attempted_at` (timestamptz) - Attempt timestamp

  ### `certificates`
  - `id` (uuid, PK) - Certificate ID
  - `student_id` (uuid, FK to profiles) - Student
  - `course_id` (uuid, FK to courses) - Completed course
  - `issued_at` (timestamptz) - Issue date
  - `certificate_url` (text) - Certificate image/PDF URL
  - Unique constraint on (student_id, course_id)

  ### `reviews`
  - `id` (uuid, PK) - Review ID
  - `student_id` (uuid, FK to profiles) - Reviewer
  - `course_id` (uuid, FK to courses) - Reviewed course
  - `rating` (integer) - Rating (1-5)
  - `comment` (text) - Review text
  - `created_at` (timestamptz) - Creation timestamp
  - Unique constraint on (student_id, course_id)

  ## 2. Security
  - Enable RLS on all tables
  - Profiles: Users can read all profiles, update own profile
  - Categories: Public read, instructors can create
  - Courses: Public read published courses, instructors manage own courses
  - Lessons: Access based on enrollment or instructor ownership
  - Enrollments: Students manage own enrollments
  - Progress: Students manage own progress
  - Quizzes: Access based on enrollment
  - Certificates: Students view own certificates
  - Reviews: Students can create/update own reviews

  ## 3. Indexes
  - Foreign key indexes for performance
  - Course search indexes
  - Enrollment lookups
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text DEFAULT 'student' CHECK (role IN ('student', 'instructor')),
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  instructor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  thumbnail_url text,
  level text DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  duration_hours integer DEFAULT 0,
  price decimal(10,2) DEFAULT 0,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  video_url text,
  order_index integer NOT NULL,
  duration_minutes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  UNIQUE(student_id, course_id)
);

-- Create lesson_progress table
CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  last_position_seconds integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  passing_score integer DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  created_at timestamptz DEFAULT now()
);

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  question_type text DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false')),
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  points integer DEFAULT 1,
  order_index integer NOT NULL
);

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  score integer NOT NULL,
  total_points integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

-- Create certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  issued_at timestamptz DEFAULT now(),
  certificate_url text,
  UNIQUE(student_id, course_id)
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Categories policies
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Instructors can create categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'instructor'
    )
  );

-- Courses policies
CREATE POLICY "Published courses are viewable by everyone"
  ON courses FOR SELECT
  TO authenticated
  USING (is_published = true OR instructor_id = auth.uid());

CREATE POLICY "Instructors can create courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = instructor_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'instructor'
    )
  );

CREATE POLICY "Instructors can update own courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can delete own courses"
  ON courses FOR DELETE
  TO authenticated
  USING (instructor_id = auth.uid());

-- Lessons policies
CREATE POLICY "Lessons viewable by enrolled students or instructor"
  ON lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id
      AND (
        courses.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM enrollments
          WHERE enrollments.course_id = courses.id
          AND enrollments.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Instructors can create lessons for own courses"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update own course lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete own course lessons"
  ON lessons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = lessons.course_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Enrollments policies
CREATE POLICY "Students can view own enrollments"
  ON enrollments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can enroll in courses"
  ON enrollments FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own enrollment progress"
  ON enrollments FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Lesson progress policies
CREATE POLICY "Students can view own progress"
  ON lesson_progress FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create own progress"
  ON lesson_progress FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own progress"
  ON lesson_progress FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Quizzes policies
CREATE POLICY "Quizzes viewable by enrolled students or instructor"
  ON quizzes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND (
        courses.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM enrollments
          WHERE enrollments.course_id = courses.id
          AND enrollments.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Instructors can create quizzes"
  ON quizzes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update own quizzes"
  ON quizzes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Quiz questions policies
CREATE POLICY "Questions viewable by enrolled students or instructor"
  ON quiz_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN courses ON courses.id = lessons.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
      AND (
        courses.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM enrollments
          WHERE enrollments.course_id = courses.id
          AND enrollments.student_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Instructors can create quiz questions"
  ON quiz_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN courses ON courses.id = lessons.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update own quiz questions"
  ON quiz_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN courses ON courses.id = lessons.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
      AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN courses ON courses.id = lessons.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Quiz attempts policies
CREATE POLICY "Students can view own quiz attempts"
  ON quiz_attempts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create quiz attempts"
  ON quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Certificates policies
CREATE POLICY "Students can view own certificates"
  ON certificates FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "System can create certificates"
  ON certificates FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Reviews policies
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Students can create reviews for enrolled courses"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.student_id = auth.uid()
      AND enrollments.course_id = reviews.course_id
    )
  );

CREATE POLICY "Students can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);

-- Insert some sample categories
INSERT INTO categories (name, description) VALUES
  ('Web Development', 'Learn modern web development technologies'),
  ('Data Science', 'Master data analysis and machine learning'),
  ('Mobile Development', 'Build native and cross-platform mobile apps'),
  ('DevOps', 'Learn deployment, CI/CD, and cloud infrastructure'),
  ('Design', 'UI/UX design and creative tools')
ON CONFLICT (name) DO NOTHING;