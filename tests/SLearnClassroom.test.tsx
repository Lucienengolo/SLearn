import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import * as learnersLib from '../lib/instructorLearners';
import * as classworkLib from '../lib/classwork';
import * as leagueLib from '../lib/league';
import SLearnClassroom from '../components/Dashboard/SLearnClassroom';
import { ToastProvider } from '../contexts/ToastContext';
import type { Course } from '../lib/supabase';
import type { LearnerRow } from '../lib/instructorLearners';

vi.mock('../lib/classwork');
vi.mock('../lib/league');

function renderClassroom(onBack = vi.fn()) {
  return render(
    <ToastProvider>
      <SLearnClassroom onBack={onBack} />
    </ToastProvider>
  );
}

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
    vi.clearAllMocks();
    mockAuth();
    vi.mocked(classworkLib.fetchClassworkPosts).mockResolvedValue([]);
    vi.mocked(leagueLib.fetchInstructorLeague).mockResolvedValue([]);
  });

  it('shows an empty state when the instructor has no courses', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({ courses: [], rows: [], totalQuizAttempts: 0 });
    renderClassroom();

    expect(await screen.findByText(/no courses yet/i)).toBeInTheDocument();
  });

  it('renders the title and all 5 workspace sections', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({ courses: [COURSE_A], rows: [], totalQuizAttempts: 0 });
    renderClassroom();

    expect(await screen.findByText('S@Learn Classroom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stream' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Classwork' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'League' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tutor Matches' })).toBeInTheDocument();
  });

  it('defaults to the Stream section, showing the post composer', async () => {
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({ courses: [COURSE_A], rows: [], totalQuizAttempts: 0 });
    renderClassroom();

    expect(await screen.findByPlaceholderText(/title/i)).toBeInTheDocument();
    await waitFor(() => expect(classworkLib.fetchClassworkPosts).toHaveBeenCalledWith(['course-1']));
  });

  describe('People section', () => {
    async function renderPeople() {
      const user = userEvent.setup();
      renderClassroom();
      await screen.findByText('S@Learn Classroom');
      await user.click(screen.getByRole('button', { name: 'People' }));
      return user;
    }

    it('renders aggregated stat tiles across all courses', async () => {
      vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
        courses: [COURSE_A, COURSE_B],
        rows: [
          makeRow({ enrollmentId: 'enr-1', studentId: 'student-1', completedAt: '2026-07-10T00:00:00Z', hasCertificate: true }),
          makeRow({
            enrollmentId: 'enr-2',
            studentId: 'student-2',
            courseId: 'course-2',
            courseTitle: 'Course B',
            fullName: 'John Roe',
            email: 'john@example.com',
          }),
        ],
        totalQuizAttempts: 12,
      });
      await renderPeople();

      expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
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
      await renderPeople();

      expect(await screen.findByRole('img', { name: /Course A: 40% average progress/i })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /Course B: 80% average progress/i })).toBeInTheDocument();
    });

    it('opens Add Student with every course available as an option', async () => {
      vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({
        courses: [COURSE_A, COURSE_B],
        rows: [makeRow()],
        totalQuizAttempts: 0,
      });
      const user = await renderPeople();
      await screen.findByText('Jane Doe');

      await user.click(screen.getByRole('button', { name: /add student/i }));
      expect(screen.getByRole('dialog', { name: /add student/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Course A' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Course B' })).toBeInTheDocument();
    });
  });

  it('League section renders without crashing', async () => {
    const user = userEvent.setup();
    vi.spyOn(learnersLib, 'fetchInstructorLearners').mockResolvedValue({ courses: [COURSE_A], rows: [], totalQuizAttempts: 0 });
    renderClassroom();
    await screen.findByText('S@Learn Classroom');

    await user.click(screen.getByRole('button', { name: 'League' }));
    expect(screen.getByText(/all my courses/i)).toBeInTheDocument();
  });
});
