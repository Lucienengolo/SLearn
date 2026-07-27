import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import * as gamificationLib from '../lib/gamification';
import * as leagueLib from '../lib/league';
import League from '../components/Dashboard/League';

vi.mock('../lib/league');

function mockAuth() {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'student-1', email: 'jane@example.com' } as never,
    profile: { id: 'p1', full_name: 'Jane Doe', totem: 'Black Stars', role: 'student' } as never,
  } as never);
}

describe('League', () => {
  beforeEach(() => {
    // clearAllMocks (not restoreAllMocks) -- '../lib/league' is auto-mocked
    // via vi.mock() above, and restoreAllMocks doesn't reset call history on
    // those, only on vi.spyOn-created mocks; leftover call counts from a
    // prior test then break "not been called" assertions in later tests.
    vi.clearAllMocks();
    mockAuth();
    vi.spyOn(gamificationLib, 'fetchStudentProgress').mockResolvedValue({
      xp: 0,
      streakDays: 0,
      tier: 'Bronze',
      last7Days: [false, false, false, false, false, false, false],
      xpToNextTier: 100,
      tierProgressPct: 0,
    });
    vi.mocked(leagueLib.fetchStudentCourseOptions).mockResolvedValue([
      { courseId: 'course-1', title: 'Course A' },
      { courseId: 'course-2', title: 'Course B' },
    ]);
    vi.mocked(leagueLib.fetchGlobalLeague).mockResolvedValue([
      { studentId: 'student-1', fullName: 'Jane Doe', totem: 'Black Stars', xp: 30, rank: 1, isMe: true },
    ]);
    vi.mocked(leagueLib.fetchCourseLeague).mockResolvedValue([
      { studentId: 'student-1', fullName: 'Jane Doe', totem: 'Black Stars', xp: 10, rank: 1, isMe: true },
    ]);
  });

  it('defaults to the Global League tab', async () => {
    render(<League onBack={vi.fn()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(leagueLib.fetchGlobalLeague).toHaveBeenCalled());
    expect(await screen.findByText('30 XP')).toBeInTheDocument();
  });

  it('switching to Classroom League shows the course dropdown and fetches the first course by default', async () => {
    const user = userEvent.setup();
    render(<League onBack={vi.fn()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(leagueLib.fetchStudentCourseOptions).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /classroom league/i }));

    await waitFor(() => expect(leagueLib.fetchCourseLeague).toHaveBeenCalledWith('course-1'));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('re-fetches the classroom league when the dropdown selection changes', async () => {
    const user = userEvent.setup();
    render(<League onBack={vi.fn()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(leagueLib.fetchStudentCourseOptions).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /classroom league/i }));
    await waitFor(() => expect(leagueLib.fetchCourseLeague).toHaveBeenCalledWith('course-1'));

    await user.selectOptions(screen.getByRole('combobox'), 'course-2');

    await waitFor(() => expect(leagueLib.fetchCourseLeague).toHaveBeenCalledWith('course-2'));
  });

  it('shows an empty-state message instead of a dropdown when the student has no enrolled courses', async () => {
    vi.mocked(leagueLib.fetchStudentCourseOptions).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<League onBack={vi.fn()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(leagueLib.fetchStudentCourseOptions).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /classroom league/i }));

    expect(await screen.findByText(/enroll in a course to see its classroom league/i)).toBeInTheDocument();
    expect(leagueLib.fetchCourseLeague).not.toHaveBeenCalled();
  });
});
