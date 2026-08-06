import { supabase } from './supabase';

// Admin-only course management, distinct from the reviewer moderation-
// decision pipeline (lib/courseModeration.ts) -- this is "temporarily
// pull from the catalog," not a moderation verdict.
// 0056_admin_capabilities_batch.sql.
export type AdminCourseListItem = {
  id: string;
  title: string;
  instructor_name: string | null;
  is_published: boolean;
  created_at: string;
};

// Scoped to currently-published courses -- fetchPendingCourses/
// fetchDecidedCourses (lib/courseModeration.ts) rely on the is_reviewer
// RLS policy, a different permission an admin might not also have.
export async function fetchAllCoursesAdmin(): Promise<AdminCourseListItem[]> {
  const { data, error } = await supabase.rpc('get_all_courses_admin');
  if (error) throw error;
  return data ?? [];
}

export async function setCoursePublished(courseId: string, isPublished: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_course_published', { p_course_id: courseId, p_is_published: isPublished });
  if (error) throw error;
}
