import { describe, it, expect, vi } from 'vitest';
import { fetchAllCoursesAdmin, setCoursePublished } from '../lib/adminCourses';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

// Admin capabilities batch, 2026-08-06 -- unpublish a single course
// without deactivating the whole instructor (0056_admin_capabilities_batch.sql).
describe('adminCourses', () => {
  it('fetchAllCoursesAdmin calls get_all_courses_admin and returns its rows', async () => {
    const rows = [{ id: 'c-1', title: 'Intro to SQL', instructor_name: 'Aïcha Mbarga', is_published: true, created_at: '' }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null } as never);

    const result = await fetchAllCoursesAdmin();

    expect(supabase.rpc).toHaveBeenCalledWith('get_all_courses_admin');
    expect(result).toEqual(rows);
  });

  it('fetchAllCoursesAdmin returns an empty array when data is null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    expect(await fetchAllCoursesAdmin()).toEqual([]);
  });

  it('setCoursePublished calls admin_set_course_published with the course id and flag', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await setCoursePublished('c-1', false);

    expect(supabase.rpc).toHaveBeenCalledWith('admin_set_course_published', { p_course_id: 'c-1', p_is_published: false });
  });

  it('setCoursePublished throws when the RPC rejects', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'Only an admin can change a course\'s published status' } } as never);

    await expect(setCoursePublished('c-1', false)).rejects.toBeTruthy();
  });
});
