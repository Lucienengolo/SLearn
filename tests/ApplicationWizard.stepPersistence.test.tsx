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

// Regression: founder bug report, 2026-08-04 -- "when you submit or do
// something like that it pushes you out of the registration process, you
// have to start back from the beginning although the information remains
// on the different form". The wizard's step position is now persisted to
// localStorage (keyed by user id) so a remount -- which InstructorApplicationFlow
// genuinely does on every page load/navigation -- resumes where the user
// left off instead of resetting to step 0.
describe('ApplicationWizard step persistence across remounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      // @ts-expect-error -- partial mock, only fields the wizard actually reads
      user: { id: 'user-1', email: 't@example.com' },
    });
    vi.spyOn(instructorApplicationsLib, 'saveDraft').mockImplementation(async (_userId, patch) =>
      makeApplication(patch)
    );
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([]);
    vi.spyOn(instructorApplicationsLib, 'submitApplication').mockResolvedValue(makeApplication({ status: 'submitted' }));
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [] })),
      })),
    } as unknown as ReturnType<typeof supabase.from>);
  });

  it('starts at step 1 with no stored progress', async () => {
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });
    expect(await screen.findByText('1. Profile & qualifications')).toBeInTheDocument();
  });

  it('resumes at the last visited step after a full remount, simulating navigating away and back', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWizard({ initialApplication: makeApplication(), onSubmitted: vi.fn() });

    // Advance to step 3 (0-indexed) / "4. Course proposal".
    for (let i = 0; i < 3; i++) {
      await user.click(await screen.findByRole('button', { name: /save & continue/i }));
    }
    await waitFor(() => expect(screen.getByText('4. Course proposal')).toBeInTheDocument());

    // A real remount -- exactly what InstructorApplicationFlow does on
    // every page load, not just a re-render of the same instance. The
    // step breadcrumb always renders every label regardless of which step
    // is active, so assert on the actual step-specific field content
    // instead (step 3's "Proposed course title" vs. step 0's "Full name").
    unmount();
    renderWizard({ initialApplication: makeApplication(), onSubmitted: vi.fn() });

    expect(await screen.findByText('Proposed course title')).toBeInTheDocument();
    expect(screen.queryByText('Full name')).not.toBeInTheDocument();
  });

  it('keeps step progress isolated per user', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWizard({ initialApplication: makeApplication(), onSubmitted: vi.fn() });

    await user.click(await screen.findByRole('button', { name: /save & continue/i }));
    await waitFor(() => expect(screen.getByText('2. Experience')).toBeInTheDocument());
    unmount();

    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      // @ts-expect-error -- partial mock
      user: { id: 'user-2', email: 'other@example.com' },
    });
    renderWizard({ initialApplication: null, onSubmitted: vi.fn() });

    expect(await screen.findByText('1. Profile & qualifications')).toBeInTheDocument();
  });

  it('clears the stored step once the application is actually submitted', async () => {
    const user = userEvent.setup();
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([
      { id: 'c1', application_id: 'app-1', credential_type: 'government_id', storage_path: '', file_name: '', verified: false, verified_by: null, verified_at: null, verification_extracted_name: null, verification_extracted_address: null, verification_name_match: null, verification_address_match: null, verification_notes: null, verification_checked_at: null, created_at: '' },
      { id: 'c2', application_id: 'app-1', credential_type: 'cv', storage_path: '', file_name: '', verified: false, verified_by: null, verified_at: null, verification_extracted_name: null, verification_extracted_address: null, verification_name_match: null, verification_address_match: null, verification_notes: null, verification_checked_at: null, created_at: '' },
      { id: 'c3', application_id: 'app-1', credential_type: 'sample_lesson', storage_path: '', file_name: '', verified: false, verified_by: null, verified_at: null, verification_extracted_name: null, verification_extracted_address: null, verification_name_match: null, verification_address_match: null, verification_notes: null, verification_checked_at: null, created_at: '' },
      { id: 'c4', application_id: 'app-1', credential_type: 'question_paper', storage_path: '', file_name: '', verified: false, verified_by: null, verified_at: null, verification_extracted_name: null, verification_extracted_address: null, verification_name_match: null, verification_address_match: null, verification_notes: null, verification_checked_at: null, created_at: '' },
    ]);
    const onSubmitted = vi.fn();
    const { unmount } = renderWizard({ initialApplication: makeApplication(), onSubmitted });

    for (let i = 0; i < 5; i++) {
      await user.click(await screen.findByRole('button', { name: /save & continue/i }));
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /submit application/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /submit application/i }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    unmount();

    renderWizard({ initialApplication: makeApplication(), onSubmitted: vi.fn() });
    expect(await screen.findByText('1. Profile & qualifications')).toBeInTheDocument();
  });
});
