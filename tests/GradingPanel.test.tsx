import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as classworkLib from '../lib/classwork';
import GradingPanel from '../components/Dashboard/GradingPanel';
import { ToastProvider } from '../contexts/ToastContext';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ClassworkPostWithCourse } from '../lib/classwork';

vi.mock('../lib/classwork', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/classwork')>();
  return { ...actual, fetchSubmissionsForPost: vi.fn(), gradeSubmission: vi.fn() };
});

const POST: ClassworkPostWithCourse = {
  id: 'post-1',
  course_id: 'course-1',
  instructor_id: 'instructor-1',
  type: 'assignment',
  title: 'Essay 1',
  body: null,
  attachment_url: null,
  due_at: null,
  max_points: 100,
  created_at: '',
  updated_at: '',
};

function renderPanel(onBack = vi.fn()) {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <GradingPanel post={POST} onBack={onBack} />
      </ToastProvider>
    </LocaleProvider>
  );
}

describe('GradingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classworkLib.gradeSubmission).mockResolvedValue(undefined);
  });

  it('shows an empty state when there are no submissions', async () => {
    vi.mocked(classworkLib.fetchSubmissionsForPost).mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
  });

  it('lists each submission with student name and content', async () => {
    vi.mocked(classworkLib.fetchSubmissionsForPost).mockResolvedValue([
      {
        id: 'sub-1',
        post_id: 'post-1',
        student_id: 'student-1',
        content: 'My essay text',
        attachment_url: null,
        submitted_at: '2026-07-20T00:00:00Z',
        grade: null,
        feedback: null,
        graded_at: null,
        student: { full_name: 'Jane Doe' },
      },
    ]);
    renderPanel();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('My essay text')).toBeInTheDocument();
    expect(screen.getByText('1 submission · 0 graded')).toBeInTheDocument();
  });

  it('saves a grade and feedback', async () => {
    const user = userEvent.setup();
    vi.mocked(classworkLib.fetchSubmissionsForPost).mockResolvedValue([
      {
        id: 'sub-1',
        post_id: 'post-1',
        student_id: 'student-1',
        content: 'My essay text',
        attachment_url: null,
        submitted_at: '2026-07-20T00:00:00Z',
        grade: null,
        feedback: null,
        graded_at: null,
        student: { full_name: 'Jane Doe' },
      },
    ]);
    renderPanel();
    await screen.findByText('Jane Doe');

    await user.type(screen.getByPlaceholderText('/ 100'), '92');
    await user.type(screen.getByPlaceholderText(/feedback/i), 'Great work');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(classworkLib.gradeSubmission).toHaveBeenCalledWith('sub-1', 92, 'Great work');
  });

  it('calls onBack when the back link is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    vi.mocked(classworkLib.fetchSubmissionsForPost).mockResolvedValue([]);
    renderPanel(onBack);
    await screen.findByText(/no submissions yet/i);

    await user.click(screen.getByRole('button', { name: /back to classwork/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    vi.mocked(classworkLib.fetchSubmissionsForPost).mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText(/aucune soumission pour le moment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retour aux travaux/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
