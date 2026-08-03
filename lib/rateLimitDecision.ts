// Pure decision logic for middleware.ts's adaptive per-IP rate limiting
// (2026-08-03, pre-beta WAF work -- see SECURITY.md). Kept separate from
// the Vercel-specific request/cache plumbing so it's testable without
// mocking the Edge runtime: given a snapshot of an IP's current state,
// decide what should happen, with no I/O of its own.
//
// Escalation model: throttle once a fixed-window request count is
// exceeded; each throttle within the violation window counts toward a
// temporary ban. Thresholds are deliberately generous starting points --
// tune after reviewing real traffic in LOG_ONLY mode (see middleware.ts),
// same "start generous, tighten later" philosophy as Vercel's own WAF
// custom-rule rollout.
export const RATE_LIMIT_CONFIG = {
  windowSeconds: 10,
  throttleThreshold: 60,
  violationWindowSeconds: 3600,
  violationEscalationThreshold: 5,
  banDurationSeconds: 1800,
} as const;

export type RateLimitInput = {
  isBanned: boolean;
  // Request count in the current fixed window, INCLUDING this request.
  requestCountInWindow: number;
  // Violation count BEFORE this request (not yet incremented).
  violationCountBeforeThisRequest: number;
};

export type RateLimitDecision =
  | { action: 'allow' }
  | { action: 'banned' }
  | { action: 'throttle'; newViolationCount: number; shouldBan: boolean };

export function decideRateLimitAction(input: RateLimitInput): RateLimitDecision {
  if (input.isBanned) {
    return { action: 'banned' };
  }

  if (input.requestCountInWindow <= RATE_LIMIT_CONFIG.throttleThreshold) {
    return { action: 'allow' };
  }

  const newViolationCount = input.violationCountBeforeThisRequest + 1;
  return {
    action: 'throttle',
    newViolationCount,
    shouldBan: newViolationCount >= RATE_LIMIT_CONFIG.violationEscalationThreshold,
  };
}
