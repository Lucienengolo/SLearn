import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import * as gamificationLib from '../lib/gamification';
import MyProgress from '../components/Dashboard/MyProgress';
import { supabase } from '../lib/supabase';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ComponentProps } from 'react';

function renderMyProgress(props: ComponentProps<typeof MyProgress>) {
  return render(
    <LocaleProvider>
      <MyProgress {...props} />
    </LocaleProvider>
  );
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

type Builder = { select: unknown; eq: unknown; in: unknown; order: unknown; then: unknown };

function makeBuilder(result: { data: unknown[] | null }): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => Promise.resolve({ ...result, error: null }).then(resolve);
  return builder;
}

function mockTables(overrides: {
  enrollments?: unknown[];
  statsRows?: unknown[];
  progressRows?: unknown[];
  certificateRows?: unknown[];
}) {
  const byTable: Record<string, unknown[]> = {
    enrollments: overrides.enrollments ?? [],
    course_stats: overrides.statsRows ?? [],
    student_course_progress: overrides.progressRows ?? [],
    certificates: overrides.certificateRows ?? [],
  };
  vi.mocked(supabase.from).mockImplementation(
    (table: string) => makeBuilder({ data: byTable[table] ?? [] }) as unknown as ReturnType<typeof supabase.from>
  );
}

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'student-1', email: 'jane@example.com' } as never,
    profile: { id: 'p1', full_name: 'Jane Doe', totem: 'Black Stars', role: 'student' } as never,
  } as never);
}

const ENROLLMENT = {
  id: 'enr-1',
  student_id: 'student-1',
  course_id: 'course-1',
  enrolled_at: '2026-01-01T00:00:00Z',
  completed_at: null,
  progress_percentage: 40,
  course: {
    id: 'course-1',
    title: 'Intro to Web Dev',
    thumbnail_url: null,
    instructor: { full_name: 'Instructor One' },
    category: { name: 'Web Development' },
  },
};

describe('MyProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
    vi.spyOn(gamificationLib, 'fetchStudentProgress').mockResolvedValue({
      xp: 40,
      streakDays: 2,
      tier: 'Bronze',
      last7Days: [false, false, false, false, false, false, true],
      xpToNextTier: 60,
      tierProgressPct: 40,
    });
  });

  it('shows an empty state when the student has no enrollments', async () => {
    mockTables({ enrollments: [] });
    renderMyProgress({ onBack: vi.fn(), onNavigate: vi.fn(), onCourseSelect: vi.fn() });
    expect(await screen.findByText('No courses yet')).toBeInTheDocument();
  });

  it('lists each enrolled course with its progress percentage and instructor', async () => {
    mockTables({
      enrollments: [ENROLLMENT],
      statsRows: [{ course_id: 'course-1', lesson_count: 10 }],
      progressRows: [{ course_id: 'course-1', completed_lesson_count: 4 }],
      certificateRows: [],
    });
    renderMyProgress({ onBack: vi.fn(), onNavigate: vi.fn(), onCourseSelect: vi.fn() });

    expect(await screen.findByText('Intro to Web Dev')).toBeInTheDocument();
    expect(screen.getByText('4 of 10 lessons · Instructor One')).toBeInTheDocument();
    // "40%" legitimately appears twice here -- once as the average-progress
    // stat tile, once as this single course's own row percentage.
    expect(screen.getAllByText('40%')).toHaveLength(2);
  });

  it('shows a "Certified" badge for courses with an earned certificate', async () => {
    mockTables({
      enrollments: [ENROLLMENT],
      statsRows: [{ course_id: 'course-1', lesson_count: 10 }],
      progressRows: [{ course_id: 'course-1', completed_lesson_count: 10 }],
      certificateRows: [{ course_id: 'course-1' }],
    });
    renderMyProgress({ onBack: vi.fn(), onNavigate: vi.fn(), onCourseSelect: vi.fn() });

    expect(await screen.findByText('Certified')).toBeInTheDocument();
  });

  it('navigates to the course on click', async () => {
    mockTables({ enrollments: [ENROLLMENT], statsRows: [], progressRows: [], certificateRows: [] });
    const onCourseSelect = vi.fn();
    const user = userEvent.setup();
    renderMyProgress({ onBack: vi.fn(), onNavigate: vi.fn(), onCourseSelect });

    await user.click(await screen.findByText('Intro to Web Dev'));
    expect(onCourseSelect).toHaveBeenCalledWith('course-1');
  });

  it('renders the correct stat tile totals', async () => {
    mockTables({
      enrollments: [ENROLLMENT],
      statsRows: [{ course_id: 'course-1', lesson_count: 10 }],
      progressRows: [{ course_id: 'course-1', completed_lesson_count: 4 }],
      certificateRows: [],
    });
    renderMyProgress({ onBack: vi.fn(), onNavigate: vi.fn(), onCourseSelect: vi.fn() });

    await waitFor(() => expect(screen.getByText('Courses enrolled')).toBeInTheDocument());
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    mockTables({
      enrollments: [ENROLLMENT],
      statsRows: [{ course_id: 'course-1', lesson_count: 10 }],
      progressRows: [{ course_id: 'course-1', completed_lesson_count: 4 }],
      certificateRows: [],
    });

    renderMyProgress({ onBack: vi.fn(), onNavigate: vi.fn(), onCourseSelect: vi.fn() });

    expect(await screen.findByRole('heading', { name: 'Mes progrès' })).toBeInTheDocument();
    expect(screen.getByText('Cours suivis')).toBeInTheDocument();
    expect(screen.getByText('4 sur 10 leçons · Instructor One')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
