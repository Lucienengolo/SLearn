import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  thumbnail_url: null as string | null,
  level: 'beginner',
  duration_hours: 4,
  price: 0,
  is_published: true,
  moderation_status: 'approved',
  moderation_notes: null,
  created_at: '',
  updated_at: '',
  instructor: { full_name: 'Aïcha Mbarga', bio: null as string | null, verified: false, avatar_url: null as string | null },
  category: { name: 'Data Science' },
};

function mockTables(courseOverrides: Partial<typeof BASE_COURSE> = {}) {
  const course = { ...BASE_COURSE, ...courseOverrides };
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.single = vi.fn(() => Promise.resolve({ data: table === 'courses' ? course : null, error: null }));
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

  // Regression: a broken/unreachable thumbnail_url previously left the
  // browser's own alt-text fallback rendering in place, absolutely
  // positioned with no predictable box, overlapping the h1 title below it.
  it('falls back to the gradient+icon placeholder when the thumbnail fails to load', async () => {
    mockTables({ thumbnail_url: 'https://example.com/broken.jpg' });
    const { container } = renderCourseDetail();

    const img = await screen.findByAltText('Intro to SQL');
    fireEvent.error(img);

    expect(screen.queryByAltText('Intro to SQL')).not.toBeInTheDocument();
    // BASE_COURSE's category is "Data Science", which lib/courseCovers.tsx
    // maps to the BarChart3 icon -- confirms the real fallback cover
    // renders, not just "no img".
    expect(container.querySelector('svg.lucide-chart-column')).toBeInTheDocument();
  });

  // Regression: a founder screenshot showed the instructor card always
  // rendering initials, even for an instructor who'd uploaded a real photo
  // via AccountSettings -- the select query never asked for avatar_url at
  // all, so the real photo could never appear regardless of upload status.
  it('shows the instructor\'s real photo when avatar_url is set', async () => {
    mockTables({ instructor: { full_name: 'Aïcha Mbarga', bio: null, verified: false, avatar_url: 'https://example.com/aicha.jpg' } });
    renderCourseDetail();

    expect(await screen.findByAltText('Aïcha Mbarga')).toHaveAttribute('src', 'https://example.com/aicha.jpg');
  });

  it('falls back to initials when the instructor photo fails to load', async () => {
    mockTables({ instructor: { full_name: 'Aïcha Mbarga', bio: null, verified: false, avatar_url: 'https://example.com/broken.jpg' } });
    renderCourseDetail();

    const img = await screen.findByAltText('Aïcha Mbarga');
    fireEvent.error(img);

    expect(screen.queryByAltText('Aïcha Mbarga')).not.toBeInTheDocument();
    expect(await screen.findByText('AM')).toBeInTheDocument();
  });

  it('shows initials when the instructor has no avatar_url', async () => {
    mockTables();
    renderCourseDetail();

    expect(await screen.findByText('AM')).toBeInTheDocument();
  });

  // Regression: founder decision, 2026-08-01 -- real payment processing is
  // disabled for V1 (lib/paymentsConfig.ts's PAYMENTS_ENABLED). The enroll
  // button stays visible for a paid course, but clicking it must show an
  // informational message instead of ever reaching create-checkout-session.
  it('shows a "coming soon" message instead of starting checkout for a paid course', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { id: 'student-1' },
      profile: { id: 'student-1', role: 'student' },
    } as never);
    mockTables({ price: 5000 });
    const { findAllByRole, findByText } = render(
      <LocaleProvider>
        <ToastProvider>
          <CourseDetail courseId="course-1" onBack={vi.fn()} onStartLesson={vi.fn()} />
        </ToastProvider>
      </LocaleProvider>
    );

    // Desktop sidebar + mobile sticky-footer both render an "Enroll now"
    // button -- either works, so click the first.
    const [enrollButton] = await findAllByRole('button', { name: /enroll now/i });
    fireEvent.click(enrollButton);

    expect(await findByText(/isn't available yet/i)).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalledWith('create-checkout-session', expect.anything());
  });
});
