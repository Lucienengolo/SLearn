import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewQueue from '../components/Dashboard/ReviewQueue';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as applicationsLib from '../lib/instructorApplications';
import * as moderationLib from '../lib/courseModeration';
import * as settlementLib from '../lib/tutorBookingSettlement';

vi.mock('../lib/instructorApplications');
vi.mock('../lib/courseModeration');
vi.mock('../lib/tutorBookingSettlement');

function renderReviewQueue() {
  return render(
    <LocaleProvider>
      <ReviewQueue />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the reviewer queue (tabs, empty states, decision buttons) was
// hardcoded English regardless of the FR/EN toggle.
describe('ReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applicationsLib.fetchReviewQueue).mockResolvedValue([]);
    vi.mocked(applicationsLib.fetchDecidedApplications).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchPendingCourses).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchDecidedCourses).mockResolvedValue([]);
    vi.mocked(settlementLib.fetchPendingSettlements).mockResolvedValue([]);
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    renderReviewQueue();

    expect(await screen.findByText('Review queue')).toBeInTheDocument();
    expect(screen.getByText(/no applications waiting on a decision/i)).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderReviewQueue();

    expect(await screen.findByText('File de révision')).toBeInTheDocument();
    expect(screen.getByText(/aucune candidature en attente de décision/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

// Regression: founder report, 2026-08-04 -- tutor bookings had no way to be
// manually closed out once mutually agreed and finalized on WhatsApp with
// the admin (see PaymentStatus.whatsappHandoff.test.tsx), short of direct DB
// access. This "minimal settle action" surface lives here.
describe('ReviewQueue tutor-bookings settlement section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applicationsLib.fetchReviewQueue).mockResolvedValue([]);
    vi.mocked(applicationsLib.fetchDecidedApplications).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchPendingCourses).mockResolvedValue([]);
    vi.mocked(moderationLib.fetchDecidedCourses).mockResolvedValue([]);
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
  });

  it('lists pending settlements and settles one on click', async () => {
    const user = userEvent.setup();
    vi.mocked(settlementLib.settleMatch).mockResolvedValue(undefined);

    renderReviewQueue();

    await user.click(await screen.findByRole('button', { name: /tutor bookings/i }));

    expect(await screen.findByText(/parent one/i)).toBeInTheDocument();
    expect(screen.getByText(/tutor one/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pending/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mark as settled/i }));

    expect(settlementLib.settleMatch).toHaveBeenCalledWith('match-1');
  });

  // Regression: founder report, 2026-08-05 -- clicking a "booking
  // follow-up" notification (admin/matches/* link) landed on a blank
  // screen; App.tsx's handleNavigate now sets window.location.hash =
  // 'tutor-bookings' before routing to 'review-queue', so this should open
  // straight to Tutor Bookings instead of defaulting to Applications.
  it('opens straight to Tutor Bookings when deep-linked via hash', async () => {
    window.location.hash = 'tutor-bookings';

    renderReviewQueue();

    expect(await screen.findByText(/parent one/i)).toBeInTheDocument();
    expect(screen.queryByText(/no applications waiting/i)).not.toBeInTheDocument();

    window.location.hash = '';
  });
});
