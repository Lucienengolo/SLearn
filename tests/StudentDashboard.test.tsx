import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudentDashboard from '../components/Dashboard/StudentDashboard';
import * as authContext from '../contexts/AuthContext';
import * as gamificationLib from '../lib/gamification';
import { supabase } from '../lib/supabase';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ComponentProps } from 'react';

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
  certificates?: unknown[];
}) {
  const byTable: Record<string, unknown[]> = {
    enrollments: overrides.enrollments ?? [],
    course_stats: overrides.statsRows ?? [],
    student_course_progress: overrides.progressRows ?? [],
    certificates: overrides.certificates ?? [],
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
    duration_hours: 4,
    thumbnail_url: null,
    instructor: { full_name: 'Instructor One' },
    category: { name: 'Web Development' },
  },
};

function renderDashboard(props: Partial<ComponentProps<typeof StudentDashboard>> = {}) {
  return render(
    <LocaleProvider>
      <StudentDashboard
        onNavigate={vi.fn()}
        onCourseSelect={vi.fn()}
        onCertificateView={vi.fn()}
        onBecomeInstructor={vi.fn()}
        {...props}
      />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the student dashboard (greeting, stat tiles, course list,
// filters) was hardcoded English regardless of the FR/EN toggle.
describe('StudentDashboard', () => {
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

  it('renders in English by default (jsdom navigator.language)', async () => {
    mockTables({ enrollments: [ENROLLMENT] });
    renderDashboard();

    expect(await screen.findByText('My courses')).toBeInTheDocument();
    expect(screen.getByText('Courses enrolled')).toBeInTheDocument();
    expect(screen.getByText(/good to see you/i)).toBeInTheDocument();
    expect(screen.getByText('Apply to teach')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    mockTables({ enrollments: [ENROLLMENT] });

    renderDashboard();

    expect(await screen.findByText('Mes cours')).toBeInTheDocument();
    expect(screen.getByText('Cours suivis')).toBeInTheDocument();
    expect(screen.getByText(/ravi de vous revoir/i)).toBeInTheDocument();
    expect(screen.getByText('Postuler pour enseigner')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
