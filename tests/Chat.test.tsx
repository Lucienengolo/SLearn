import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chat from '../components/Tutors/Chat';
import * as matchesLib from '../lib/matches';
import { LocaleProvider } from '../contexts/LocaleContext';
import { OfflineProvider } from '../contexts/OfflineContext';
import type { Match, ChatMessage, TutorRequest, Profile, TutorProfileFields } from '../lib/supabase';
import type { MatchContext } from '../lib/matches';
import type { ComponentProps } from 'react';

function renderChat(props: ComponentProps<typeof Chat>) {
  return render(
    <LocaleProvider>
      <OfflineProvider>
        <Chat {...props} />
      </OfflineProvider>
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

function makeMatch(overrides: Partial<Match> = {}): Match {
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
    created_at: '',
    ...overrides,
  };
}

function mockContext(match: Match): MatchContext {
  return { match, request: REQUEST, tutorProfile: TUTOR_PROFILE, tutorFields: TUTOR_FIELDS };
}

describe('Chat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows the tutor's accept/decline block when awaiting response, not the message composer", async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch({ status: 'matched' })));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);

    renderChat({ matchId: "match-1", currentUserId: "tutor-1", viewerRole: "tutor" });

    expect(await screen.findByRole('button', { name: /^accept$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Too far' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/write a message/i)).not.toBeInTheDocument();
  });

  it('calls acceptMatch when the tutor accepts', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch({ status: 'matched' })));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);
    const acceptSpy = vi.spyOn(matchesLib, 'acceptMatch').mockResolvedValue(undefined);

    renderChat({ matchId: "match-1", currentUserId: "tutor-1", viewerRole: "tutor" });

    await user.click(await screen.findByRole('button', { name: /^accept$/i }));
    expect(acceptSpy).toHaveBeenCalledWith('match-1');
  });

  it('declines with the specific reason chip clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch({ status: 'matched' })));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);
    const declineSpy = vi.spyOn(matchesLib, 'declineMatch').mockResolvedValue(undefined);

    renderChat({ matchId: "match-1", currentUserId: "tutor-1", viewerRole: "tutor" });

    await user.click(await screen.findByRole('button', { name: 'Schedule conflict' }));
    expect(declineSpy).toHaveBeenCalledWith('match-1', "Conflit d'horaire");
  });

  it('declines with no reason when the plain Décliner button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch({ status: 'matched' })));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);
    const declineSpy = vi.spyOn(matchesLib, 'declineMatch').mockResolvedValue(undefined);

    renderChat({ matchId: "match-1", currentUserId: "tutor-1", viewerRole: "tutor" });

    await user.click(await screen.findByRole('button', { name: /^decline$/i }));
    expect(declineSpy).toHaveBeenCalledWith('match-1', undefined);
  });

  it('shows an empty-state hint when there are no messages yet', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    expect(await screen.findByText(/send the first message/i)).toBeInTheDocument();
  });

  it('renders messages aligned by sender', async () => {
    const messages: ChatMessage[] = [
      { id: 'm1', match_id: 'match-1', sender_id: 'tutor-1', body: 'Bonjour', created_at: '' },
      { id: 'm2', match_id: 'match-1', sender_id: 'parent-1', body: 'Bonjour aussi', created_at: '' },
    ];
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue(messages);

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    expect(await screen.findByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText('Bonjour aussi')).toBeInTheDocument();
  });

  it('shows an inline retry affordance when sending a message fails, and retrying succeeds', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);
    const sendSpy = vi
      .spyOn(matchesLib, 'sendMessage')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ id: 'm1', match_id: 'match-1', sender_id: 'parent-1', body: 'Salut', created_at: '' });

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    const input = await screen.findByPlaceholderText(/write a message/i);
    await user.type(input, 'Salut');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(await screen.findByText(/failed to send/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/failed to send/i)).not.toBeInTheDocument());
  });

  // Regression: founder request, 2026-08-01 -- a user who opted into
  // offline mode and is currently offline should see a clear message
  // instead of the send silently failing/retrying against a dead network.
  it('blocks sending and shows a message when offline mode is enabled and the browser is offline', async () => {
    localStorage.setItem('slearn_offline_mode_enabled', 'true');
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);
    const sendSpy = vi.spyOn(matchesLib, 'sendMessage');

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    const input = await screen.findByPlaceholderText(/write a message/i);
    await user.type(input, 'Salut');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(await screen.findByText(/needs an internet connection/i)).toBeInTheDocument();
    expect(sendSpy).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  it('shows the session-date confirmation form while messaging with no confirmed date, and submits it', async () => {
    const user = userEvent.setup();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch({ confirmed_session_date: null })));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);
    const confirmSpy = vi.spyOn(matchesLib, 'confirmSessionDate').mockResolvedValue(undefined);

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    expect(await screen.findByText('Confirm the session date')).toBeInTheDocument();

    const dateInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    await user.type(dateInput, '2026-08-01T16:00');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith('match-1', new Date('2026-08-01T16:00')));
  });

  it('does not show the session-date form once a date is already confirmed', async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(
      mockContext(makeMatch({ confirmed_session_date: '2026-08-01T16:00:00.000Z' }))
    );
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    await screen.findByPlaceholderText(/write a message/i);
    expect(screen.queryByText('Confirm the session date')).not.toBeInTheDocument();
    expect(screen.getByText(/session confirmed/i)).toBeInTheDocument();
  });

  it("links to the tutor's WhatsApp number when the viewer is the parent", async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);

    renderChat({ matchId: "match-1", currentUserId: "parent-1", viewerRole: "parent" });

    const link = await screen.findByRole('link', { name: /continue on whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/237611111111');
  });

  it("links to the parent's WhatsApp number when the viewer is the tutor", async () => {
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);

    renderChat({ matchId: "match-1", currentUserId: "tutor-1", viewerRole: "tutor" });

    const link = await screen.findByRole('link', { name: /continue on whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/237600000000');
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    vi.spyOn(matchesLib, 'fetchMatchContext').mockResolvedValue(mockContext(makeMatch()));
    vi.spyOn(matchesLib, 'fetchMessages').mockResolvedValue([]);

    renderChat({ matchId: 'match-1', currentUserId: 'parent-1', viewerRole: 'parent' });

    expect(await screen.findByText(/envoyez le premier message/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continuer sur whatsapp/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
