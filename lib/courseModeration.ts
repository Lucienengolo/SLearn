import { supabase, Course } from './supabase';

export type CourseWithInstructor = Course & {
  instructor: { full_name: string; email: string } | null;
  category: { name: string } | null;
};

// email is no longer selectable via the embedded profiles join (2026-08-02
// security fix, see 0046_restrict_profile_email.sql) -- fetched separately
// per course via a security-definer RPC that independently re-verifies
// the caller is actually a reviewer, then merged in. One RPC call per
// course rather than a batch call: moderation queues are small (a
// handful of pending/recent items at a time), so this stays simple
// rather than adding a second batch-shaped RPC for marginal benefit.
async function attachInstructorEmails(courses: CourseWithInstructor[]): Promise<CourseWithInstructor[]> {
  const emails = await Promise.all(
    courses.map((c) => supabase.rpc('get_course_instructor_email', { p_course_id: c.id }))
  );
  return courses.map((c, i) => ({
    ...c,
    instructor: c.instructor ? { ...c.instructor, email: emails[i].data ?? '' } : null,
  }));
}

// Reviewer-only (profiles.is_reviewer = true; RLS backs this up
// regardless of what the client asks for -- see 0025_course_moderation.sql's
// "reviewers view all courses" policy).
export async function fetchPendingCourses(): Promise<CourseWithInstructor[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, instructor:profiles!instructor_id(full_name), category:categories(name)')
    .eq('is_published', true)
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return attachInstructorEmails((data ?? []) as CourseWithInstructor[]);
}

export async function fetchDecidedCourses(): Promise<CourseWithInstructor[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, instructor:profiles!instructor_id(full_name), category:categories(name)')
    .in('moderation_status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(25);

  if (error) throw error;
  return attachInstructorEmails((data ?? []) as CourseWithInstructor[]);
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
