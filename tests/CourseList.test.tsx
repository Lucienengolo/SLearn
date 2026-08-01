import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CourseList from '../components/Courses/CourseList';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as authContext from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

type OrCall = { table: string; or: string };

function mockSupabase(profilesMatch: { id: string }[] = []): OrCall[] {
  const orCalls: OrCall[] = [];
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(() => builder);
    builder.or = vi.fn((s: string) => {
      orCalls.push({ table, or: s });
      return builder;
    });
    builder.order = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.range = vi.fn(() => builder);
    builder.then = (resolve: (v: unknown) => void) => {
      if (table === 'profiles') return Promise.resolve({ data: profilesMatch, error: null }).then(resolve);
      if (table === 'courses') return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
      return Promise.resolve({ data: [], error: null }).then(resolve);
    };
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
  return orCalls;
}

function renderCourseList() {
  return render(
    <LocaleProvider>
      <CourseList onCourseSelect={vi.fn()} />
    </LocaleProvider>
  );
}

// Regression: founder request, 2026-08-01 -- "on search bar user should
// have the possibility to [search for a] course base on instructor
// user name." PostgREST's .or() can't filter on a joined table's column
// (instructor.full_name) in the same call as the course table's own
// columns, so matching instructor ids are resolved in a separate query
// first, then folded into the existing title/description OR.
describe('CourseList instructor-name search', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ user: null } as never);
  });

  it('searches by title/description only when no instructor name matches', async () => {
    const orCalls = mockSupabase([]);
    renderCourseList();

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'React' } });

    await waitFor(() => {
      const coursesOrCall = orCalls.find((c) => c.table === 'courses');
      expect(coursesOrCall?.or).toBe('title.ilike.%React%,description.ilike.%React%');
    });
  });

  it('includes matching instructors in the search via instructor_id.in', async () => {
    const orCalls = mockSupabase([{ id: 'instructor-42' }, { id: 'instructor-43' }]);
    renderCourseList();

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Aicha' } });

    await waitFor(() => {
      const coursesOrCall = orCalls.find((c) => c.table === 'courses');
      expect(coursesOrCall?.or).toBe(
        'title.ilike.%Aicha%,description.ilike.%Aicha%,instructor_id.in.(instructor-42,instructor-43)'
      );
    });
  });

  it('does not filter by instructor_id when the search box is empty', async () => {
    const orCalls = mockSupabase([]);
    renderCourseList();

    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('courses'));
    expect(orCalls.find((c) => c.table === 'courses')).toBeUndefined();
  });
});
