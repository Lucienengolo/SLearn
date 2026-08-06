import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationWizard from '../components/Dashboard/InstructorApplication/ApplicationWizard';
import * as authContext from '../contexts/AuthContext';
import * as instructorApplicationsLib from '../lib/instructorApplications';
import { supabase } from '../lib/supabase';
import type { InstructorApplication } from '../lib/supabase';
import { LocaleProvider } from '../contexts/LocaleContext';

function renderWizard(props: { initialApplication: InstructorApplication | null; onSubmitted: () => void }) {
  return render(
    <LocaleProvider>
      <ApplicationWizard {...props} />
    </LocaleProvider>
  );
}

vi.mock('../lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase')>('../lib/supabase');
  return {
    ...actual,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: [
                { id: 'cat-1', name: 'Maths', description: null, created_at: '' },
                { id: 'cat-2', name: 'Anglais', description: null, created_at: '' },
              ],
            })
          ),
        })),
      })),
    },
  };
});

function makeApplication(overrides: Partial<InstructorApplication> = {}): InstructorApplication {
  return {
    id: 'app-1',
    applicant_id: 'user-1',
    status: 'draft',
    full_name: 'Aïcha M.',
    address: null,
    headline: null,
    bio: null,
    qualifications: null,
    years_experience: null,
    areas_of_expertise: [],
    proposed_course_title: null,
    proposed_course_description: null,
    proposed_course_category_id: null,
    background_check_status: 'not_started',
    submitted_at: null,
    decided_at: null,
    decision_notes: null,
    created_at: '',
    updated_at: '',
    offers_tutoring: false,
    tutoring_category_ids: [],
    tutoring_neighborhood: null,
    tutoring_teaching_mode: null,
    tutoring_languages: [],
    tutoring_rate_per_session: null,
    tutoring_response_time_minutes: null,
    tutoring_whatsapp: null,
    ...overrides,
  };
}

async function goToTutoringStep(user: ReturnType<typeof userEvent.setup>) {
  // Step 0 -> 1 -> 2 (Tutoring). Each "Save & continue" persists the draft.
  await user.click(await screen.findByRole('button', { name: /save & continue/i }));
  await waitFor(() => expect(screen.getByText('2. Experience')).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /save & continue/i }));
  await waitFor(() => expect(screen.getByText('3. Tutoring (optional)')).toBeInTheDocument());
}

describe('ApplicationWizard tutoring section', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // ApplicationWizard now persists step position to localStorage keyed
    // by user id (2026-08-04 fix) -- every test here mocks the same
    // 'user-1', so a leftover step from a prior test would otherwise make
    // the wizard resume somewhere other than step 0.
    localStorage.clear();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      // @ts-expect-error -- partial mock, only fields the wizard actually reads
      user: { id: 'user-1', email: 't@example.com' },
    });
    vi.spyOn(instructorApplicationsLib, 'saveDraft').mockImplementation(async (_userId, patch) =>
      makeApplication(patch)
    );
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([]);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({
            data: [
              { id: 'cat-1', name: 'Maths', description: null, created_at: '' },
              { id: 'cat-2', name: 'Anglais', description: null, created_at: '' },
            ],
          })
        ),
      })),
    } as unknown as ReturnType<typeof supabase.from>);
  });

  it('hides tutoring fields until the opt-in checkbox is checked', async () => {
    const user = userEvent.setup();
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    await goToTutoringStep(user);

    expect(screen.getByText(/matching you with parents/i)).toBeInTheDocument();
    expect(screen.queryByText('Subjects you can tutor')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /1-on-1 tutoring/i }));

    expect(await screen.findByText('Subjects you can tutor')).toBeInTheDocument();
    expect(screen.getByText('Neighborhood (for in-person tutoring)')).toBeInTheDocument();
  });

  it('toggles subject chips and language chips independently by accessible name', async () => {
    const user = userEvent.setup();
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    await goToTutoringStep(user);
    await user.click(screen.getByRole('checkbox', { name: /1-on-1 tutoring/i }));

    const mathsChip = await screen.findByRole('button', { name: 'Maths' });
    expect(mathsChip).toHaveAttribute('aria-pressed', 'false');
    await user.click(mathsChip);
    expect(mathsChip).toHaveAttribute('aria-pressed', 'true');

    // French defaults on; English chip has a distinct accessible name from
    // any same-named subject (mirrors the fix applied to TutorProfileForm).
    const englishLangChip = screen.getByRole('button', { name: 'Language: English' });
    expect(englishLangChip).toHaveAttribute('aria-pressed', 'false');
    await user.click(englishLangChip);
    expect(englishLangChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('pre-fills from an existing application that already opted in', async () => {
    const user = userEvent.setup();
    const existing = makeApplication({
      offers_tutoring: true,
      tutoring_category_ids: ['cat-1'],
      tutoring_neighborhood: 'Akwa',
    });

    renderWizard({ initialApplication: existing, onSubmitted: vi.fn() });
    await goToTutoringStep(user);

    expect(screen.getByRole('checkbox', { name: /1-on-1 tutoring/i })).toBeChecked();
    expect(screen.getByDisplayValue('Akwa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Maths' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    expect(await screen.findByText('Postuler pour enseigner')).toBeInTheDocument();
    expect(screen.getByText('1. Profil et qualifications')).toBeInTheDocument();
    expect(screen.getByText('Nom complet')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
