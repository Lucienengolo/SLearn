import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LessonViewer from '../components/Lessons/LessonViewer';
import * as authContext from '../contexts/AuthContext';
import * as offlineContext from '../contexts/OfflineContext';
import { supabase } from '../lib/supabase';
import { cacheLessonForOffline, getCachedLesson } from '../lib/offlineLessonCache';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

const LESSON = {
  id: 'lesson-1',
  course_id: 'course-1',
  title: 'Intro to SQL',
  description: null,
  content: 'This lesson covers SELECT statements.',
  video_url: null,
  video_file_url: null,
  pdf_notes_url: null,
  order_index: 0,
  duration_minutes: 10,
  created_at: '',
  updated_at: '',
};

const COURSE = { id: 'course-1', title: 'SQL Fundamentals' };

function mockSupabaseTables() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.single = vi.fn(() =>
      Promise.resolve({
        data: table === 'lessons' ? LESSON : table === 'courses' ? COURSE : null,
        error: null,
      })
    );
    builder.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: table === 'lessons' ? [LESSON] : [], error: null }).then(resolve);
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

function mockOfflineStatus(isOnline: boolean, offlineModeEnabled: boolean) {
  vi.spyOn(offlineContext, 'useOfflineStatus').mockReturnValue({
    isOnline,
    offlineModeEnabled,
    setOfflineModeEnabled: vi.fn(),
  });
}

// Regression: founder request, 2026-08-01 -- lessons a student already
// viewed while online should stay reviewable offline, and a lesson never
// viewed should show a clear message rather than hanging on a failed fetch.
describe('LessonViewer offline behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ user: null } as never);
  });

  it('caches the lesson content after a successful online fetch when offline mode is enabled', async () => {
    mockSupabaseTables();
    mockOfflineStatus(true, true);

    render(<LessonViewer lessonId="lesson-1" onBack={vi.fn()} />);

    await waitFor(() => {
      const cached = getCachedLesson('lesson-1');
      expect(cached?.content).toBe(LESSON.content);
      expect(cached?.title).toBe(LESSON.title);
    });
  });

  it('does not cache anything when offline mode is disabled', async () => {
    mockSupabaseTables();
    mockOfflineStatus(true, false);

    render(<LessonViewer lessonId="lesson-1" onBack={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Intro to SQL' });
    expect(getCachedLesson('lesson-1')).toBeNull();
  });

  it('renders the cached version, with no network call, when offline and a cache entry exists', async () => {
    cacheLessonForOffline({ id: 'lesson-1', courseId: 'course-1', title: 'Intro to SQL', content: 'Cached content here.' });
    mockOfflineStatus(false, true);

    render(<LessonViewer lessonId="lesson-1" onBack={vi.fn()} />);

    expect(await screen.findByText(/viewing offline/i)).toBeInTheDocument();
    expect(screen.getByText('Intro to SQL')).toBeInTheDocument();
    expect(screen.getByText('Cached content here.')).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('shows a friendly message, with no network call, when offline and nothing is cached for this lesson', async () => {
    mockOfflineStatus(false, true);

    render(<LessonViewer lessonId="never-viewed" onBack={vi.fn()} />);

    expect(await screen.findByText(/isn't available offline/i)).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falls back to the normal (failing) fetch when offline mode was never enabled, unchanged from before this feature', async () => {
    mockSupabaseTables();
    mockOfflineStatus(false, false);

    render(<LessonViewer lessonId="lesson-1" onBack={vi.fn()} />);

    // Same call shape as the online case -- offline-mode-disabled users get
    // exactly the pre-existing behavior, no new code path applies to them.
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('lessons'));
  });
});
