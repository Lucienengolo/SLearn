import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'instructor';
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  category_id: string | null;
  thumbnail_url: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration_hours: number;
  price: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  content: string | null;
  video_url: string | null;
  order_index: number;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
};

export type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percentage: number;
};

export type LessonProgress = {
  id: string;
  student_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
  last_position_seconds: number;
  updated_at: string;
};

export type Quiz = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  passing_score: number;
  created_at: string;
};

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false';
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
};

export type QuizAttempt = {
  id: string;
  student_id: string;
  quiz_id: string;
  score: number;
  total_points: number;
  passed: boolean;
  answers: Record<string, string>;
  attempted_at: string;
};

export type Certificate = {
  id: string;
  student_id: string;
  course_id: string;
  issued_at: string;
  certificate_url: string | null;
};

export type Review = {
  id: string;
  student_id: string;
  course_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};
