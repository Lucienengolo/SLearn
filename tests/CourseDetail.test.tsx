import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseDetail from '../components/Courses/CourseDetail';
import { LocaleProvider } from '../contexts/LocaleContext';
import { ToastProvider } from '../contexts/ToastContext';
import * as authContext from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock('../lib/certificates', () => ({
  getCourseFinalExam: vi.fn().mockResolvedValue(null),
  hasPassedQuiz: vi.fn().mockResolvedValue(false),
  issueCertificateIfEligible: vi.fn(),
}));

const BASE_COURSE = {
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
  instructor: { full_name: 'Aïcha Mbarga', bio: null, verified: false },
  category: { name: 'Data Science' },
};

function mockTables() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.single = vi.fn(() => Promise.resolve({ data: table === 'courses' ? BASE_COURSE : null, error: null }));
    builder.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve);
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

function renderCourseDetail() {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <CourseDetail courseId="course-1" onBack={vi.fn()} onStartLesson={vi.fn()} />
      </ToastProvider>
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- CourseDetail's chrome (section headers, meta labels, enroll
// button, sidebar perks) was hardcoded English regardless of the FR/EN
// toggle. course.description/instructor.bio (real content) intentionally
// stay untranslated -- that's a separate, later problem.
describe('CourseDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ user: null, profile: null } as never);
    mockTables();
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    renderCourseDetail();
    expect(await screen.findByText('About this course')).toBeInTheDocument();
    expect(screen.getByText('Course content')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderCourseDetail();

    expect(await screen.findByText('À propos de ce cours')).toBeInTheDocument();
    expect(screen.getByText('Contenu du cours')).toBeInTheDocument();
    expect(screen.getByText('Débutant')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
