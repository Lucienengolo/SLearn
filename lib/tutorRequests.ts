import { supabase, TutorRequest } from './supabase';

export type CreateTutorRequestInput = {
  categoryId: string;
  grade: string;
  neighborhood: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetPeriod: 'weekly' | 'monthly' | null;
  whatsappContact: string;
  childIdentifier: string | null;
  preferredLanguage: 'fr' | 'en';
  locationLat?: number | null;
  locationLng?: number | null;
  sessionsPerWeek: number;
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
    p_location_lat: input.locationLat ?? null,
    p_location_lng: input.locationLng ?? null,
    p_sessions_per_week: input.sessionsPerWeek,
    p_budget_period: input.budgetPeriod,
  });

  if (error) throw error;
  return data as TutorRequest;
}

// A Google Maps deep link an instructor can tap to navigate straight to the
// family's home -- built from device geolocation (0040_tutor_request_location_edit.sql),
// not a typed address, since a raw lat/lng pin is unambiguous where a typed
// neighborhood name isn't.
export function googleMapsLinkFor(request: Pick<TutorRequest, 'location_lat' | 'location_lng'>): string | null {
  if (request.location_lat == null || request.location_lng == null) return null;
  return `https://www.google.com/maps?q=${request.location_lat},${request.location_lng}`;
}

const BUDGET_FCFA = new Intl.NumberFormat('fr-FR');

// Founder request, 2026-08-06/07: the requester's own budget replaces the
// tutor's quoted rate everywhere it's shown (admin dashboard, WhatsApp
// handoff) now that tutors no longer set a rate at all. periodLabel is
// pre-translated by the caller (weekly/monthly) since this is a plain
// lib function, not a component with access to useLocale(); negotiableLabel
// is the fallback shown when the parent left budget blank -- an optional
// field on tutor_requests.
export function formatBudgetRange(
  budgetMin: number | null,
  budgetMax: number | null,
  periodLabel: string | null,
  negotiableLabel: string
): string {
  if (budgetMin == null && budgetMax == null) return negotiableLabel;
  const range =
    budgetMin != null && budgetMax != null && budgetMin !== budgetMax
      ? `${BUDGET_FCFA.format(budgetMin)}–${BUDGET_FCFA.format(budgetMax)} FCFA`
      : `${BUDGET_FCFA.format(budgetMin ?? budgetMax ?? 0)} FCFA`;
  return periodLabel ? `${range} / ${periodLabel}` : range;
}

export type UpdateTutorRequestInput = {
  categoryId: string;
  grade: string;
  neighborhood: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetPeriod: 'weekly' | 'monthly' | null;
  whatsappContact: string;
  childIdentifier: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  sessionsPerWeek: number;
};

// Only reaches rows the "parents edit or cancel their own still-searching
// request" RLS policy (0040_tutor_request_location_edit.sql) actually
// allows -- already matched/cancelled requests are locked, so this throws
// (0 rows updated surfaces as a Supabase "no rows" style outcome handled by
// the caller) rather than silently no-op'ing.
export async function updateTutorRequest(requestId: string, input: UpdateTutorRequestInput): Promise<void> {
  const normalizedWhatsapp = input.whatsappContact.replace(/\s+/g, '');
  if (!isValidWhatsappContact(normalizedWhatsapp)) {
    throw new Error('Invalid WhatsApp number -- expected format +237 6XX XXX XXX');
  }

  const { error } = await supabase
    .from('tutor_requests')
    .update({
      category_id: input.categoryId,
      grade: input.grade,
      neighborhood: input.neighborhood,
      budget_min: input.budgetMin,
      budget_max: input.budgetMax,
      budget_period: input.budgetPeriod,
      whatsapp_contact: normalizedWhatsapp,
      child_identifier: input.childIdentifier,
      location_lat: input.locationLat ?? null,
      location_lng: input.locationLng ?? null,
      sessions_per_week: input.sessionsPerWeek,
    })
    .eq('id', requestId);

  if (error) throw error;
}

// Founder feedback (2026-07-30): "when a request is deleted that means it
// should completely deleted from the DB and remove on the UI" -- previously
// this only soft-cancelled (status = 'cancelled'), which then kept showing
// up in "My Requests" instead of disappearing. Now a real DELETE, gated by
// the "parents delete their own still-searching request" RLS policy
// (0042_tutor_request_hard_delete.sql) -- a matched request can't reach
// this function at all (the UI only offers delete on the "still searching"
// screen), so there's no risk of this cascading away real match/payment
// history.
export async function cancelTutorRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from('tutor_requests').delete().eq('id', requestId);
  if (error) throw error;
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
