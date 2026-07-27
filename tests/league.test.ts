import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGlobalLeague, fetchCourseLeague, fetchInstructorLeague, fetchStudentCourseOptions } from '../lib/league';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

const RAW_ROW = {
  student_id: 'student-1',
  full_name: 'Jane Doe',
  totem: 'Black Stars',
  xp: 25,
  rank: 1,
  is_me: true,
};

describe('fetchGlobalLeague', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calls get_global_league and maps rows to camelCase', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [RAW_ROW], error: null } as never);

    const rows = await fetchGlobalLeague(50);

    expect(supabase.rpc).toHaveBeenCalledWith('get_global_league', { p_limit: 50 });
    expect(rows).toEqual([
      { studentId: 'student-1', fullName: 'Jane Doe', totem: 'Black Stars', xp: 25, rank: 1, isMe: true },
    ]);
  });

  it('throws when the RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('boom') } as never);
    await expect(fetchGlobalLeague()).rejects.toThrow('boom');
  });
});

describe('fetchCourseLeague', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calls get_course_league with the course id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [RAW_ROW], error: null } as never);

    const rows = await fetchCourseLeague('course-1', 20);

    expect(supabase.rpc).toHaveBeenCalledWith('get_course_league', { p_course_id: 'course-1', p_limit: 20 });
    expect(rows[0].studentId).toBe('student-1');
  });
});

describe('fetchInstructorLeague', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('passes a null course id for the global-across-my-courses scope', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await fetchInstructorLeague(null);

    expect(supabase.rpc).toHaveBeenCalledWith('get_instructor_league', { p_course_id: null, p_limit: 100 });
  });

  it('passes a specific course id for the single-course scope', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await fetchInstructorLeague('course-1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_instructor_league', { p_course_id: 'course-1', p_limit: 100 });
  });
});

describe('fetchStudentCourseOptions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists the courses a student is enrolled in', async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            { course_id: 'course-1', course: { title: 'Course A' } },
            { course_id: 'course-2', course: { title: 'Course B' } },
          ],
          error: null,
        })
      ),
    };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    const options = await fetchStudentCourseOptions('student-1');

    expect(options).toEqual([
      { courseId: 'course-1', title: 'Course A' },
      { courseId: 'course-2', title: 'Course B' },
    ]);
  });

  it('falls back to a placeholder title if the course join is missing', async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => Promise.resolve({ data: [{ course_id: 'course-1', course: null }], error: null })),
    };
    vi.mocked(supabase.from).mockReturnValue(builder as unknown as ReturnType<typeof supabase.from>);

    const options = await fetchStudentCourseOptions('student-1');
    expect(options).toEqual([{ courseId: 'course-1', title: 'Untitled course' }]);
  });
});
