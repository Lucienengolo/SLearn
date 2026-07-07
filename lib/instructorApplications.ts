import {
  supabase,
  InstructorApplication,
  InstructorCredential,
  InstructorCredentialType,
  Interview,
  InterviewSlot,
} from './supabase';

export type ApplicationDraft = Partial<
  Pick<
    InstructorApplication,
    | 'full_name'
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

export async function fetchOpenInterviewSlots(): Promise<InterviewSlot[]> {
  const { data, error } = await supabase
    .from('interview_slots')
    .select('*')
    .eq('is_booked', false)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
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

export async function scheduleInterview(
  applicationId: string,
  slot: InterviewSlot
): Promise<Interview> {
  const { error: slotError } = await supabase
    .from('interview_slots')
    .update({ is_booked: true })
    .eq('id', slot.id)
    .eq('is_booked', false);

  if (slotError) throw slotError;

  const { data, error } = await supabase
    .from('interviews')
    .insert({
      application_id: applicationId,
      slot_id: slot.id,
      scheduled_at: slot.starts_at,
      panelist_id: slot.panelist_id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
