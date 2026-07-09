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
  verified: boolean;
  is_reviewer: boolean;
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

export type CourseModerationStatus = 'pending' | 'approved' | 'rejected';

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
  moderation_status: CourseModerationStatus;
  moderation_notes: string | null;
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
  video_file_url: string | null;
  pdf_notes_url: string | null;
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
  lesson_id: string | null;
  course_id: string | null;
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

// Backed by the course_stats / student_course_progress views
// (0020/0021_*.sql) -- aggregates computed in the DB instead of N+1
// per-row client queries.
export type CourseStats = {
  course_id: string;
  lesson_count: number;
  enrollment_count: number;
  review_count: number;
  average_rating: number;
};

export type StudentCourseProgress = {
  student_id: string;
  course_id: string;
  completed_lesson_count: number;
};

export type SavedCourse = {
  id: string;
  student_id: string;
  course_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type InstructorApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'review'
  | 'interview'
  | 'approved'
  | 'rejected';

export type BackgroundCheckStatus = 'not_started' | 'in_progress' | 'clear' | 'flagged';

export type InstructorApplication = {
  id: string;
  applicant_id: string;
  status: InstructorApplicationStatus;
  full_name: string | null;
  address: string | null;
  headline: string | null;
  bio: string | null;
  qualifications: string | null;
  years_experience: number | null;
  areas_of_expertise: string[] | null;
  proposed_course_title: string | null;
  proposed_course_description: string | null;
  proposed_course_category_id: string | null;
  background_check_status: BackgroundCheckStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InstructorCredentialType =
  | 'government_id'
  | 'degree'
  | 'certificate'
  | 'cv'
  | 'portfolio'
  | 'sample_lesson'
  | 'selfie'
  | 'other';

export type InstructorCredential = {
  id: string;
  application_id: string;
  credential_type: InstructorCredentialType;
  storage_path: string;
  file_name: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_extracted_name: string | null;
  verification_extracted_address: string | null;
  verification_name_match: boolean | null;
  verification_address_match: boolean | null;
  verification_notes: string | null;
  verification_checked_at: string | null;
  created_at: string;
};

export type InterviewSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  panelist_id: string | null;
  is_booked: boolean;
  created_at: string;
};

export type InterviewOutcome = 'pending' | 'pass' | 'fail' | 'no_show' | 'rescheduled';

export type Interview = {
  id: string;
  application_id: string;
  slot_id: string | null;
  scheduled_at: string | null;
  panelist_id: string | null;
  outcome: InterviewOutcome;
  notes: string | null;
  cal_booking_uid: string | null;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
};
