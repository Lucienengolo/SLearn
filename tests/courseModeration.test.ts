import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPendingCourses, fetchDecidedCourses } from '../lib/courseModeration';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const BASE_COURSE = {
  id: 'course-1',
  title: 'Intro to SQL',
  description: 'desc',
  instructor_id: 'instructor-1',
  category_id: 'cat-1',
  thumbnail_url: null,
  level: 'beginner',
  duration_hours: 4,
  price: 0,
  is_published: true,
  moderation_status: 'pending',
  moderation_notes: null,
  created_at: '',
  updated_at: '',
  instructor: { full_name: 'Aïcha Mbarga' },
  category: { name: 'Data Science' },
};

function mockCourses(rows: unknown[]) {
  vi.mocked(supabase.from).mockImplementation(() => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: rows, error: null }).then(resolve);
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

// Regression: profiles.email is no longer selectable via the embedded
// profiles join (2026-08-02 security fix, 0046_restrict_profile_email.sql)
// -- fetchPendingCourses/fetchDecidedCourses now merge in each course's
// instructor email from a separate get_course_instructor_email RPC call.
describe('courseModeration email attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchPendingCourses merges the instructor email from the RPC onto each course', async () => {
    mockCourses([BASE_COURSE]);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'aicha@example.com', error: null } as never);

    const courses = await fetchPendingCourses();

    expect(supabase.rpc).toHaveBeenCalledWith('get_course_instructor_email', { p_course_id: 'course-1' });
    expect(courses[0].instructor?.email).toBe('aicha@example.com');
    expect(courses[0].instructor?.full_name).toBe('Aïcha Mbarga');
  });

  it('fetchDecidedCourses falls back to an empty string when the RPC returns nothing (e.g. caller is not a reviewer)', async () => {
    mockCourses([BASE_COURSE]);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    const courses = await fetchDecidedCourses();

    expect(courses[0].instructor?.email).toBe('');
  });

  it('calls the RPC once per course, not a single batch call', async () => {
    mockCourses([BASE_COURSE, { ...BASE_COURSE, id: 'course-2' }]);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'x@example.com', error: null } as never);

    await fetchPendingCourses();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});
