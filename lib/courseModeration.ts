import { supabase, Course } from './supabase';

export type CourseWithInstructor = Course & {
  instructor: { full_name: string; email: string } | null;
  category: { name: string } | null;
};

// Reviewer-only (profiles.is_reviewer = true; RLS backs this up
// regardless of what the client asks for -- see 0025_course_moderation.sql's
// "reviewers view all courses" policy).
export async function fetchPendingCourses(): Promise<CourseWithInstructor[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, instructor:profiles!instructor_id(full_name, email), category:categories(name)')
    .eq('is_published', true)
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CourseWithInstructor[];
}

export async function fetchDecidedCourses(): Promise<CourseWithInstructor[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, instructor:profiles!instructor_id(full_name, email), category:categories(name)')
    .in('moderation_status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(25);

  if (error) throw error;
  return (data ?? []) as CourseWithInstructor[];
}

// Direct table update rather than an edge function (unlike instructor
// applications): a course decision doesn't grant any elevated permission
// the way approving an instructor application does, it only toggles
// public visibility -- the courses_guard_moderation trigger
// (0025_course_moderation.sql) is what actually enforces that only a
// reviewer/service-role can move moderation_status at all, so this is
// safe as a plain RLS-backed update.
export async function decideCourse(
  courseId: string,
  decision: 'approved' | 'rejected',
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ moderation_status: decision, moderation_notes: notes ?? null })
    .eq('id', courseId);
  if (error) throw error;
}
