import { supabase, Category } from './supabase';

export async function fetchAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export type CategoryUsage = {
  courseCount: number;
  tutorRequestCount: number;
  tutorSubjectCount: number;
  total: number;
};

// RLS/FK behavior differs per table that references categories.id (see
// 0045_instructors_delete_categories.sql's comment): courses.category_id is
// ON DELETE SET NULL (would silently blank a course's category, not a hard
// error), tutor_requests.category_id has no ON DELETE clause (defaults to
// RESTRICT -- blocks with a raw Postgres FK error), tutor_subjects.
// category_id is ON DELETE CASCADE (would silently delete a tutor's
// subject-matching rows). None of that is a good user-facing experience,
// so the app checks usage itself first and blocks with a clear message
// rather than letting any of those three behaviors surprise someone.
export async function checkCategoryUsage(categoryId: string): Promise<CategoryUsage> {
  const [courses, tutorRequests, tutorSubjects] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('category_id', categoryId),
    supabase.from('tutor_requests').select('id', { count: 'exact', head: true }).eq('category_id', categoryId),
    supabase.from('tutor_subjects').select('tutor_id', { count: 'exact', head: true }).eq('category_id', categoryId),
  ]);

  if (courses.error) throw courses.error;
  if (tutorRequests.error) throw tutorRequests.error;
  if (tutorSubjects.error) throw tutorSubjects.error;

  const courseCount = courses.count ?? 0;
  const tutorRequestCount = tutorRequests.count ?? 0;
  const tutorSubjectCount = tutorSubjects.count ?? 0;

  return {
    courseCount,
    tutorRequestCount,
    tutorSubjectCount,
    total: courseCount + tutorRequestCount + tutorSubjectCount,
  };
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw error;
}
