import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as leagueLib from '../lib/league';
import InstructorLeague from '../components/Dashboard/InstructorLeague';

vi.mock('../lib/league');

const COURSES = [
  { id: 'course-1', title: 'Course A' },
  { id: 'course-2', title: 'Course B' },
];

describe('InstructorLeague', () => {
  beforeEach(() => {
    // clearAllMocks (not restoreAllMocks) -- '../lib/league' is auto-mocked
    // via vi.mock() above; restoreAllMocks doesn't reset call history on
    // auto-mocked functions, only on vi.spyOn-created ones.
    vi.clearAllMocks();
    vi.mocked(leagueLib.fetchInstructorLeague).mockResolvedValue([
      { studentId: 's1', fullName: 'Jane Doe', totem: 'Black Stars', xp: 30, rank: 1 },
    ]);
  });

  it('defaults to the Global scope (all my courses combined)', async () => {
    render(<InstructorLeague courses={COURSES} />);
    await waitFor(() => expect(leagueLib.fetchInstructorLeague).toHaveBeenCalledWith(null));
    expect(await screen.findByText('30 XP')).toBeInTheDocument();
  });

  it('switching to Single course shows a course dropdown and fetches the first course', async () => {
    const user = userEvent.setup();
    render(<InstructorLeague courses={COURSES} />);
    await waitFor(() => expect(leagueLib.fetchInstructorLeague).toHaveBeenCalledWith(null));

    await user.click(screen.getByRole('button', { name: /single course/i }));

    await waitFor(() => expect(leagueLib.fetchInstructorLeague).toHaveBeenCalledWith('course-1'));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('re-fetches when the course dropdown selection changes', async () => {
    const user = userEvent.setup();
    render(<InstructorLeague courses={COURSES} />);
    await user.click(screen.getByRole('button', { name: /single course/i }));
    await waitFor(() => expect(leagueLib.fetchInstructorLeague).toHaveBeenCalledWith('course-1'));

    await user.selectOptions(screen.getByRole('combobox'), 'course-2');

    await waitFor(() => expect(leagueLib.fetchInstructorLeague).toHaveBeenCalledWith('course-2'));
  });

  it('shows a "create a course" message instead of a dropdown when the instructor has none', async () => {
    const user = userEvent.setup();
    render(<InstructorLeague courses={[]} />);
    await user.click(screen.getByRole('button', { name: /single course/i }));

    expect(await screen.findByText(/create a course to see its league/i)).toBeInTheDocument();
  });
});
