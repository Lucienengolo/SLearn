import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminDashboard from '../components/Dashboard/AdminDashboard';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as authContext from '../contexts/AuthContext';
import * as applicationsLib from '../lib/instructorApplications';
import * as moderationLib from '../lib/courseModeration';
import * as settlementLib from '../lib/tutorBookingSettlement';
import * as instructorsLib from '../lib/instructors';
import * as adminCoursesLib from '../lib/adminCourses';
import * as adminDisputesLib from '../lib/adminDisputes';
import * as adminBroadcastLib from '../lib/adminBroadcast';
import * as adminAuditLogLib from '../lib/adminAuditLog';

vi.mock('../lib/instructorApplications');
vi.mock('../lib/courseModeration');
vi.mock('../lib/tutorBookingSettlement');
vi.mock('../lib/instructors');
vi.mock('../lib/adminCourses');
vi.mock('../lib/adminDisputes');
vi.mock('../lib/adminBroadcast');
vi.mock('../lib/adminAuditLog');

function renderDashboard() {
  return render(
    <LocaleProvider>
      <AdminDashboard />
    </LocaleProvider>
  );
}

function mockAuth(overrides: { isReviewer?: boolean; isAdmin?: boolean; email?: string } = {}) {
  vi.spyOn(authContext, 'useAuth').mockReturnValue({
    user: { id: 'me' },
    profile: { id: 'me', email: overrides.email ?? 'someone@example.com', is_reviewer: !!overrides.isReviewer, is_admin: !!overrides.isAdmin },
  } as never);
}

