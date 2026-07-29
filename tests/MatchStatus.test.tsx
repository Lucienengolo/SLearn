import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchStatus from '../components/Tutors/MatchStatus';
import * as matchesLib from '../lib/matches';
import * as tutorRequestsLib from '../lib/tutorRequests';
import type { TutorRequest } from '../lib/supabase';

vi.mock('../components/Tutors/Chat', () => ({
  default: ({ matchId }: { matchId: string }) => <div data-testid="chat-mock">Chat for {matchId}</div>,
}));
vi.mock('../components/Tutors/PaymentStatus', () => ({
  default: ({ matchId }: { matchId: string }) => <div data-testid="payment-status-mock">Payment for {matchId}</div>,
}));
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({ data: [{ id: 'cat-1', name: 'Mathématiques', description: null, created_at: '' }] })
        ),
      })),
    })),
  },
}));

const SAMPLE_REQUEST: TutorRequest = {
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
  status: 'searching',
  location_lat: null,
  location_lng: null,
  created_at: '',
};

function renderMatchStatus(onCancelled = vi.fn()) {
  return render(<MatchStatus requestId="req-1" currentUserId="parent-1" onCancelled={onCancelled} />);
}

describe('MatchStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the still-looking screen with no prior-match message on a first visit', async () => {
    vi.spyOn(matchesLib, 'fetchRequestMatchState').mockResolvedValue({
      request: SAMPLE_REQUEST,
      activeMatch: null,
      hadPriorMatch: false,
    });

    renderMatchStatus();

    expect(await screen.findByText('On cherche toujours votre tuteur')).toBeInTheDocument();
    expect(screen.queryByText(/précédent match/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-mock')).not.toBeInTheDocument();
  });

  it('shows the D5 transparency message when a prior match already timed out or was declined', async () => {
    vi.spyOn(matchesLib, 'fetchRequestMatchState').mockResolvedValue({
      request: SAMPLE_REQUEST,
      activeMatch: null,
      hadPriorMatch: true,
    });

    renderMatchStatus();

    expect(await screen.findByText(/précédent match n'a pas abouti/i)).toBeInTheDocument();
  });

  it('renders Chat and PaymentStatus together instead of the still-looking screen once a match is active', async () => {
    vi.spyOn(matchesLib, 'fetchRequestMatchState').mockResolvedValue({
      request: { ...SAMPLE_REQUEST, status: 'matched' },
      activeMatch: {
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
        created_at: '',
      },
      hadPriorMatch: false,
    });

    renderMatchStatus();

    expect(await screen.findByTestId('chat-mock')).toHaveTextContent('match-1');
    expect(screen.getByTestId('payment-status-mock')).toHaveTextContent('match-1');
    expect(screen.queryByText('On cherche toujours votre tuteur')).not.toBeInTheDocument();
  });

  it('retries matching and reloads state when the retry button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchRequestMatchState').mockResolvedValue({
      request: SAMPLE_REQUEST,
      activeMatch: null,
      hadPriorMatch: false,
    });
    const matchSpy = vi.spyOn(tutorRequestsLib, 'matchTutorRequest').mockResolvedValue({ matched: false });

    renderMatchStatus();

    await user.click(await screen.findByRole('button', { name: /réessayer la recherche/i }));

    await waitFor(() => expect(matchSpy).toHaveBeenCalledWith('req-1'));
    expect(matchesLib.fetchRequestMatchState).toHaveBeenCalledTimes(2);
  });

  it('opens an edit panel pre-filled with the request, and saves changes via updateTutorRequest', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchRequestMatchState').mockResolvedValue({
      request: SAMPLE_REQUEST,
      activeMatch: null,
      hadPriorMatch: false,
    });
    const updateSpy = vi.spyOn(tutorRequestsLib, 'updateTutorRequest').mockResolvedValue(undefined);

    renderMatchStatus();
    await user.click(await screen.findByRole('button', { name: /modifier la demande/i }));

    const gradeInput = await screen.findByLabelText(/niveau/i);
    expect(gradeInput).toHaveValue('3ème');
    await user.clear(gradeInput);
    await user.type(gradeInput, '4ème');

    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('req-1', expect.objectContaining({ grade: '4ème' }))
    );
  });

  it('cancels the request via a confirm dialog and calls onCancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchRequestMatchState').mockResolvedValue({
      request: SAMPLE_REQUEST,
      activeMatch: null,
      hadPriorMatch: false,
    });
    const cancelSpy = vi.spyOn(tutorRequestsLib, 'cancelTutorRequest').mockResolvedValue(undefined);
    const onCancelled = vi.fn();

    renderMatchStatus(onCancelled);
    await user.click(await screen.findByRole('button', { name: /supprimer la demande/i }));

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /supprimer la demande/i }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith('req-1'));
    expect(onCancelled).toHaveBeenCalled();
  });
});
