import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentStatus from '../components/Tutors/PaymentStatus';
import * as matchesLib from '../lib/matches';
import * as paymentsLib from '../lib/tutorPayments';
import { LocaleProvider } from '../contexts/LocaleContext';
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
  whatsapp_contact: '+237600000000',
  child_identifier: null,
  preferred_language: 'fr',
  status: 'matched',
  location_lat: null,
  location_lng: null,
  created_at: '',
};

const TUTOR_PROFILE: Profile = {
  id: 'tutor-1',
  email: 't@example.com',
  full_name: 'Aïcha Mbarga',
  role: 'instructor',
  verified: true,
  is_reviewer: false,
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
  rate_per_session: 8000,
  response_time_minutes: 30,
  whatsapp_contact: '+237611111111',
  created_at: '',
  updated_at: '',
};

function makeMatch(status: Match['status']): Match {
  return {
    id: 'match-1',
    request_id: 'req-1',
    tutor_id: 'tutor-1',
    status,
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
    created_at: '',
  };
}

function mockContext(status: Match['status']): MatchContext {
  return { match: makeMatch(status), request: REQUEST, tutorProfile: TUTOR_PROFILE, tutorFields: TUTOR_FIELDS };
}

// Regression: founder decision, 2026-08-01 -- real payment processing is
// disabled for V1 (lib/paymentsConfig.ts's PAYMENTS_ENABLED, false by
// default, not mocked in this file -- unlike PaymentStatus.test.tsx). The
// deposit button stays visible per the founder's explicit "keep it on
// visually" instruction, but clicking it must show an informational
// message instead of ever reaching Stripe.
describe('PaymentStatus payments-disabled gate (V1 default)', () => {
  it('shows a "coming soon" message instead of starting checkout when clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('messaging'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);
    const checkoutSpy = vi.spyOn(paymentsLib, 'createDepositCheckout');

    renderPaymentStatus({ matchId: 'match-1', viewerRole: 'parent' });
    await user.click(await screen.findByRole('button', { name: /pay the deposit/i }));

    expect(await screen.findByText(/isn't available yet/i)).toBeInTheDocument();
    expect(checkoutSpy).not.toHaveBeenCalled();
  });
});
