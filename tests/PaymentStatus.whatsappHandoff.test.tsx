import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentStatus from '../components/Tutors/PaymentStatus';
import * as matchesLib from '../lib/matches';
import * as paymentsLib from '../lib/tutorPayments';
import * as settlementLib from '../lib/tutorBookingSettlement';
import { LocaleProvider } from '../contexts/LocaleContext';
import { ADMIN_WHATSAPP_NUMBER } from '../lib/adminContact';
import type { Match, TutorRequest, Profile, TutorProfileFields } from '../lib/supabase';
import type { MatchContext } from '../lib/matches';
import type { ComponentProps } from 'react';

function renderPaymentStatus(props: ComponentProps<typeof PaymentStatus>) {
  return render(
    <LocaleProvider>
      <PaymentStatus {...props} />
    </LocaleProvider>
  );
}

const REQUEST: TutorRequest = {
  id: 'req-1',
  parent_id: 'parent-1',
  category_id: 'cat-1',
  grade: '3ème',
  neighborhood: 'Bonamoussadi',
  budget_min: null,
  budget_max: null,
  budget_period: null,
  whatsapp_contact: '+237600000000',
  child_identifier: null,
  preferred_language: 'fr',
  status: 'matched',
  location_lat: null,
  location_lng: null,
  sessions_per_week: 2,
  created_at: '',
};

const TUTOR_PROFILE: Profile = {
  id: 'tutor-1',
  email: 't@example.com',
  full_name: 'Aïcha Mbarga',
  role: 'instructor',
  verified: true,
  is_reviewer: false,
  is_admin: false,
  avatar_url: null,
  bio: null,
  totem: null,
  created_at: '',
  updated_at: '',
};

const TUTOR_FIELDS: TutorProfileFields = {
  tutor_id: 'tutor-1',
  teaching_mode: 'both',
  neighborhood: 'Bonamoussadi',
  languages: ['fr'],
  rate_per_session: null,
  response_time_minutes: 30,
  whatsapp_contact: '+237611111111',
  created_at: '',
  updated_at: '',
};

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    request_id: 'req-1',
    tutor_id: 'tutor-1',
    status: 'messaging',
    matched_at: '',
    tutor_responded_at: null,
    tutor_timeout_at: null,
    decline_reason: null,
    messaging_started_at: null,
    parent_timeout_at: null,
    confirmed_session_date: null,
    deposit_paid_at: null,
    in_progress_at: null,
    completed_at: null,
    cancelled_at: null,
    stalled_at: null,
    tutor_dismissed_at: null,
    created_at: '',
    ...overrides,
  };
}

function mockContext(overrides: Partial<Match>, requestOverrides: Partial<TutorRequest> = {}): MatchContext {
  return {
    match: makeMatch(overrides),
    request: { ...REQUEST, ...requestOverrides },
    tutorProfile: TUTOR_PROFILE,
    tutorFields: TUTOR_FIELDS,
  };
}

