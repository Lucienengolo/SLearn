import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorProfileForm from '../components/Tutors/TutorProfileForm';
import * as tutorProfileLib from '../lib/tutorProfile';
import type { Category, TutorProfileFields } from '../lib/supabase';

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Maths', description: null, created_at: '' },
  { id: 'cat-2', name: 'Anglais', description: null, created_at: '' },
];

const EXISTING_PROFILE: TutorProfileFields = {
  tutor_id: 'tutor-1',
  teaching_mode: 'online',
  neighborhood: 'Akwa',
  languages: ['en'],
  rate_per_session: 5000,
  response_time_minutes: 60,
  whatsapp_contact: '+237611111111',
  created_at: '',
  updated_at: '',
};

describe('TutorProfileForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tutorProfileLib, 'fetchAllCategories').mockResolvedValue(CATEGORIES);
    vi.spyOn(tutorProfileLib, 'fetchMySubjectIds').mockResolvedValue([]);
  });

  it('shows "Devenir tuteur" for first-time setup (no existing profile)', async () => {
    render(<TutorProfileForm tutorId="tutor-1" existingProfile={null} onSaved={vi.fn()} />);
    expect(await screen.findByText('Devenir tuteur')).toBeInTheDocument();
  });

  it('shows the edit heading and pre-fills fields when a profile already exists', async () => {
    vi.spyOn(tutorProfileLib, 'fetchMySubjectIds').mockResolvedValue(['cat-2']);
    render(<TutorProfileForm tutorId="tutor-1" existingProfile={EXISTING_PROFILE} onSaved={vi.fn()} />);

    expect(await screen.findByText('Modifier votre profil de tuteur')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Akwa')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Langue : Anglais' })).toHaveAttribute('aria-pressed', 'true')
    );
    expect(screen.getByRole('button', { name: 'Maths' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles a subject chip on click', async () => {
    const user = userEvent.setup();
    render(<TutorProfileForm tutorId="tutor-1" existingProfile={null} onSaved={vi.fn()} />);

    const mathsChip = await screen.findByRole('button', { name: 'Maths' });
    expect(mathsChip).toHaveAttribute('aria-pressed', 'false');
    await user.click(mathsChip);
    expect(mathsChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls saveTutorProfile with the selected values and calls onSaved on success', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(tutorProfileLib, 'saveTutorProfile').mockResolvedValue(undefined);
    const onSaved = vi.fn();

    render(<TutorProfileForm tutorId="tutor-1" existingProfile={null} onSaved={onSaved} />);

    await user.click(await screen.findByRole('button', { name: 'Maths' }));
    await user.type(screen.getByLabelText(/quartier/i), 'Bonamoussadi');
    await user.type(screen.getByLabelText(/tarif par séance/i), '7000');
    await user.type(screen.getByLabelText(/whatsapp/i), '+237650123456');
    await user.click(screen.getByRole('button', { name: /enregistrer mon profil/i }));

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        'tutor-1',
        expect.objectContaining({
          neighborhood: 'Bonamoussadi',
          ratePerSession: 7000,
          whatsappContact: '+237650123456',
          categoryIds: ['cat-1'],
        })
      )
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('shows a clear error and does not call onSaved when saving fails (e.g. unverified instructor)', async () => {
    const user = userEvent.setup();
    vi.spyOn(tutorProfileLib, 'saveTutorProfile').mockRejectedValue(
      new Error('tutor_profile_fields.tutor_id must be a verified instructor')
    );
    const onSaved = vi.fn();

    render(<TutorProfileForm tutorId="tutor-1" existingProfile={null} onSaved={onSaved} />);
    await user.click(await screen.findByRole('button', { name: 'Maths' }));
    await user.click(screen.getByRole('button', { name: /enregistrer mon profil/i }));

    expect(await screen.findByText(/must be a verified instructor/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
