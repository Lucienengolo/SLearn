import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorProfileForm from '../components/Tutors/TutorProfileForm';
import * as tutorProfileLib from '../lib/tutorProfile';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { Category, TutorProfileFields } from '../lib/supabase';
import type { ComponentProps } from 'react';

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

function renderForm(props: ComponentProps<typeof TutorProfileForm>) {
  return render(
    <LocaleProvider>
      <TutorProfileForm {...props} />
    </LocaleProvider>
  );
}

describe('TutorProfileForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tutorProfileLib, 'fetchAllCategories').mockResolvedValue(CATEGORIES);
    vi.spyOn(tutorProfileLib, 'fetchMySubjectIds').mockResolvedValue([]);
  });

  it('shows "Become a tutor" for first-time setup (no existing profile)', async () => {
    renderForm({ tutorId: 'tutor-1', existingProfile: null, onSaved: vi.fn() });
    expect(await screen.findByText('Become a tutor')).toBeInTheDocument();
  });

  it('shows the edit heading and pre-fills fields when a profile already exists', async () => {
    vi.spyOn(tutorProfileLib, 'fetchMySubjectIds').mockResolvedValue(['cat-2']);
    renderForm({ tutorId: 'tutor-1', existingProfile: EXISTING_PROFILE, onSaved: vi.fn() });

    expect(await screen.findByText('Edit your tutor profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Akwa')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Language: English' })).toHaveAttribute('aria-pressed', 'true')
    );
    expect(screen.getByRole('button', { name: 'Maths' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles a subject chip on click', async () => {
    const user = userEvent.setup();
    renderForm({ tutorId: 'tutor-1', existingProfile: null, onSaved: vi.fn() });

    const mathsChip = await screen.findByRole('button', { name: 'Maths' });
    expect(mathsChip).toHaveAttribute('aria-pressed', 'false');
    await user.click(mathsChip);
    expect(mathsChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls saveTutorProfile with the selected values and calls onSaved on success', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(tutorProfileLib, 'saveTutorProfile').mockResolvedValue(undefined);
    const onSaved = vi.fn();

    renderForm({ tutorId: 'tutor-1', existingProfile: null, onSaved });

    await user.click(await screen.findByRole('button', { name: 'Maths' }));
    await user.type(screen.getByLabelText(/neighborhood/i), 'Bonamoussadi');
    await user.type(screen.getByLabelText(/whatsapp/i), '+237650123456');
    await user.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        'tutor-1',
        expect.objectContaining({
          neighborhood: 'Bonamoussadi',
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

    renderForm({ tutorId: 'tutor-1', existingProfile: null, onSaved });
    await user.click(await screen.findByRole('button', { name: 'Maths' }));
    await user.click(screen.getByRole('button', { name: /save my profile/i }));

    expect(await screen.findByText(/must be a verified instructor/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderForm({ tutorId: 'tutor-1', existingProfile: null, onSaved: vi.fn() });

    expect(await screen.findByText('Devenir tuteur')).toBeInTheDocument();
    expect(screen.getByText('Quartier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer mon profil/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
