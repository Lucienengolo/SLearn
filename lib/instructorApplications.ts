import {
  supabase,
  InstructorApplication,
  InstructorCredential,
  InstructorCredentialType,
  Interview,
} from './supabase';

export type ApplicationDraft = Partial<
  Pick<
    InstructorApplication,
    | 'full_name'
    | 'address'
    | 'headline'
    | 'bio'
    | 'qualifications'
    | 'years_experience'
    | 'areas_of_expertise'
    | 'proposed_course_title'
    | 'proposed_course_description'
    | 'proposed_course_category_id'
  >
>;

export async function fetchMyApplication(userId: string): Promise<InstructorApplication | null> {
  const { data, error } = await supabase
    .from('instructor_applications')
    .select('*')
    .eq('applicant_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveDraft(
  userId: string,
  patch: ApplicationDraft
): Promise<InstructorApplication> {
  const { data, error } = await supabase
    .from('instructor_applications')
    .upsert({ applicant_id: userId, ...patch }, { onConflict: 'applicant_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function submitApplication(applicationId: string): Promise<InstructorApplication> {
  const { data, error } = await supabase
    .from('instructor_applications')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', applicationId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchCredentials(applicationId: string): Promise<InstructorCredential[]> {
  const { data, error } = await supabase
    .from('instructor_credentials')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function uploadCredential(
  userId: string,
  applicationId: string,
  credentialType: InstructorCredentialType,
  file: File
): Promise<InstructorCredential> {
  const extension = file.name.split('.').pop();
  const path = `${userId}/${credentialType}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('instructor-credentials')
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('instructor_credentials')
    .insert({
      application_id: applicationId,
      credential_type: credentialType,
      storage_path: path,
      file_name: file.name,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMyInterview(applicationId: string): Promise<Interview | null> {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// --- Reviewer-only (profiles.is_reviewer = true; RLS backs this up server
// side regardless of what the client asks for) --------------------------

export type ApplicationWithApplicant = InstructorApplication & {
  applicant: { email: string; full_name: string | null } | null;
};

const REVIEWABLE_STATUSES = ['submitted', 'review', 'interview'] as const;

export async function fetchReviewQueue(): Promise<ApplicationWithApplicant[]> {
  const { data, error } = await supabase
    .from('instructor_applications')
    .select('*, applicant:profiles!applicant_id(email, full_name)')
    .in('status', REVIEWABLE_STATUSES)
    .order('submitted_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ApplicationWithApplicant[];
}

export async function fetchDecidedApplications(): Promise<ApplicationWithApplicant[]> {
  const { data, error } = await supabase
    .from('instructor_applications')
    .select('*, applicant:profiles!applicant_id(email, full_name)')
    .in('status', ['approved', 'rejected'])
    .order('decided_at', { ascending: false })
    .limit(25);

  if (error) throw error;
  return (data ?? []) as ApplicationWithApplicant[];
}

export async function getCredentialFileUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('instructor-credentials')
    .createSignedUrl(storagePath, 300);

  if (error) return null;
  return data.signedUrl;
}

export async function decideApplication(
  applicationId: string,
  decision: 'approved' | 'rejected',
  notes?: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('instructor-approval', {
    body: { applicationId, decision, notes },
  });
  if (error) throw error;
}

// Interviews are booked through Cal.com (see supabase/functions/cal-webhook)
// instead of a DB-native slot picker — this just builds the prefilled
// booking link. Undefined when VITE_CAL_BOOKING_LINK isn't configured, same
// no-op-until-configured pattern as Sentry/PostHog (lib/errorTracking.ts,
// lib/analytics.ts).
export function getCalBookingLink(name: string, email: string): string | null {
  const base = import.meta.env.VITE_CAL_BOOKING_LINK;
  if (!base) return null;

  const url = new URL(base);
  if (name) url.searchParams.set('name', name);
  if (email) url.searchParams.set('email', email);
  return url.toString();
}