// Founder feedback, 2026-08-06: Review Queue (is_reviewer: applications,
// course moderation, pending settlements) and Admin Panel (is_admin:
// instructors, published courses, all matches, broadcast, activity log,
// admin access) were two separate pages/nav items -- the founder's own
// account (both flags, from before this session) kept looking for new
// admin features on the page it already knew and found nothing. Merged
// into one page; each section still gated by whichever flag it needs.
describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applicationsLib.fetchReviewQueue).mockResolvedValue([]);
    vi.mocked(applicationsLib.fetchDecidedApplications).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchPendingCourses).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchDecidedCourses).mockResolvedValue([]);
    vi.mocked(settlementLib.fetchPendingSettlements).mockResolvedValue([]);
    vi.mocked(instructorsLib.fetchAllInstructors).mockResolvedValue([]);
    vi.mocked(instructorsLib.fetchInstructorNotes).mockResolvedValue([]);
    vi.mocked(adminCoursesLib.fetchAllCoursesAdmin).mockResolvedValue([]);
    vi.mocked(adminDisputesLib.fetchAllMatchesAdmin).mockResolvedValue([]);
    vi.mocked(adminAuditLogLib.fetchAdminActionLog).mockResolvedValue([]);
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    mockAuth({ isReviewer: true });

    renderDashboard();

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText(/no applications waiting on a decision/i)).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    mockAuth({ isReviewer: true });

    renderDashboard();

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText(/aucune candidature en attente de décision/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('shows only reviewer sections for a reviewer-only account', async () => {
    mockAuth({ isReviewer: true });

    renderDashboard();

    await screen.findByRole('button', { name: /instructor applications/i });
    expect(screen.getByRole('button', { name: /^courses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tutor bookings/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^instructors/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /broadcast/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activity log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin access/i })).not.toBeInTheDocument();
  });

  it('shows only admin sections for an admin-only, non-principal account', async () => {
    mockAuth({ isAdmin: true });

    renderDashboard();

    await screen.findByRole('button', { name: /^instructors/i });
    expect(screen.getByRole('button', { name: /matches/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /broadcast/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activity log/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /instructor applications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tutor bookings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin access/i })).not.toBeInTheDocument();
  });

  it('shows every section (including Admin Access) for the principal admin who is also a reviewer', async () => {
    mockAuth({ isReviewer: true, isAdmin: true, email: 'storefix237@gmail.com' });

    renderDashboard();

    await screen.findByRole('button', { name: /instructor applications/i });
    expect(screen.getByRole('button', { name: /^instructors/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /admin access/i })).toBeInTheDocument();
  });

  it('lists pending settlements and settles one on click', async () => {
    const user = userEvent.setup();
    mockAuth({ isReviewer: true });
    vi.mocked(settlementLib.fetchPendingSettlements).mockResolvedValue([
      {
        match_id: 'match-1',
        confirmed_session_date: '2026-09-01T10:00:00.000Z',
        parent_name: 'Parent One',
        parent_whatsapp: '+237600000000',
        tutor_name: 'Tutor One',
        tutor_whatsapp: '+237611111111',
        rate_per_session: 8000,
      },
    ]);
    vi.mocked(settlementLib.settleMatch).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /tutor bookings/i }));
    expect(await screen.findByText(/parent one/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mark as settled/i }));

    expect(settlementLib.settleMatch).toHaveBeenCalledWith('match-1');
  });

  // Regression: founder report, 2026-08-05 -- clicking a "booking
  // follow-up" notification landed on a blank screen; App.tsx now sets
  // window.location.hash = 'tutor-bookings' before routing to
  // 'admin-dashboard', so a reviewer should land straight on Pending
  // Settlements instead of defaulting to Applications.
  it('opens straight to Pending Settlements when deep-linked via hash', async () => {
    window.location.hash = 'tutor-bookings';
    mockAuth({ isReviewer: true });
    vi.mocked(settlementLib.fetchPendingSettlements).mockResolvedValue([
      {
        match_id: 'match-1',
        confirmed_session_date: '2026-09-01T10:00:00.000Z',
        parent_name: 'Parent One',
        parent_whatsapp: '+237600000000',
        tutor_name: 'Tutor One',
        tutor_whatsapp: '+237611111111',
        rate_per_session: 8000,
      },
    ]);

    renderDashboard();

    expect(await screen.findByText(/parent one/i)).toBeInTheDocument();
    expect(screen.queryByText(/no applications waiting/i)).not.toBeInTheDocument();

    window.location.hash = '';
  });

  it('deactivates an active instructor once expanded', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true });
    vi.mocked(instructorsLib.fetchAllInstructors).mockResolvedValue([
      { id: 'i-1', email: 'active@example.com', full_name: 'Active One', verified: true, created_at: '' },
    ]);
    vi.mocked(instructorsLib.deactivateInstructor).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByText('Active One'));
    await user.click(screen.getByRole('button', { name: /^deactivate$/i }));

    expect(instructorsLib.deactivateInstructor).toHaveBeenCalledWith('i-1');
  });

  it('sends a notification to an instructor once expanded', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true });
    vi.mocked(instructorsLib.fetchAllInstructors).mockResolvedValue([
      { id: 'i-1', email: 'active@example.com', full_name: 'Active One', verified: true, created_at: '' },
    ]);
    vi.mocked(instructorsLib.notifyInstructor).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByText('Active One'));
    await user.type(screen.getByPlaceholderText(/title/i), 'Warning');
    await user.type(screen.getByPlaceholderText(/message/i), 'Please grade on time.');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(instructorsLib.notifyInstructor).toHaveBeenCalledWith('i-1', 'Warning', 'Please grade on time.');
  });

  it('lists published courses and unpublishes one on click', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true });
    vi.mocked(adminCoursesLib.fetchAllCoursesAdmin).mockResolvedValue([
      { id: 'c-1', title: 'Intro to SQL', instructor_name: 'Aïcha Mbarga', is_published: true, created_at: '' },
    ]);
    vi.mocked(adminCoursesLib.setCoursePublished).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /^courses/i }));
    expect(await screen.findByText('Intro to SQL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /unpublish/i }));

    expect(adminCoursesLib.setCoursePublished).toHaveBeenCalledWith('c-1', false);
  });

  it('lists matches and only shows resolution buttons for dispute_review ones', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true });
    vi.mocked(adminDisputesLib.fetchAllMatchesAdmin).mockResolvedValue([
      { match_id: 'm-1', status: 'dispute_review', confirmed_session_date: '2026-08-10T10:00:00Z', parent_name: 'Parent X', tutor_name: 'Tutor X', created_at: '' },
      { match_id: 'm-2', status: 'completed', confirmed_session_date: null, parent_name: 'Parent Y', tutor_name: 'Tutor Y', created_at: '' },
    ]);
    vi.mocked(adminDisputesLib.resolveDispute).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /matches/i }));
    expect(await screen.findByText(/parent x/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /mark completed/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /refund parent/i }));

    expect(adminDisputesLib.resolveDispute).toHaveBeenCalledWith('m-1', 'cancelled_refunded');
  });

  it('sends a broadcast to the selected audience', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true });
    vi.mocked(adminBroadcastLib.broadcastAnnouncement).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /broadcast/i }));
    await user.click(await screen.findByRole('button', { name: /^students$/i }));
    await user.type(screen.getByPlaceholderText(/title/i), 'Maintenance');
    await user.type(screen.getByPlaceholderText(/message/i), 'Site down 10-11pm');
    const broadcastButtons = screen.getAllByRole('button', { name: /^broadcast$/i });
    await user.click(broadcastButtons[broadcastButtons.length - 1]);

    expect(adminBroadcastLib.broadcastAnnouncement).toHaveBeenCalledWith('students', 'Maintenance', 'Site down 10-11pm');
  });

  it('shows the admin action log', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true });
    vi.mocked(adminAuditLogLib.fetchAdminActionLog).mockResolvedValue([
      { id: 'l-1', admin_name: 'Admin One', action: 'deactivate_instructor', target_type: 'profile', target_id: 'i-1', detail: null, created_at: '2026-08-06T00:00:00Z' },
    ]);

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /activity log/i }));

    expect(await screen.findByText(/admin one/i)).toBeInTheDocument();
    expect(screen.getByText(/deactivate_instructor/i)).toBeInTheDocument();
  });

  it('grants admin access from the Admin Access section, visible only to the principal admin', async () => {
    const user = userEvent.setup();
    mockAuth({ isAdmin: true, email: 'storefix237@gmail.com' });
    vi.mocked(instructorsLib.setAdminAccess).mockResolvedValue(undefined);

    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /admin access/i }));
    await user.type(screen.getByLabelText(/account email/i), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: /grant access/i }));

    expect(instructorsLib.setAdminAccess).toHaveBeenCalledWith('someone@example.com', true);
  });
});
