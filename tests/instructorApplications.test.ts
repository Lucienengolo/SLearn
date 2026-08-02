import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchReviewQueue, fetchDecidedApplications } from '../lib/instructorApplications';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const BASE_APPLICATION = {
  id: 'app-1',
  applicant_id: 'applicant-1',
  status: 'submitted',
  full_name: null,
  address: null,
  headline: null,
  bio: null,
  qualifications: null,
  years_experience: null,
  areas_of_expertise: null,
  proposed_course_title: null,
  proposed_course_description: null,
  proposed_course_category_id: null,
  background_check_status: 'not_started',
  submitted_at: '',
  decided_at: null,
  decision_notes: null,
  created_at: '',
  updated_at: '',
  offers_tutoring: false,
  tutoring_category_ids: [],
  tutoring_neighborhood: null,
  applicant: { full_name: 'Jane Applicant' },
};

function mockApplications(rows: unknown[]) {
  vi.mocked(supabase.from).mockImplementation(() => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: rows, error: null }).then(resolve);
    return builder as unknown as ReturnType<typeof supabase.from>;
  });
}

// Regression: profiles.email is no longer selectable via the embedded
// profiles join (2026-08-02 security fix, 0046_restrict_profile_email.sql)
// -- fetchReviewQueue/fetchDecidedApplications now merge in each
// application's applicant email from a separate
// get_application_applicant_email RPC call.
describe('instructorApplications email attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchReviewQueue merges the applicant email from the RPC onto each application', async () => {
    mockApplications([BASE_APPLICATION]);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'jane@example.com', error: null } as never);

    const applications = await fetchReviewQueue();

    expect(supabase.rpc).toHaveBeenCalledWith('get_application_applicant_email', { p_application_id: 'app-1' });
    expect(applications[0].applicant?.email).toBe('jane@example.com');
    expect(applications[0].applicant?.full_name).toBe('Jane Applicant');
  });

  it('fetchDecidedApplications falls back to an empty string when the RPC returns nothing', async () => {
    mockApplications([BASE_APPLICATION]);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    const applications = await fetchDecidedApplications();

    expect(applications[0].applicant?.email).toBe('');
  });
});
