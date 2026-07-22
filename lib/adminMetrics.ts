import { supabase } from './supabase';

// Backed by the tutor_request_match_stats view (0033), which embeds its own
// is_reviewer check -- a non-reviewer querying this gets zero rows back,
// not an error (same "quietly empty, not a scary failure" RLS convention
// used throughout this codebase).
export type TutorRequestMatchStat = {
  category_id: string;
  neighborhood: string;
  total_requests: number;
  unmatched_count: number;
  matched_count: number;
  cancelled_count: number;
  unmatched_rate_pct: number;
};

export async function fetchTutorRequestMatchStats(): Promise<TutorRequestMatchStat[]> {
  const { data, error } = await supabase
    .from('tutor_request_match_stats')
    .select('*')
    .order('unmatched_rate_pct', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