// Regression: founder report, 2026-08-04 -- "tutor matching don't end...
// after a user finds a tutor and the tutor approves and schedules a date,
// the session never ends." Root cause: messaging + confirmed_session_date
// had no path forward while PAYMENTS_ENABLED=false -- the parent's only
// action was a "Pay deposit" button that always errors. Fix: once both
// parties have mutually agreed, hand off to the admin on WhatsApp instead.
describe('PaymentStatus WhatsApp-to-admin handoff (mutual agreement reached)', () => {
  beforeEach(() => {
    vi.spyOn(matchesLib, 'fetchMatchTutorEmail').mockResolvedValue('tutor@example.com');
  });

  it('shows the WhatsApp handoff CTA instead of Pay Deposit once a session date is confirmed', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    const link = await screen.findByRole('link', { name: /finalize on whatsapp/i });
    expect(link).toHaveAttribute('href', expect.stringContaining(ADMIN_WHATSAPP_NUMBER.replace(/[^\d]/g, '')));
    expect(screen.queryByRole('button', { name: /pay the deposit/i })).not.toBeInTheDocument();
  });

  // Founder request, 2026-08-06/07: the message the admin gets is exactly
  // tutor (name + phone + email combined), level, frequency, in-person
  // meetup session, the requester's own desired rate (never the tutor's
  // rate -- tutors no longer quote one), location if provided, reference.
  it('prefills the WhatsApp message with tutor name, phone and email, grade, neighborhood, frequency, date and a reference', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    const link = await screen.findByRole('link', { name: /finalize on whatsapp/i });
    const href = link.getAttribute('href') ?? '';
    const decodedText = decodeURIComponent(href.split('text=')[1] ?? '');

    expect(decodedText).toContain('Aïcha Mbarga');
    expect(decodedText).toContain('+237611111111');
    expect(decodedText).toContain('tutor@example.com');
    expect(decodedText).toContain('3ème');
    expect(decodedText).toContain('Bonamoussadi');
    expect(decodedText).toContain('2x/week');
    expect(decodedText).toContain('match-1');
  });

  it("shows the requester's desired rate with its period, never the tutor's own rate", async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(
      mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }, { budget_min: 8000, budget_max: 12000, budget_period: 'monthly' })
    );
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    const link = await screen.findByRole('link', { name: /finalize on whatsapp/i });
    const decodedText = decodeURIComponent((link.getAttribute('href') ?? '').split('text=')[1] ?? '');

    expect(decodedText).toContain('8');
    expect(decodedText).toContain('000');
    expect(decodedText).toContain('12');
    expect(decodedText).toMatch(/month/i);
  });

  it('falls back to a "to be negotiated" rate line when the parent left budget blank', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    const link = await screen.findByRole('link', { name: /finalize on whatsapp/i });
    const decodedText = decodeURIComponent((link.getAttribute('href') ?? '').split('text=')[1] ?? '');

    expect(decodedText).toMatch(/to be negotiated/i);
  });

  // Founder request, 2026-08-06: the admin should get a Google Maps link
  // straight to the family's home when one was shared, same link built by
  // lib/tutorRequests.ts's googleMapsLinkFor already used elsewhere.
  it('includes a Google Maps link in the WhatsApp message when the parent shared a location', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(
      mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }, { location_lat: 4.05, location_lng: 9.7 })
    );
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    const link = await screen.findByRole('link', { name: /finalize on whatsapp/i });
    const decodedText = decodeURIComponent((link.getAttribute('href') ?? '').split('text=')[1] ?? '');

    expect(decodedText).toContain('https://www.google.com/maps?q=4.05,9.7');
  });

  it('omits the location line when no location was shared', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    const link = await screen.findByRole('link', { name: /finalize on whatsapp/i });
    const decodedText = decodeURIComponent((link.getAttribute('href') ?? '').split('text=')[1] ?? '');

    expect(decodedText).not.toContain('google.com/maps');
  });

  it('shows the same WhatsApp handoff CTA for the tutor, not the passive waiting note', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'tutor' });

    expect(await screen.findByRole('link', { name: /finalize on whatsapp/i })).toBeInTheDocument();
    expect(screen.queryByText(/waiting for the parent's deposit/i)).not.toBeInTheDocument();
  });

  it('keeps showing the Pay Deposit button while messaging with no confirmed date yet', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: null }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    expect(await screen.findByRole('button', { name: /pay the deposit/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /finalize on whatsapp/i })).not.toBeInTheDocument();
  });
});

// Regression: founder feedback, 2026-08-05 -- closing a booking required a
// reviewer to act; the tutor, who actually knows payment was finalized on
// WhatsApp, should be able to close it themselves.
describe('PaymentStatus tutor self-confirm (closes the booking directly)', () => {
  beforeEach(() => {
    vi.spyOn(matchesLib, 'fetchMatchTutorEmail').mockResolvedValue('tutor@example.com');
  });

  it('shows a "Confirm payment received" button for the tutor only, which closes the booking', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);
    vi.spyOn(settlementLib, 'confirmManualPaymentReceived').mockResolvedValue(undefined);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'tutor' });

    const confirmButton = await screen.findByRole('button', { name: /confirm payment received/i });
    await user.click(confirmButton);

    expect(settlementLib.confirmManualPaymentReceived).toHaveBeenCalledWith('match-1');
  });

  it('does not show the confirm button to the parent', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext({ confirmed_session_date: '2026-09-01T10:00:00.000Z' }));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });

    await screen.findByRole('link', { name: /finalize on whatsapp/i });
    expect(screen.queryByRole('button', { name: /confirm payment received/i })).not.toBeInTheDocument();
  });
});
