import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CourseStudents from '../components/Dashboard/CourseStudents';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

// Relative to real "now" rather than mocked system time -- vi.useFakeTimers()
// breaks Testing Library's findBy*/waitFor polling (they hang until the real
// Vitest timeout), so dates are computed as offsets instead.
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function mockTables(overrides: {
  enrollments?: unknown[];
  certificates?: unknown[];
  lessons?: unknown[];
  lessonProgress?: unknown[];
  quizzes?: unknown[];
  quizAttemptCount?: number;
}) {
  const data: Record<string, unknown> = {
    courses: { id: 'course-1', title: 'Python 202', level: 'intermediate', duration_hours: 4, created_at: daysAgo(30) },
    enrollments: overrides.enrollments ?? [],
    certificates: overrides.certificates ?? [],
    lessons: overrides.lessons ?? [{ id: 'lesson-1' }],
    lesson_progress: overrides.lessonProgress ?? [],
    quizzes: overrides.quizzes ?? [],
  };
  const count = overrides.quizAttemptCount ?? 0;

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      in: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: data[table] })),
      then: (resolve: (v: { data: unknown; count?: number }) => void) =>
        Promise.resolve({ data: data[table], count: table === 'quiz_attempts' ? count : undefined }).then(resolve),
    };
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

function renderCourseStudents(overrides: Parameters<typeof mockTables>[0] = {}) {
  mockTables(overrides);
  return render(<CourseStudents courseId="course-1" onBack={vi.fn()} onEditCourse={vi.fn()} />);
}

describe('CourseStudents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags students who have not started and shows them in the attention panel', async () => {
    renderCourseStudents({
      enrollments: [
        {
          id: 'enr-1',
          student_id: 'student-1',
          enrolled_at: daysAgo(3),
          completed_at: null,
          progress_percentage: 0,
          student: { full_name: 'Jane Doe', email: 'jane@example.com', avatar_url: null },
        },
      ],
    });

    expect(await screen.findByText(/1 student hasn't started yet/i)).toBeInTheDocument();
  });

  it('flags a student inactive for 14+ days as needing attention', async () => {
    renderCourseStudents({
      enrollments: [
        {
          id: 'enr-1',
          student_id: 'student-1',
          enrolled_at: daysAgo(50),
          completed_at: null,
          progress_percentage: 40,
          student: { full_name: 'Jane Doe', email: 'jane@example.com', avatar_url: null },
        },
      ],
      lessonProgress: [{ student_id: 'student-1', updated_at: daysAgo(45) }],
    });

    expect(await screen.findByText(/1 student inactive for 14\+ days/i)).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });

  it('shows a neutral message when nothing needs attention', async () => {
    renderCourseStudents({
      enrollments: [
        {
          id: 'enr-1',
          student_id: 'student-1',
          enrolled_at: daysAgo(10),
          completed_at: null,
          progress_percentage: 40,
          student: { full_name: 'Jane Doe', email: 'jane@example.com', avatar_url: null },
        },
      ],
      lessonProgress: [{ student_id: 'student-1', updated_at: daysAgo(1) }],
    });

    await screen.findByText('Jane Doe');
    expect(screen.getByText(/nothing needs your attention right now/i)).toBeInTheDocument();
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
  });

  it('renders the class overall progress chart with correct bucket counts', async () => {
    renderCourseStudents({
      enrollments: [
        {
          id: 'enr-1',
          student_id: 'student-1',
          enrolled_at: daysAgo(20),
          completed_at: daysAgo(5),
          progress_percentage: 100,
          student: { full_name: 'Completed Student', email: 'a@example.com', avatar_url: null },
        },
        {
          id: 'enr-2',
          student_id: 'student-2',
          enrolled_at: daysAgo(20),
          completed_at: null,
          progress_percentage: 0,
          student: { full_name: 'New Student', email: 'b@example.com', avatar_url: null },
        },
      ],
    });

    expect(await screen.findByText(/class overall progress/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Completed: 1 student/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Not started: 1 student/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /In progress: 0 students/i })).toBeInTheDocument();
  });

  it('renders the Information panel and real stat tiles (no fabricated metrics)', async () => {
    renderCourseStudents({
      enrollments: [
        {
          id: 'enr-1',
          student_id: 'student-1',
          enrolled_at: daysAgo(3),
          completed_at: daysAgo(1),
          progress_percentage: 100,
          student: { full_name: 'Jane Doe', email: 'jane@example.com', avatar_url: null },
        },
      ],
      certificates: [{ student_id: 'student-1' }],
      quizzes: [{ id: 'quiz-1' }],
      quizAttemptCount: 7,
    });

    expect(await screen.findByText('Python 202')).toBeInTheDocument();
    expect(screen.getByText(/intermediate course/i)).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('quiz attempts')).toBeInTheDocument();
    expect(screen.getByText('certificates earned')).toBeInTheDocument();
  });

  it('renders the classroom icon rail with working navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onEditCourse = vi.fn();
    mockTables({});
    render(<CourseStudents courseId="course-1" onBack={onBack} onEditCourse={onEditCourse} />);

    await screen.findByText('Python 202');
    expect(screen.getByRole('button', { name: 'Classroom' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onBack).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit course' }));
    expect(onEditCourse).toHaveBeenCalled();
  });
});
