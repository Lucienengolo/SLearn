import { supabase, MatchStatusValue } from './supabase';

// Admin oversight of the full tutor-marketplace match state, plus the
// one real gap found while building this: nothing anywhere previously
// transitioned a match OUT of 'dispute_review'
// (0056_admin_capabilities_batch.sql).
export type AdminMatchListItem = {
  match_id: string;
  status: MatchStatusValue;
  confirmed_session_date: string | null;
  parent_name: string | null;
  tutor_name: string | null;
  created_at: string;
};

export async function fetchAllMatchesAdmin(): Promise<AdminMatchListItem[]> {
  const { data, error } = await supabase.rpc('get_all_matches_admin');
  if (error) throw error;
  return data ?? [];
}

export type DisputeResolution = 'cancelled_refunded' | 'completed';

// DB-state-only, same as this session's WhatsApp-handoff manual-settlement
// pattern -- doesn't call Stripe itself; cancel-tutor-booking already
// attempted and gave up on an automated refund before a match ever
// reaches dispute_review.
export async function resolveDispute(matchId: string, resolution: DisputeResolution): Promise<void> {
  const { error } = await supabase.rpc('resolve_dispute', { p_match_id: matchId, p_resolution: resolution });
  if (error) throw error;
}
