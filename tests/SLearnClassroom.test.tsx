import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import * as learnersLib from '../lib/instructorLearners';
import SLearnClassroom from '../components/Dashboard/SLearnClassroom';
import type { Course } from '../lib/supabase';
import type { LearnerRow } from '../lib/instructorLearners';

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'instructor-1', email: 'i@example.com' },
  } as never);
}

const COURSE_A = { id: 'course-1', title: 'Course A' } as Course;
const COURSE_B = { id: 'course-2', title: 'Course B' } as Course;

function makeRow(overrides: Partial<LearnerRow> = {}): LearnerRow {
  return {
    enrollmentId: 'enr-1',
    studentId: 'student-1',
    courseId: 'course-1',
    courseTitle: 'Course A',
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    avatarUrl: null,
    enrolledAt: '2026-07-01T00:00:00Z',
    completedAt: null,
    progressPercentage: 40,
    hasCertificate: false,
    lastActivityAt: '2026-07-20T00:00:00Z',
    isStale: false,
    ...overrides,
  };
}

describe('SLearnClassroom', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth();
  });

  it('shows an empty state when the instructor has no courses', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({ courses: [], rows: [], totalQuizAttempts: 0 });
    render(<SLearnClassroom onBack={vi.fn()} />);

    expect(await screen.findByText(/no courses yet/i)).toBeInTheDocument();
  });

  it('renders the title and aggregated stat tiles across all courses', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
      courses: [COURSE_A, COURSE_B],
      rows: [
        makeRow({ enrollmentId: 'enr-1', studentId: 'student-1', completedAt: '2026-07-10T00:00:00Z', hasCertificate: true }),
        makeRow({ enrollmentId: 'enr-2', studentId: 'student-2', courseId: 'course-2', courseTitle: 'Course B' }),
      ],
      totalQuizAttempts: 12,
    });

    render(<SLearnClassroom onBack={vi.fn()} />);

    expect(await screen.findByText('S@Learn Classroom')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 distinct learners
    expect(screen.getByText('learners')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('quiz attempts')).toBeInTheDocument();
  });

  it('renders one progress bar per course, directly labeled', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
      courses: [COURSE_A, COURSE_B],
      rows: [
        makeRow({ progressPercentage: 40 }),
        makeRow({ enrollmentId: 'enr-2', studentId: 'student-2', courseId: 'course-2', courseTitle: 'Course B', progressPercentage: 80 }),
      ],
      totalQuizAttempts: 0,
    });

    render(<SLearnClassroom onBack={vi.fn()} />);

    expect(await screen.findByRole('img', { name: /Course A: 40% average progress/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Course B: 80% average progress/i })).toBeInTheDocument();
  });

  it('shows the course name alongside each learner row', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
      courses: [COURSE_A],
      rows: [makeRow()],
      totalQuizAttempts: 0,
    });

    render(<SLearnClassroom onBack={vi.fn()} />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    // "Course A" legitimately appears twice -- once as the chart's bar
    // label, once next to the learner row -- so this just checks it's
    // present at all, not that it's unique.
    expect(screen.getAllByText(/course a/i).length).toBeGreaterThanOrEqual(2);
  });

  it('opens Add Student with every course available as an option', async () => {
    const user = userEvent.setup();
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
      courses: [COURSE_A, COURSE_B],
      rows: [makeRow()],
      totalQuizAttempts: 0,
    });

    render(<SLearnClassroom onBack={vi.fn()} />);
    await screen.findByText('Jane Doe');

    await user.click(screen.getByRole('button', { name: /add student/i }));
    expect(screen.getByRole('dialog', { name: /add student/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Course A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Course B' })).toBeInTheDocument();
  });

  it('navigates back via the rail\'s Dashboard icon, and marks Classroom as current', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
      courses: [COURSE_A],
      rows: [makeRow()],
      totalQuizAttempts: 0,
    });

    render(<SLearnClassroom onBack={onBack} />);
    await screen.findByText('Jane Doe');

    expect(screen.getByRole('button', { name: 'Classroom' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onBack).toHaveBeenCalled();
  });
});
