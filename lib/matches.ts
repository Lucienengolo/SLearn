import { supabase, Match, ChatMessage, TutorRequest, TutorProfileFields, Profile } from './supabase';

// Decline reasons are a fixed quick-select set (Design Review D9) -- not
// free text, so the matching engine and the parent-facing "didn't work out"
// message (see MatchStatus.tsx) always get one of a few known values.
export const DECLINE_REASONS = ['Trop loin', "Conflit d'horaire", 'Pas ma matière', 'Autre'] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const TERMINAL_MATCH_STATUSES = ['expired', 'declined', 'cancelled_refunded', 'completed'] as const;
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
// fetchRequestMatchState. Excludes matches the tutor has cleared
// (dismissMatch below) -- founder feedback, 2026-08-05: finished matches
// piled up here forever with no way to remove them.
export async function fetchMyMatchesAsTutor(tutorId: string): Promise<TutorMatchListItem[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*, tutor_requests(*, categories(name))')
    .eq('tutor_id', tutorId)
    .is('tutor_dismissed_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TutorMatchListItem[];
}

// Hides a finished match from the tutor's own "My Matches" list -- never
// deletes the row, which stays intact for payment history and reviewer
// settlement records. RLS ("tutors dismiss their own terminal matches",
// 0053_tutor_dismisses_own_matches.sql) only allows this for the tutor's
// own matches already in a terminal status (TERMINAL_MATCH_STATUSES
// above) -- a plain client update is safe here, same reasoning as
// acceptMatch/declineMatch.
export async function dismissMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').update({ tutor_dismissed_at: new Date().toISOString() }).eq('id', matchId);
  if (error) throw error;
}

export type MatchContext = {
  match: Match;
  request: TutorRequest;
  tutorProfile: Profile;
  tutorFields: TutorProfileFields;
};

// Everything Chat.tsx and PaymentStatus.tsx need to render, regardless of
// which side (parent or tutor) is viewing -- both mount side by side in a
// match's detail view (MatchStatus.tsx for parents, SLearnClassroom.tsx for
// tutors) and each call this independently. In-flight calls for the same
// matchId are deduped below so that pairing doesn't double every one of
// these four queries -- found during a 2026-08-07 performance audit after
// SLearnClassroom.tsx started rendering both together.
async function fetchMatchContextUncached(matchId: string): Promise<MatchContext> {
  const { data: match, error: matchError } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (matchError) throw matchError;

  const [{ data: request, error: requestError }, { data: tutorProfile, error: profileError }, { data: tutorFields, error: fieldsError }] =
    await Promise.all([
      supabase.from('tutor_requests').select('*').eq('id', match.request_id).single(),
      // public_profiles (2026-08-02 security fix, 0046_restrict_profile_email.sql)
      // -- only full_name is actually used here (Chat.tsx header), and email
      // isn't a selectable column on `profiles` for a plain client query anymore.
      supabase.from('public_profiles').select('*').eq('id', match.tutor_id).single(),
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

const inFlightMatchContext = new Map<string, Promise<MatchContext>>();

export function fetchMatchContext(matchId: string): Promise<MatchContext> {
  const existing = inFlightMatchContext.get(matchId);
  if (existing) return existing;

  const promise = fetchMatchContextUncached(matchId).finally(() => {
    inFlightMatchContext.delete(matchId);
  });
  inFlightMatchContext.set(matchId, promise);
  return promise;
}

// public_profiles (0046_restrict_profile_email.sql) deliberately excludes
// email, so the WhatsApp handoff message (PaymentStatus.tsx) needs this
// narrow RPC (get_match_tutor_email, 0058) instead -- security definer,
// gated by is_match_participant() so only the two people on the match can
// read the tutor's email.
export async function fetchMatchTutorEmail(matchId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_match_tutor_email', { p_match_id: matchId });
  if (error) throw error;
  return data;
}

const PARENT_RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;

// Tutor-only actions -- covered by the "tutors respond to or decline their
// own new match" RLS policy (0030_tutor_marketplace.sql), which only allows
// matched -> messaging/declined and only for tutor_id = auth.uid(). A plain
// client update is safe here; no edge function needed for a single-row,
// single-party state transition.
//
// Bug found 2026-08-04 (founder report: "tutor matching is not working"):
// this never set parent_timeout_at, so expire_unresponsive_parent_matches()
// (0031_tutor_marketplace_cron.sql, runs hourly, confirmed active in
// production) could never fire -- its WHERE clause requires
// parent_timeout_at is not null. A match that reached 'messaging' and the
// parent then went silent (never confirmed a session date or paid a
// deposit) stayed 'messaging' forever, permanently occupying that tutor's
// one active-match slot (ACTIVE_MATCH_STATUSES below) and blocking them
// from ever being matched again -- exactly what happened to the only
// fully-onboarded tutor in production, whose one match from 2026-07-30 had
// sat unresolved for 5 days, silently failing every subsequent match
// attempt for that tutor's subjects.
export async function acceptMatch(matchId: string): Promise<void> {
  const now = new Date();
  const parentTimeoutAt = new Date(now.getTime() + PARENT_RESPONSE_WINDOW_MS);
  const { error } = await supabase
    .from('matches')
    .update({
      status: 'messaging',
      tutor_responded_at: now.toISOString(),
      messaging_started_at: now.toISOString(),
      parent_timeout_at: parentTimeoutAt.toISOString(),
    })
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
