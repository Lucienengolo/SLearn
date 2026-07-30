import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerificationPipeline from '../components/Dashboard/InstructorApplication/VerificationPipeline';
import * as authContext from '../contexts/AuthContext';
import * as instructorApplicationsLib from '../lib/instructorApplications';
import { LocaleProvider } from '../contexts/LocaleContext';
import type { InstructorApplication } from '../lib/supabase';

vi.mock('../lib/analytics', () => ({ trackEvent: vi.fn() }));

function makeApplication(overrides: Partial<InstructorApplication> = {}): InstructorApplication {
  return {
    id: 'app-1',
    applicant_id: 'user-1',
    status: 'review',
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
    submitted_at: '2026-07-01T00:00:00Z',
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

function renderPipeline(application: InstructorApplication) {
  return render(
    <LocaleProvider>
      <VerificationPipeline application={application} onEdit={vi.fn()} />
    </LocaleProvider>
  );
}

// Regression: founder feedback that "the language doesn't apply to all the
// platform" -- the instructor verification pipeline (stage tracker,
// checklist rows) was hardcoded English regardless of the FR/EN toggle.
describe('VerificationPipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({ user: { id: 'user-1', email: 't@example.com' } } as never);
    vi.spyOn(instructorApplicationsLib, 'fetchCredentials').mockResolvedValue([]);
    vi.spyOn(instructorApplicationsLib, 'fetchMyInterview').mockResolvedValue(null);
  });

  it('renders in English by default (jsdom navigator.language)', async () => {
    renderPipeline(makeApplication());

    expect(await screen.findByText('Instructor verification')).toBeInTheDocument();
    expect(screen.getByText('Government ID verified')).toBeInTheDocument();
    expect(screen.getByText('Compulsory interview')).toBeInTheDocument();
  });

  it('shows the rejection banner instead of the stage tracker when rejected', async () => {
    renderPipeline(makeApplication({ status: 'rejected', decision_notes: 'Missing documents' }));

    expect(await screen.findByText('Application not approved')).toBeInTheDocument();
  });

  it('renders in French when the locale is French', async () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    localStorage.clear();

    renderPipeline(makeApplication());

    expect(await screen.findByText("Vérification de l'instructeur")).toBeInTheDocument();
    expect(screen.getByText("Pièce d'identité vérifiée")).toBeInTheDocument();
    expect(screen.getByText('Entretien obligatoire')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
