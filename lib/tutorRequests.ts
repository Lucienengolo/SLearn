import { supabase, TutorRequest } from './supabase';

export type CreateTutorRequestInput = {
  categoryId: string;
  grade: string;
  neighborhood: string;
  budgetMin: number | null;
  budgetMax: number | null;
  whatsappContact: string;
  childIdentifier: string | null;
  preferredLanguage: 'fr' | 'en';
};

// Cameroon mobile format: +237 6XX XXX XXX (MTN/Orange/Camtel ranges all
// start with 6). Spaces are cosmetic -- stripped before validation/storage.
const WHATSAPP_PATTERN = /^\+2376\d{8}$/;

export function isValidWhatsappContact(raw: string): boolean {
  return WHATSAPP_PATTERN.test(raw.replace(/\s+/g, ''));
}

// Wraps the create_tutor_request() DB function (security definer,
// 0030_tutor_marketplace.sql) -- NOT a direct table insert. That function is
// what makes the 60-second double-submit dedup atomic; a client-side
// check-then-insert here would just reintroduce the same race under a
// double-click. A duplicate submission within the window returns the SAME
// row, so this function is itself idempotent -- calling it twice for an
// accidental double-click is always safe.
export async function createTutorRequest(input: CreateTutorRequestInput): Promise<TutorRequest> {
  const normalizedWhatsapp = input.whatsappContact.replace(/\s+/g, '');
  if (!isValidWhatsappContact(normalizedWhatsapp)) {
    throw new Error('Invalid WhatsApp number -- expected format +237 6XX XXX XXX');
  }

  const { data, error } = await supabase.rpc('create_tutor_request', {
    p_category_id: input.categoryId,
    p_grade: input.grade,
    p_neighborhood: input.neighborhood,
    p_budget_min: input.budgetMin,
    p_budget_max: input.budgetMax,
    p_whatsapp_contact: normalizedWhatsapp,
    p_child_identifier: input.childIdentifier,
    p_preferred_language: input.preferredLanguage,
  });

  if (error) throw error;
  return data as TutorRequest;
}

export type TutorRequestListItem = TutorRequest & { categories: { name: string } | null };

// Backs the parent "My Requests" page (Design Review D2: grouped by
// child_identifier -- sorted so a parent with multiple children can tell
// their requests apart, not a nested grouping UI). Most-recent-first within
// that.
export async function fetchMyTutorRequests(parentId: string): Promise<TutorRequestListItem[]> {
  const { data, error } = await supabase
    .from('tutor_requests')
    .select('*, categories(name)')
    .eq('parent_id', parentId)
    .order('child_identifier', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TutorRequestListItem[];
}

export type MatchTutorRequestResult =
  | { matched: true; matchId: string; tutorId: string }
  | { matched: false };

// Calls the match-tutor-request edge function right after a request is
// created (or again later, e.g. if the "still looking" screen's own retry
// action re-triggers matching for a request that's still 'searching').
export async function matchTutorRequest(requestId: string): Promise<MatchTutorRequestResult> {
  const { data, error } = await supabase.functions.invoke('match-tutor-request', {
    body: { requestId },
  });

  if (error) throw error;
  return data as MatchTutorRequestResult;
}
