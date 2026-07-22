import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentStatus from '../components/Tutors/PaymentStatus';
import * as matchesLib from '../lib/matches';
import * as paymentsLib from '../lib/tutorPayments';
import type { Match, TutorRequest, Profile, TutorProfileFields, TutorSessionPayment } from '../lib/supabase';
import type { MatchContext } from '../lib/matches';

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

function makePayment(overrides: Partial<TutorSessionPayment> = {}): TutorSessionPayment {
  return {
    id: 'pay-1',
    match_id: 'match-1',
    deposit_amount: 1600,
    deposit_status: 'pending',
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    balance_amount: 6400,
    balance_status: 'pending',
    balance_confirmed_at: null,
    balance_confirmed_by: null,
    cancellation_status: 'none',
    cancelled_at: null,
    refund_status: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('PaymentStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the "Payer l\'acompte" action for the parent when unpaid', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('messaging'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);

    expect(await screen.findByRole('button', { name: /payer l'acompte/i })).toBeInTheDocument();
    expect(screen.getByText(/1[\s ]600 FCFA/)).toBeInTheDocument();
  });

  it('shows a waiting message for the tutor when unpaid, not a pay button', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('messaging'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);

    render(<PaymentStatus matchId="match-1" viewerRole="tutor" />);

    expect(await screen.findByText(/en attente du paiement de l'acompte/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /payer l'acompte/i })).not.toBeInTheDocument();
  });

  it('redirects to the Stripe checkout URL when the parent pays the deposit', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('messaging'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);
    const checkoutSpy = vi.spyOn(paymentsLib, 'createDepositCheckout').mockResolvedValue('https://checkout.stripe.com/session-1');

    const originalLocation = window.location;
    const originalOrigin = originalLocation.origin;
    // jsdom's window.location can't be assigned directly (readonly in the
    // DOM lib types) -- redefining the property is the standard RTL/jsdom
    // workaround for asserting on a real navigation.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);
    await user.click(await screen.findByRole('button', { name: /payer l'acompte/i }));

    await waitFor(() => expect(checkoutSpy).toHaveBeenCalledWith('match-1', originalOrigin));
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-1'));

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('relabels the button to an explicit retry state when the deposit checkout fails, and retrying works', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('messaging'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(null);
    const checkoutSpy = vi
      .spyOn(paymentsLib, 'createDepositCheckout')
      .mockRejectedValueOnce(new Error('Stripe unreachable'))
      .mockResolvedValueOnce('https://checkout.stripe.com/session-2');

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, href: '' } });

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);
    await user.click(await screen.findByRole('button', { name: /payer l'acompte/i }));

    const retryButton = await screen.findByRole('button', { name: /le paiement a échoué — réessayer/i });
    expect(screen.getByText('Stripe unreachable')).toBeInTheDocument();

    await user.click(retryButton);

    await waitFor(() => expect(checkoutSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/session-2'));

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('shows the cancellation policy and a cancel action for the parent once the deposit is paid', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('deposit_paid'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(makePayment({ deposit_status: 'paid' }));

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);

    expect(await screen.findByRole('button', { name: /annuler la réservation/i })).toBeInTheDocument();
    expect(screen.getByText(/remboursement automatique et complet/i)).toBeInTheDocument();
  });

  it('does not show a cancel action once the booking is in_progress', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('in_progress'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(makePayment({ deposit_status: 'paid' }));

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);

    await screen.findByText(/vous n'avez rien à faire ici/i);
    expect(screen.queryByRole('button', { name: /annuler la réservation/i })).not.toBeInTheDocument();
  });

  it('calls cancelBooking when the parent cancels', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('deposit_paid'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(makePayment({ deposit_status: 'paid' }));
    const cancelSpy = vi.spyOn(paymentsLib, 'cancelBooking').mockResolvedValue({ path: 'cancelled_refunded' });

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);
    await user.click(await screen.findByRole('button', { name: /annuler la réservation/i }));

    expect(cancelSpy).toHaveBeenCalledWith('match-1');
  });

  it('shows the confirm-balance action for the tutor once in_progress', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('in_progress'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(makePayment({ deposit_status: 'paid' }));
    const confirmSpy = vi.spyOn(paymentsLib, 'confirmBalanceReceived').mockResolvedValue(undefined);

    render(<PaymentStatus matchId="match-1" viewerRole="tutor" />);
    await user.click(await screen.findByRole('button', { name: /confirmer la réception du solde/i }));

    expect(confirmSpy).toHaveBeenCalledWith('match-1');
  });

  it('shows a settled confirmation once completed', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('completed'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(
      makePayment({ deposit_status: 'paid', balance_status: 'confirmed' })
    );

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);
    expect(await screen.findByText(/réservation réglée/i)).toBeInTheDocument();
  });

  it('shows a refund-confirmed banner when cancelled_refunded', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('cancelled_refunded'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(
      makePayment({ cancellation_status: 'cancelled_refunded', refund_status: 'succeeded' })
    );

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);
    expect(await screen.findByText(/remboursement confirmé/i)).toBeInTheDocument();
  });

  it('shows an under-review banner when dispute_review', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext('dispute_review'));
    vi.spyOn(paymentsLib, 'fetchPaymentForMatch').mockResolvedValue(
      makePayment({ cancellation_status: 'dispute_review' })
    );

    render(<PaymentStatus matchId="match-1" viewerRole="parent" />);
    expect(await screen.findByText(/transmise à notre équipe pour examen/i)).toBeInTheDocument();
  });
});
