import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorMatches from '../components/Tutors/TutorMatches';
import * as tutorProfileLib from '../lib/tutorProfile';
import * as matchesLib from '../lib/matches';
import type { TutorProfileFields } from '../lib/supabase';
import type { TutorMatchListItem } from '../lib/matches';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { ComponentProps } from 'react';

function renderTutorMatches(props: ComponentProps<typeof TutorMatches>) {
  return render(
    <LocaleProvider>
      <TutorMatches {...props} />
    </LocaleProvider>
  );
}

vi.mock('../components/Tutors/TutorProfileForm', () => ({
  default: ({ onSaved }: { onSaved: () => void }) => (
    <div>
      <p>PROFILE FORM MOCK</p>
      <button onClick={onSaved}>save</button>
    </div>
  ),
}));

const PROFILE: TutorProfileFields = {
  tutor_id: 'tutor-1',
  teaching_mode: 'both',
  neighborhood: 'Bonamoussadi',
  languages: ['fr'],
  rate_per_session: 8000,
  response_time_minutes: 60,
  whatsapp_contact: '+237611111111',
  created_at: '',
  updated_at: '',
};

describe('TutorMatches', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the profile setup form when no tutor_profile_fields exists yet', async () => {
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(null);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([]);

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch: vi.fn() });

    expect(await screen.findByText('PROFILE FORM MOCK')).toBeInTheDocument();
  });

  it('shows a warm empty state when the profile exists but there are no matches yet', async () => {
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([]);

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch: vi.fn() });

    expect(await screen.findByText(/you'll appear here/i)).toBeInTheDocument();
    expect(screen.getByText(/Bonamoussadi/)).toBeInTheDocument();
  });

  it('lists matches with subject, status, and neighborhood, and selecting one calls onSelectMatch', async () => {
    const user = userEvent.setup();
    const match: TutorMatchListItem = {
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
      tutor_requests: {
        id: 'req-1',
        parent_id: 'parent-1',
        category_id: 'cat-1',
        grade: '3ème',
        neighborhood: 'Akwa',
        budget_min: null,
        budget_max: null,
        budget_period: null,
        whatsapp_contact: '+237600000000',
        child_identifier: 'Junior',
        preferred_language: 'fr',
        status: 'matched',
        location_lat: null,
        location_lng: null,
        sessions_per_week: 2,
        created_at: '',
        categories: { name: 'Maths' },
      },
    };
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([match]);
    const onSelectMatch = vi.fn();

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch });

    expect(await screen.findByText(/maths · 3ème/i)).toBeInTheDocument();
    expect(screen.getByText('In discussion')).toBeInTheDocument();
    await user.click(screen.getByText(/maths · 3ème/i));
    expect(onSelectMatch).toHaveBeenCalledWith('match-1');
  });

  // Regression: founder feedback, 2026-08-05 -- finished matches (completed,
  // declined, expired, cancelled/refunded) piled up here forever with no
  // way to remove them. dismissMatch() only hides the match from this list
  // (tutor_dismissed_at), it never deletes the underlying record.
  it('shows a Clear button on a terminal-status match and removes it from the list on click', async () => {
    const user = userEvent.setup();
    const completedMatch: TutorMatchListItem = {
      id: 'match-2',
      request_id: 'req-2',
      tutor_id: 'tutor-1',
      status: 'completed',
      matched_at: '',
      tutor_responded_at: null,
      tutor_timeout_at: null,
      decline_reason: null,
      messaging_started_at: null,
      parent_timeout_at: null,
      confirmed_session_date: null,
      deposit_paid_at: null,
      in_progress_at: null,
      completed_at: '',
      cancelled_at: null,
      stalled_at: null,
      tutor_dismissed_at: null,
      created_at: '',
      tutor_requests: {
        id: 'req-2',
        parent_id: 'parent-1',
        category_id: 'cat-1',
        grade: 'Terminale',
        neighborhood: 'Bonapriso',
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
        categories: { name: 'Physique' },
      },
    };
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([completedMatch]);
    const dismissSpy = vi.spyOn(matchesLib, 'dismissMatch').mockResolvedValue(undefined);

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch: vi.fn() });

    await screen.findByText(/physique · terminale/i);
    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(dismissSpy).toHaveBeenCalledWith('match-2');
    await vi.waitFor(() => expect(screen.queryByText(/physique · terminale/i)).not.toBeInTheDocument());
  });

  it('does not show a Clear button on an active (non-terminal) match', async () => {
    const match: TutorMatchListItem = {
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
      tutor_requests: {
        id: 'req-1',
        parent_id: 'parent-1',
        category_id: 'cat-1',
        grade: '3ème',
        neighborhood: 'Akwa',
        budget_min: null,
        budget_max: null,
        budget_period: null,
        whatsapp_contact: '+237600000000',
        child_identifier: 'Junior',
        preferred_language: 'fr',
        status: 'matched',
        location_lat: null,
        location_lng: null,
        sessions_per_week: 2,
        created_at: '',
        categories: { name: 'Maths' },
      },
    };
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([match]);

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch: vi.fn() });

    await screen.findByText(/maths · 3ème/i);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('switches to edit mode and reloads after saving', async () => {
    const user = userEvent.setup();
    const fetchProfileSpy = vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([]);

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch: vi.fn() });

    await user.click(await screen.findByRole('button', { name: /^edit$/i }));
    expect(screen.getByText('PROFILE FORM MOCK')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(fetchProfileSpy).toHaveBeenCalledTimes(2);
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([]);

    renderTutorMatches({ tutorId: 'tutor-1', onSelectMatch: vi.fn() });

    expect(await screen.findByText('Mes mises en relation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
