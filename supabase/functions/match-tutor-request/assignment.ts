// Pure retry-on-conflict loop, extracted from index.ts so it's testable
// under Vitest without a live Supabase/Deno environment. The actual
// concurrency guarantee is the DB's partial unique index
// (matches_one_active_per_tutor_idx, verified directly against Postgres
// during T2) -- this function only decides what to do when an attempt
// reports a conflict: try the next-best candidate instead of failing the
// whole request.

export type AssignAttemptResult<TCandidate, TSuccess> =
  | { outcome: 'assigned'; candidate: TCandidate; result: TSuccess }
  | { outcome: 'conflict' }
  | { outcome: 'error'; message: string };

export type AssignmentOutcome<TCandidate, TSuccess> =
  | { assigned: true; candidate: TCandidate; result: TSuccess }
  | { assigned: false; reason: 'no_candidates_available' }
  | { assigned: false; reason: 'error'; message: string };

/**
 * Tries each ranked candidate in order via `tryAssign`. Stops at the first
 * success. A 'conflict' result (another concurrent request just took that
 * candidate) moves on to the next one instead of failing outright. A hard
 * 'error' result stops immediately and surfaces the error -- a real DB
 * failure shouldn't be silently swallowed by falling through to zero-match.
 */
export async function assignBestAvailableCandidate<TCandidate, TSuccess>(
  rankedCandidates: TCandidate[],
  tryAssign: (candidate: TCandidate) => Promise<AssignAttemptResult<TCandidate, TSuccess>>
): Promise<AssignmentOutcome<TCandidate, TSuccess>> {
  for (const candidate of rankedCandidates) {
    const attempt = await tryAssign(candidate);

    if (attempt.outcome === 'assigned') {
      return { assigned: true, candidate: attempt.candidate, result: attempt.result };
    }

    if (attempt.outcome === 'error') {
      return { assigned: false, reason: 'error', message: attempt.message };
    }

    // 'conflict' -- fall through to the next candidate.
  }

  return { assigned: false, reason: 'no_candidates_available' };
}
