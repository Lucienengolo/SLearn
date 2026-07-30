import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import InstructorDashboard from '../components/Dashboard/InstructorDashboard';
import * as authContext from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { LocaleProvider } from '../contexts/LocaleContext';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

type Builder = { select: unknown; eq: unknown; order: unknown; in: unknown; then: unknown };

function makeBuilder(result: { data: unknown[] | null }): Builder {
  const builder = {} as Builder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => Promise.resolve({ ...result, error: null }).then(resolve);
  return builder;
}

function mockTables(overrides: { courses?: unknown[]; statsRows?: unknown[] }) {
  const byTable: Record<string, unknown[]> = {
    courses: overrides.courses ?? [],
    course_stats: overrides.statsRows ?? [],
  };
  vi.mocked(supabase.from).mockImplementation(
    (table: string) => makeBuilder({ data: byTable[table] ?? [] }) as unknown as ReturnType<typeof supabase.from>
  );
}

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'instructor-1', email: 'i@example.com' } as never,
  } as never);
}

const COURSE = {
  id: 'course-1',
  title: 'Intro to SQL',
  description: 'Learn SQL from scratch.',
  instructor_id: 'instructor-1',
  category_id: 'cat-1',
  thumbnail_url: null,
  level: 'beginner',
  duration_hours: 4,
  price: 0,
  is_published: true,
  moderation_status: 'approved',
  moderation_notes: null,
  created_at: '',
  updated_at: '',
  category: { name: 'Data Science' },
};

function renderDashboard() {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <InstructorDashboard />
      </ToastProvider>
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the instructor's course list (tabs, headings, status badges,
// filters) was hardcoded English regardless of the FR/EN toggle.
describe('InstructorDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    mockTables({ courses: [COURSE], statsRows: [{ course_id: 'course-1', enrollment_count: 3, lesson_count: 5 }] });
    renderDashboard();

    expect(await screen.findByText('My courses')).toBeInTheDocument();
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0);
    expect(screen.getByText('Create course')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    mockTables({ courses: [COURSE], statsRows: [{ course_id: 'course-1', enrollment_count: 3, lesson_count: 5 }] });

    renderDashboard();

    expect(await screen.findByText('Mes cours')).toBeInTheDocument();
    expect(screen.getAllByText('En ligne').length).toBeGreaterThan(0);
    expect(screen.getByText('Créer un cours')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
