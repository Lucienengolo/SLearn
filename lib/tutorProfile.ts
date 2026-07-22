import { supabase, TutorProfileFields, Category } from './supabase';
import { isValidWhatsappContact } from './tutorRequests';

export type TutorProfileInput = {
  teachingMode: 'online' | 'in_person' | 'both';
  neighborhood: string;
  languages: ('fr' | 'en')[];
  ratePerSession: number;
  responseTimeMinutes: number | null;
  whatsappContact: string;
  categoryIds: string[];
};

export async function fetchMyTutorProfile(tutorId: string): Promise<TutorProfileFields | null> {
  const { data, error } = await supabase.from('tutor_profile_fields').select('*').eq('tutor_id', tutorId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMySubjectIds(tutorId: string): Promise<string[]> {
  const { data, error } = await supabase.from('tutor_subjects').select('category_id').eq('tutor_id', tutorId);
  if (error) throw error;
  return (data ?? []).map((r) => r.category_id);
}

export async function fetchAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Requires the tutor to already be a verified instructor -- enforced at the
// DB layer too (tutor_profile_fields_require_verified trigger,
// 0030_tutor_marketplace.sql), so an unverified account gets a clear
// rejection here rather than a silent no-op.
export async function saveTutorProfile(tutorId: string, input: TutorProfileInput): Promise<void> {
  if (!isValidWhatsappContact(input.whatsappContact)) {
    throw new Error('Numéro WhatsApp invalide -- format attendu : +237 6XX XXX XXX');
  }
  if (input.categoryIds.length === 0) {
    throw new Error('Choisissez au moins une matière');
  }
  if (input.ratePerSession <= 0) {
    throw new Error('Le tarif doit être supérieur à 0');
  }

  const { error: upsertError } = await supabase.from('tutor_profile_fields').upsert(
    {
      tutor_id: tutorId,
      teaching_mode: input.teachingMode,
      neighborhood: input.neighborhood,
      languages: input.languages,
      rate_per_session: input.ratePerSession,
      response_time_minutes: input.responseTimeMinutes,
      whatsapp_contact: input.whatsappContact.replace(/\s+/g, ''),
    },
    { onConflict: 'tutor_id' }
  );
  if (upsertError) throw upsertError;

  // Replace-all rather than diff: tutor_subjects is a small set (a handful
  // of subjects per tutor at MVP scale), and this is user-initiated profile
  // editing, not a hot path -- a diff would be premature complexity here.
  const { error: deleteError } = await supabase.from('tutor_subjects').delete().eq('tutor_id', tutorId);
  if (deleteError) throw deleteError;

  if (input.categoryIds.length > 0) {
    const { error: insertError } = await supabase.from('tutor_subjects').insert(
      input.categoryIds.map((categoryId) => ({
        tutor_id: tutorId,
        category_id: categoryId,
        neighborhood: input.neighborhood,
      }))
    );
    if (insertError) throw insertError;
  }
}
