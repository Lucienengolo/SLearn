import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from '../components/Dashboard/AdminPanel';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as authContext from '../contexts/AuthContext';
import * as instructorsLib from '../lib/instructors';

vi.mock('../lib/instructors');

function renderAdminPanel() {
  return render(
    <LocaleProvider>
      <AdminPanel />
    </LocaleProvider>
  );
}

function mockAuth(email: string) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    profile: { id: 'me', email, is_admin: true },
  } as never);
}

const INSTRUCTORS = [
  { id: 'i-1', email: 'active@example.com', full_name: 'Active One', verified: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'i-2', email: 'inactive@example.com', full_name: 'Inactive One', verified: false, created_at: '2026-08-02T00:00:00Z' },
];

// Regression: founder report, 2026-08-05 -- "app shows 3 instructors" when
// only 1 was really registered, with no way to see or manage already-
// approved instructors. This page is the fix: any admin sees/manages the
// instructor directory; only the principal admin (storefix237@gmail.com)
// also sees the Admin Access section.
describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(instructorsLib.fetchAllInstructors).mockResolvedValue(INSTRUCTORS);
  });

  it('lists instructors with their status for a non-principal admin, with no Admin Access tab', async () => {
    mockAuth('regular-admin@example.com');

    renderAdminPanel();

    expect(await screen.findByText('Active One')).toBeInTheDocument();
    expect(screen.getByText('Inactive One')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin access/i })).not.toBeInTheDocument();
  });

  it('deactivates an active instructor on click', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(instructorsLib.deactivateInstructor).mockResolvedValue(undefined);

    renderAdminPanel();

    await screen.findByText('Active One');
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    expect(instructorsLib.deactivateInstructor).toHaveBeenCalledWith('i-1');
  });

  it('reactivates a deactivated instructor on click', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(instructorsLib.reactivateInstructor).mockResolvedValue(undefined);

    renderAdminPanel();

    await screen.findByText('Inactive One');
    await user.click(screen.getByRole('button', { name: /^reactivate$/i }));

    expect(instructorsLib.reactivateInstructor).toHaveBeenCalledWith('i-2');
  });

  it('shows the Admin Access section only for the principal admin, and grants access on submit', async () => {
    const user = userEvent.setup();
    mockAuth('storefix237@gmail.com');
    vi.mocked(instructorsLib.setAdminAccess).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByRole('button', { name: /admin access/i }));
    await user.type(screen.getByLabelText(/account email/i), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /grant access/i }));

    expect(instructorsLib.setAdminAccess).toHaveBeenCalledWith('someone@example.com', true);
  });
});
