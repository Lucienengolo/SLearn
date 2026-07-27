import { supabase, ClassworkPost, ClassworkSubmission, ClassworkPostType } from './supabase';

export type ClassworkPostWithCourse = ClassworkPost & { course?: { title: string } };
export type ClassworkSubmissionWithStudent = ClassworkSubmission & { student?: { full_name: string } };

export type CreateClassworkPostInput = {
  courseId: string;
  instructorId: string;
  type: ClassworkPostType;
  title: string;
  body?: string | null;
  attachmentUrl?: string | null;
  dueAt?: string | null;
  maxPoints?: number | null;
};

// Powers both the instructor's Stream (all posts across the course_ids
// passed in) and a student's per-course Classwork view (a single course_id).
// Includes course.title so the aggregated instructor Stream can label which
// course each post belongs to.
export async function fetchClassworkPosts(courseIds: string[]): Promise<ClassworkPostWithCourse[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from('classwork_posts')
    .select('*, course:courses(title)')
    .in('course_id', courseIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassworkPostWithCourse[];
}

export async function createClassworkPost(input: CreateClassworkPostInput): Promise<void> {
  if (!input.title.trim()) {
    throw new Error('Please enter a title.');
  }
  const { error } = await supabase.from('classwork_posts').insert({
    course_id: input.courseId,
    instructor_id: input.instructorId,
    type: input.type,
    title: input.title.trim(),
    body: input.body?.trim() || null,
    attachment_url: input.attachmentUrl?.trim() || null,
    due_at: input.dueAt || null,
    max_points: input.type === 'assignment' ? (input.maxPoints ?? null) : null,
  });
  if (error) throw error;
}

export async function deleteClassworkPost(postId: string): Promise<void> {
  const { error } = await supabase.from('classwork_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function fetchSubmissionsForPost(postId: string): Promise<ClassworkSubmissionWithStudent[]> {
  const { data, error } = await supabase
    .from('classwork_submissions')
    .select('*, student:profiles!student_id(full_name)')
    .eq('post_id', postId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassworkSubmissionWithStudent[];
}

export async function fetchMySubmission(postId: string, studentId: string): Promise<ClassworkSubmission | null> {
  const { data, error } = await supabase
    .from('classwork_submissions')
    .select('*')
    .eq('post_id', postId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ClassworkSubmission | null;
}

// Upsert -- a student can resubmit before it's graded (unique(post_id,
// student_id) in 0039_classwork.sql makes this idempotent per student).
export async function submitClasswork(postId: string, studentId: string, content: string): Promise<void> {
  if (!content.trim()) {
    throw new Error('Please enter your submission before submitting.');
  }
  const { error } = await supabase
    .from('classwork_submissions')
    .upsert(
      { post_id: postId, student_id: studentId, content: content.trim(), submitted_at: new Date().toISOString() },
      { onConflict: 'post_id,student_id' }
    );
  if (error) throw error;
}

export async function gradeSubmission(submissionId: string, grade: number, feedback: string): Promise<void> {
  const { error } = await supabase
    .from('classwork_submissions')
    .update({ grade, feedback: feedback.trim() || null, graded_at: new Date().toISOString() })
    .eq('id', submissionId);
  if (error) throw error;
}
