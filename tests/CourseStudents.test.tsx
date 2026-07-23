import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
}) {
  const data: Record<string, unknown> = {
    courses: { id: 'course-1', title: 'Python 202' },
    enrollments: overrides.enrollments ?? [],
    certificates: overrides.certificates ?? [],
    lessons: overrides.lessons ?? [{ id: 'lesson-1' }],
    lesson_progress: overrides.lessonProgress ?? [],
  };

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      in: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: data[table] })),
      then: (resolve: (v: { data: unknown }) => void) => Promise.resolve({ data: data[table] }).then(resolve),
    };
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

describe('CourseStudents', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags students who have not started and shows them in the attention panel', async () => {
    mockTables({
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

    render(<CourseStudents courseId="course-1" onBack={vi.fn()} />);

    expect(await screen.findByText(/1 student hasn't started yet/i)).toBeInTheDocument();
  });

  it('flags a student inactive for 14+ days as needing attention', async () => {
    mockTables({
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

    render(<CourseStudents courseId="course-1" onBack={vi.fn()} />);

    expect(await screen.findByText(/1 student inactive for 14\+ days/i)).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });

  it('does not flag a recently-active, in-progress student', async () => {
    mockTables({
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

    render(<CourseStudents courseId="course-1" onBack={vi.fn()} />);

    await screen.findByText('Jane Doe');
    expect(screen.queryByText(/attention/i)).not.toBeInTheDocument();
  });

  it('renders the class overall progress chart with correct bucket counts', async () => {
    mockTables({
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

    render(<CourseStudents courseId="course-1" onBack={vi.fn()} />);

    expect(await screen.findByText(/class overall progress/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Completed: 1 student/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Not started: 1 student/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /In progress: 0 students/i })).toBeInTheDocument();
  });
});
