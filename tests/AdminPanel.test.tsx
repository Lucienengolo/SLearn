import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from '../components/Dashboard/AdminPanel';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as authContext from '../contexts/AuthContext';
import * as instructorsLib from '../lib/instructors';
import * as adminCoursesLib from '../lib/adminCourses';
import * as adminDisputesLib from '../lib/adminDisputes';
import * as adminBroadcastLib from '../lib/adminBroadcast';
import * as adminAuditLogLib from '../lib/adminAuditLog';

vi.mock('../lib/instructors');
vi.mock('../lib/adminCourses');
vi.mock('../lib/adminDisputes');
vi.mock('../lib/adminBroadcast');
vi.mock('../lib/adminAuditLog');

function renderAdminPanel() {
  return render(
    <LocaleProvider>
      <AdminPanel />
    </LocaleProvider>
  );
}

function mockAuth(email: string) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'me' },
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
    vi.mocked(instructorsLib.fetchInstructorNotes).mockResolvedValue([]);
    vi.mocked(adminCoursesLib.fetchAllCoursesAdmin).mockResolvedValue([]);
    vi.mocked(adminDisputesLib.fetchAllMatchesAdmin).mockResolvedValue([]);
    vi.mocked(adminAuditLogLib.fetchAdminActionLog).mockResolvedValue([]);
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

  it('deactivates an active instructor once expanded', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(instructorsLib.deactivateInstructor).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByText('Active One'));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    expect(instructorsLib.deactivateInstructor).toHaveBeenCalledWith('i-1');
  });

  it('reactivates a deactivated instructor once expanded', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(instructorsLib.reactivateInstructor).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByText('Inactive One'));
    await user.click(screen.getByRole('button', { name: /^reactivate$/i }));

    expect(instructorsLib.reactivateInstructor).toHaveBeenCalledWith('i-2');
  });

  it('sends a notification to an instructor once expanded', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(instructorsLib.notifyInstructor).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByText('Active One'));
    await user.type(screen.getByPlaceholderText(/title/i), 'Warning');
    await user.type(screen.getByPlaceholderText(/message/i), 'Please grade on time.');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(instructorsLib.notifyInstructor).toHaveBeenCalledWith('i-1', 'Warning', 'Please grade on time.');
  });

  it('adds an internal note to an instructor once expanded', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(instructorsLib.addInstructorNote).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByText('Active One'));
    await user.type(screen.getByPlaceholderText(/add an internal note/i), 'Warned about late grading');
    await user.click(screen.getByRole('button', { name: /^add note$/i }));

    expect(instructorsLib.addInstructorNote).toHaveBeenCalledWith('i-1', 'me', 'Warned about late grading');
  });

  it('lists published courses and unpublishes one on click', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(adminCoursesLib.fetchAllCoursesAdmin).mockResolvedValue([
      { id: 'c-1', title: 'Intro to SQL', instructor_name: 'Aïcha Mbarga', is_published: true, created_at: '2026-08-01T00:00:00Z' },
    ]);
    vi.mocked(adminCoursesLib.setCoursePublished).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByRole('button', { name: /courses/i }));
    expect(await screen.findByText('Intro to SQL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /unpublish/i }));

    expect(adminCoursesLib.setCoursePublished).toHaveBeenCalledWith('c-1', false);
  });

  it('lists matches and only shows resolution buttons for dispute_review ones', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(adminDisputesLib.fetchAllMatchesAdmin).mockResolvedValue([
      { match_id: 'm-1', status: 'dispute_review', confirmed_session_date: '2026-08-10T10:00:00Z', parent_name: 'Parent X', tutor_name: 'Tutor X', created_at: '' },
      { match_id: 'm-2', status: 'completed', confirmed_session_date: null, parent_name: 'Parent Y', tutor_name: 'Tutor Y', created_at: '' },
    ]);
    vi.mocked(adminDisputesLib.resolveDispute).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByRole('button', { name: /^matches$/i }));
    expect(await screen.findByText(/parent x/i)).toBeInTheDocument();
    expect(screen.getByText(/parent y/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /mark completed/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /refund parent/i }));

    expect(adminDisputesLib.resolveDispute).toHaveBeenCalledWith('m-1', 'cancelled_refunded');
  });

  it('sends a broadcast to the selected audience', async () => {
    const user = userEvent.setup();
    mockAuth('regular-admin@example.com');
    vi.mocked(adminBroadcastLib.broadcastAnnouncement).mockResolvedValue(undefined);

    renderAdminPanel();

    await user.click(await screen.findByRole('button', { name: /broadcast/i }));
    await user.click(await screen.findByRole('button', { name: /^students$/i }));
    await user.type(screen.getByPlaceholderText(/title/i), 'Maintenance');
    await user.type(screen.getByPlaceholderText(/message/i), 'Site down 10-11pm');
    const broadcastButtons = screen.getAllByRole('button', { name: /^broadcast$/i });
    await user.click(broadcastButtons[broadcastButtons.length - 1]);

    expect(adminBroadcastLib.broadcastAnnouncement).toHaveBeenCalledWith('students', 'Maintenance', 'Site down 10-11pm');
  });

  it('shows the admin action log', async () => {
    mockAuth('regular-admin@example.com');
    vi.mocked(adminAuditLogLib.fetchAdminActionLog).mockResolvedValue([
      { id: 'l-1', admin_name: 'Admin One', action: 'deactivate_instructor', target_type: 'profile', target_id: 'i-1', detail: null, created_at: '2026-08-06T00:00:00Z' },
    ]);
    const user = userEvent.setup();

    renderAdminPanel();

    await user.click(await screen.findByRole('button', { name: /activity log/i }));

    expect(await screen.findByText(/admin one/i)).toBeInTheDocument();
    expect(screen.getByText(/deactivate_instructor/i)).toBeInTheDocument();
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
