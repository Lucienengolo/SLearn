import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorMatches from '../components/Tutors/TutorMatches';
import * as tutorProfileLib from '../lib/tutorProfile';
import * as matchesLib from '../lib/matches';
import type { TutorProfileFields } from '../lib/supabase';
import type { TutorMatchListItem } from '../lib/matches';

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

    render(<TutorMatches tutorId="tutor-1" onSelectMatch={vi.fn()} />);

    expect(await screen.findByText('PROFILE FORM MOCK')).toBeInTheDocument();
  });

  it('shows a warm empty state when the profile exists but there are no matches yet', async () => {
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([]);

    render(<TutorMatches tutorId="tutor-1" onSelectMatch={vi.fn()} />);

    expect(await screen.findByText(/vous apparaîtrez ici/i)).toBeInTheDocument();
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
      created_at: '',
      tutor_requests: {
        id: 'req-1',
        parent_id: 'parent-1',
        category_id: 'cat-1',
        grade: '3ème',
        neighborhood: 'Akwa',
        budget_min: null,
        budget_max: null,
        whatsapp_contact: '+237600000000',
        child_identifier: 'Junior',
        preferred_language: 'fr',
        status: 'matched',
        created_at: '',
        categories: { name: 'Maths' },
      },
    };
    vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([match]);
    const onSelectMatch = vi.fn();

    render(<TutorMatches tutorId="tutor-1" onSelectMatch={onSelectMatch} />);

    expect(await screen.findByText(/maths · 3ème/i)).toBeInTheDocument();
    expect(screen.getByText('En discussion')).toBeInTheDocument();
    await user.click(screen.getByText(/maths · 3ème/i));
    expect(onSelectMatch).toHaveBeenCalledWith('match-1');
  });

  it('switches to edit mode and reloads after saving', async () => {
    const user = userEvent.setup();
    const fetchProfileSpy = vi.spyOn(tutorProfileLib, 'fetchMyTutorProfile').mockResolvedValue(PROFILE);
    vi.spyOn(matchesLib, 'fetchMyMatchesAsTutor').mockResolvedValue([]);

    render(<TutorMatches tutorId="tutor-1" onSelectMatch={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /modifier/i }));
    expect(screen.getByText('PROFILE FORM MOCK')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(fetchProfileSpy).toHaveBeenCalledTimes(2);
  });
});
