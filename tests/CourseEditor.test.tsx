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
});
