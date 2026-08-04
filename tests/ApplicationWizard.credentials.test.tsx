import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationWizard from '../components/Dashboard/InstructorApplication/ApplicationWizard';
import * as authContext from '../contexts/AuthContext';
import * as instructorApplicationsLib from '../lib/instructorApplications';
import { supabase } from '../lib/supabase';
import type { InstructorApplication, InstructorCredential, InstructorCredentialType } from '../lib/supabase';
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
          order: vi.fn(() => Promise.resolve({ data: [] })),
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

function makeCredential(type: InstructorCredentialType): InstructorCredential {
  return {
    id: `cred-${type}`,
    application_id: 'app-1',
    credential_type: type,
    storage_path: `app-1/${type}.pdf`,
    file_name: `${type}.pdf`,
    verified: false,
    verified_by: null,
    verified_at: null,
    verification_extracted_name: null,
    verification_extracted_address: null,
    verification_name_match: null,
    verification_address_match: null,
    verification_notes: null,
    verification_checked_at: null,
    created_at: '',
  };
}

async function goToLastStep(user: ReturnType<typeof userEvent.setup>) {
  // Step 0 -> 5 ("Save & continue" x5). Each persists the draft; no field
  // in steps 0-3 blocks navigation without being filled in first (same as
  // ApplicationWizard.tutoring.test.tsx's goToTutoringStep).
  for (let i = 0; i < 5; i++) {
    await user.click(await screen.findByRole('button', { name: /save & continue/i }));
  }
  await waitFor(() => expect(screen.getByRole('button', { name: /submit application/i })).toBeInTheDocument());
}

// Regression: founder decision, 2026-08-04 -- selfie/degree/certificate
// became optional (were required/no-op respectively), CV/sample-lesson/
// question-paper became compulsory (were no-op). Submission used to block
// only on government_id + selfie; now it blocks on government_id + cv +
// sample_lesson + question_paper, and NOT on selfie.
describe('ApplicationWizard credential requirements', () => {
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
    vi.spyOn(instructorApplicationsLib, 'submitApplication').mockResolvedValue(makeApplication({ status: 'submitted' }));
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [] })),
      })),
    } as unknown as ReturnType<typeof supabase.from>);
  });

  it('blocks submission on missing government ID before checking anything else', async () => {
    const user = userEvent.setup();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([]);
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/government-issued id is required/i)).toBeInTheDocument();
  });

  it('blocks submission on missing CV even with government ID present', async () => {
    const user = userEvent.setup();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([makeCredential('government_id')]);
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/a cv is required/i)).toBeInTheDocument();
  });

  it('blocks submission on missing sample lesson even with ID and CV present', async () => {
    const user = userEvent.setup();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([
      makeCredential('government_id'),
      makeCredential('cv'),
    ]);
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/a sample lesson is required/i)).toBeInTheDocument();
  });

  it('blocks submission on missing question paper example even with ID, CV, and sample lesson present', async () => {
    const user = userEvent.setup();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([
      makeCredential('government_id'),
      makeCredential('cv'),
      makeCredential('sample_lesson'),
    ]);
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/a question paper example is required/i)).toBeInTheDocument();
  });

  it('submits successfully with ID, CV, sample lesson, and question paper -- no selfie, degree, or certificate needed', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([
      makeCredential('government_id'),
      makeCredential('cv'),
      makeCredential('sample_lesson'),
      makeCredential('question_paper'),
    ]);
    renderWizard({ initialApplication: null, onSubmitted });

    await goToLastStep(user);
    await user.click(screen.getByRole('button', { name: /submit application/i }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  });

  it('shows the credential upload rows with the correct optional/required labels', async () => {
    const user = userEvent.setup();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([]);
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    for (let i = 0; i < 4; i++) {
      await user.click(await screen.findByRole('button', { name: /save & continue/i }));
    }
    await waitFor(() => expect(screen.getByText('5. Credentials & identity')).toBeInTheDocument());

    expect(screen.getByText('Selfie (optional)')).toBeInTheDocument();
    expect(screen.getByText('Degree (optional)')).toBeInTheDocument();
    expect(screen.getByText('Certificate (optional)')).toBeInTheDocument();
    expect(screen.getByText('CV / résumé (required)')).toBeInTheDocument();
    expect(screen.getByText('Sample lesson (required)')).toBeInTheDocument();
    expect(screen.getByText('Question paper example (required)')).toBeInTheDocument();
  });
});
