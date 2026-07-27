import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as classworkLib from '../lib/classwork';
import ClassworkList from '../components/Courses/ClassworkList';
import { ToastProvider } from '../contexts/ToastContext';
import type { ClassworkPostWithCourse } from '../lib/classwork';

vi.mock('../lib/classwork', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/classwork')>();
  return {
    ...actual,
    fetchClassworkPosts: vi.fn(),
    fetchMySubmission: vi.fn(),
    submitClasswork: vi.fn(),
  };
});

const ANNOUNCEMENT: ClassworkPostWithCourse = {
  id: 'post-1',
  course_id: 'course-1',
  instructor_id: 'instructor-1',
  type: 'announcement',
  title: 'Welcome!',
  body: 'Glad to have you here.',
  attachment_url: null,
  due_at: null,
  max_points: null,
  created_at: '',
  updated_at: '',
};

const ASSIGNMENT: ClassworkPostWithCourse = {
  id: 'post-2',
  course_id: 'course-1',
  instructor_id: 'instructor-1',
  type: 'assignment',
  title: 'Essay 1',
  body: 'Write 500 words.',
  attachment_url: null,
  due_at: '2026-08-01T00:00:00Z',
  max_points: 100,
  created_at: '',
  updated_at: '',
};

function renderList() {
  return render(
    <ToastProvider>
      <ClassworkList courseId="course-1" studentId="student-1" />
    </ToastProvider>
  );
}

describe('ClassworkList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classworkLib.submitClasswork).mockResolvedValue(undefined);
  });

  it('renders nothing when there is no classwork posted', async () => {
    vi.mocked(classworkLib.fetchClassworkPosts).mockResolvedValue([]);
    const { container } = renderList();
    await vi.waitFor(() => expect(classworkLib.fetchClassworkPosts).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('shows announcements read-only, with no submission box', async () => {
    vi.mocked(classworkLib.fetchClassworkPosts).mockResolvedValue([ANNOUNCEMENT]);
    renderList();
    expect(await screen.findByText('Welcome!')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type your submission/i)).not.toBeInTheDocument();
  });

  it('shows a submission box for an assignment with no prior submission', async () => {
    vi.mocked(classworkLib.fetchClassworkPosts).mockResolvedValue([ASSIGNMENT]);
    vi.mocked(classworkLib.fetchMySubmission).mockResolvedValue(null);
    renderList();

    expect(await screen.findByText('Essay 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('submits and shows a success toast', async () => {
    const user = userEvent.setup();
    vi.mocked(classworkLib.fetchClassworkPosts).mockResolvedValue([ASSIGNMENT]);
    vi.mocked(classworkLib.fetchMySubmission).mockResolvedValue(null);
    renderList();
    await screen.findByText('Essay 1');

    await user.type(screen.getByPlaceholderText(/type your submission/i), 'My answer');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(classworkLib.submitClasswork).toHaveBeenCalledWith('post-2', 'student-1', 'My answer');
    expect(await screen.findByText('Submitted.')).toBeInTheDocument();
  });

  it('shows the grade and feedback once graded, with no editable textarea', async () => {
    vi.mocked(classworkLib.fetchClassworkPosts).mockResolvedValue([ASSIGNMENT]);
    vi.mocked(classworkLib.fetchMySubmission).mockResolvedValue({
      id: 'sub-1',
      post_id: 'post-2',
      student_id: 'student-1',
      content: 'My answer',
      attachment_url: null,
      submitted_at: '2026-07-20T00:00:00Z',
      grade: 92,
      feedback: 'Great work',
      graded_at: '2026-07-21T00:00:00Z',
    });
    renderList();

    expect(await screen.findByText('Grade: 92 / 100')).toBeInTheDocument();
    expect(screen.getByText('Great work')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type your submission/i)).not.toBeInTheDocument();
  });
});
