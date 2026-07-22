// Pure matching-engine logic, deliberately framework/runtime-agnostic (no
// Deno or Supabase imports) so it can be unit-tested under Vitest/Node even
// though the edge function itself runs under Deno. index.ts is the thin
// Deno.serve wrapper around this.
//
// Scoring factors are exactly the four Eng Review E6 named: subject (a hard
// gate via the tutor_subjects join upstream, not scored here), neighborhood,
// language, and availability (response time). Budget was intentionally left
// out of scoring -- E6 enumerated four factors, not five, and adding a fifth
// here would silently expand what the Eng Review actually reviewed.

export type MatchRequest = {
  neighborhood: string;
  preferredLanguage: 'fr' | 'en';
};

export type TutorCandidate = {
  tutorId: string;
  neighborhood: string;
  languages: string[];
  responseTimeMinutes: number | null;
};

export const SCORE_WEIGHTS = {
  neighborhood: 40,
  language: 30,
  availability: 30,
} as const;

/** 0-100. Higher is better. Deterministic given the same inputs. */
export function scoreCandidate(candidate: TutorCandidate, request: MatchRequest): number {
  let score = 0;

  if (candidate.neighborhood === request.neighborhood) {
    score += SCORE_WEIGHTS.neighborhood;
  }

  if (candidate.languages.includes(request.preferredLanguage)) {
    score += SCORE_WEIGHTS.language;
  }

  if (candidate.responseTimeMinutes !== null) {
    if (candidate.responseTimeMinutes <= 60) {
      score += SCORE_WEIGHTS.availability;
    } else if (candidate.responseTimeMinutes <= 240) {
      score += SCORE_WEIGHTS.availability / 2;
    }
    // > 4h self-reported response time: no availability points, but still
    // an eligible candidate -- self-reported data can be stale, not a
    // reason to exclude someone entirely at MVP scale.
  }

  return score;
}

/**
 * Ranks candidates best-first. Ties break on response time (faster first),
 * then tutorId (stable, deterministic) -- never on insertion order, which
 * would make the ranking depend on arbitrary DB query result ordering.
 */
export function rankCandidates(candidates: TutorCandidate[], request: MatchRequest): TutorCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreDiff = scoreCandidate(b, request) - scoreCandidate(a, request);
    if (scoreDiff !== 0) return scoreDiff;

    const aTime = a.responseTimeMinutes ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.responseTimeMinutes ?? Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    return a.tutorId.localeCompare(b.tutorId);
  });
}
