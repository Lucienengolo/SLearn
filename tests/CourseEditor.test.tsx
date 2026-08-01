import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseEditor from '../components/Dashboard/CourseEditor';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as authContext from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function mockCategories() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.match = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null }));
    builder.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: table === 'categories' ? [] : [], error: null }).then(resolve);
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

function renderEditor() {
  return render(
    <LocaleProvider>
      <CourseEditor courseId={null} onBack={vi.fn()} />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the course creation/editing form (labels, upload hints,
// lesson blocks, quiz builder) was hardcoded English regardless of the
// FR/EN toggle.
describe('CourseEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ user: { id: 'instructor-1' } } as never);
    mockCategories();
  });

  it('renders in English by default (jsdom navigator.language)', () => {
    renderEditor();

    expect(screen.getByText('Create new course')).toBeInTheDocument();
    expect(screen.getByText('Course Title *')).toBeInTheDocument();
    expect(screen.getByText('Lessons')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save course' })).toBeInTheDocument();
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderEditor();

    expect(screen.getByText('Créer un nouveau cours')).toBeInTheDocument();
    expect(screen.getByText('Titre du cours *')).toBeInTheDocument();
    expect(screen.getByText('Leçons')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer le cours' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  // Regression: founder request, 2026-08-01 -- "add a clear option to
  // add or delete a course category." The delete RLS policy is scoped to
  // verified instructors only, so the "Manage" button that opens the
  // delete modal must be hidden from anyone who'd just hit an RLS error.
  describe('category management button visibility', () => {
    it('shows the Manage categories button for a verified instructor', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: { id: 'instructor-1' },
        profile: { id: 'instructor-1', role: 'instructor', verified: true },
      } as never);
      renderEditor();

      expect(screen.getByRole('button', { name: /manage/i })).toBeInTheDocument();
    });

    it('hides the Manage categories button for an unverified instructor', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: { id: 'instructor-1' },
        profile: { id: 'instructor-1', role: 'instructor', verified: false },
      } as never);
      renderEditor();

      expect(screen.queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
    });

    it('hides the Manage categories button for a student', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: { id: 'student-1' },
        profile: { id: 'student-1', role: 'student', verified: false },
      } as never);
      renderEditor();

      expect(screen.queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
    });
  });
});
