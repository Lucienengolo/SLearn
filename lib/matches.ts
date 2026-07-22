import { supabase, Match, ChatMessage, TutorRequest, TutorProfileFields, Profile } from './supabase';

// Decline reasons are a fixed quick-select set (Design Review D9) -- not
// free text, so the matching engine and the parent-facing "didn't work out"
// message (see MatchStatus.tsx) always get one of a few known values.
export const DECLINE_REASONS = ['Trop loin', "Conflit d'horaire", 'Pas ma matière', 'Autre'] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

const TERMINAL_MATCH_STATUSES = ['expired', 'declined', 'cancelled_refunded', 'completed'] as const;
const ACTIVE_MATCH_STATUSES = ['matched', 'messaging', 'deposit_paid', 'in_progress', 'stalled', 'dispute_review'];

export type RequestMatchState = {
  request: TutorRequest;
  activeMatch: Match | null;
  hadPriorMatch: boolean;
};

// Drives MatchStatus.tsx's top-level branch: "still looking" vs. an active
// match to show a chat/status view for. hadPriorMatch backs the Design
// Review D5 transparency message ("your previous match didn't work out")
// so a repeat "still looking" visit doesn't look like an unexplained reset.
export async function fetchRequestMatchState(requestId: string): Promise<RequestMatchState> {
  const { data: request, error: requestError } = await supabase
    .from('tutor_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  if (requestError) throw requestError;

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (matchesError) throw matchesError;

  const activeMatch = (matches ?? []).find((m) => ACTIVE_MATCH_STATUSES.includes(m.status)) ?? null;
  const hadPriorMatch = (matches ?? []).some((m) => TERMINAL_MATCH_STATUSES.includes(m.status));

  return { request: request as TutorRequest, activeMatch, hadPriorMatch };
}

export type TutorMatchListItem = Match & {
  tutor_requests: (TutorRequest & { categories: { name: string } | null }) | null;
};

// Backs the tutor "Matches" tab (Design Review D1: new tab on the existing
// instructor dashboard). Ordered most-recent-first, same convention as
// fetchRequestMatchState.
export async function fetchMyMatchesAsTutor(tutorId: string): Promise<TutorMatchListItem[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*, tutor_requests(*, categories(name))')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TutorMatchListItem[];
}

export type MatchContext = {
  match: Match;
  request: TutorRequest;
  tutorProfile: Profile;
  tutorFields: TutorProfileFields;
};

// Everything Chat.tsx needs to render its header and the "Continue on
// WhatsApp" handoff regardless of which side (parent or tutor) is viewing.
export async function fetchMatchContext(matchId: string): Promise<MatchContext> {
  const { data: match, error: matchError } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (matchError) throw matchError;

  const [{ data: request, error: requestError }, { data: tutorProfile, error: profileError }, { data: tutorFields, error: fieldsError }] =
    await Promise.all([
      supabase.from('tutor_requests').select('*').eq('id', match.request_id).single(),
      supabase.from('profiles').select('*').eq('id', match.tutor_id).single(),
      supabase.from('tutor_profile_fields').select('*').eq('tutor_id', match.tutor_id).single(),
    ]);

  if (requestError) throw requestError;
  if (profileError) throw profileError;
  if (fieldsError) throw fieldsError;

  return {
    match: match as Match,
    request: request as TutorRequest,
    tutorProfile: tutorProfile as Profile,
    tutorFields: tutorFields as TutorProfileFields,
  };
}

// Tutor-only actions -- covered by the "tutors respond to or decline their
// own new match" RLS policy (0030_tutor_marketplace.sql), which only allows
// matched -> messaging/declined and only for tutor_id = auth.uid(). A plain
// client update is safe here; no edge function needed for a single-row,
// single-party state transition.
export async function acceptMatch(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'messaging', tutor_responded_at: new Date().toISOString(), messaging_started_at: new Date().toISOString() })
    .eq('id', matchId);
  if (error) throw error;
}

// Reason is optional (Design Review D9: reason capture improves matching
// signal, but a tutor can still decline without specifying one).
export async function declineMatch(matchId: string, reason?: DeclineReason): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'declined', decline_reason: reason ?? null, tutor_responded_at: new Date().toISOString() })
    .eq('id', matchId);
  if (error) throw error;
}

// CEO plan item 5b: structured field via the "match participants confirm
// the session date" RLS policy, available to either party while
// status='messaging'.
export async function confirmSessionDate(matchId: string, sessionDate: Date): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ confirmed_session_date: sessionDate.toISOString() })
    .eq('id', matchId);
  if (error) throw error;
}

export async function fetchMessages(matchId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(matchId: string, senderId: string, body: string): Promise<ChatMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, body: trimmed })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// wa.me deep link -- the actual "Continue on WhatsApp" handoff target.
export function whatsappLink(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digitsOnly}`;
}
