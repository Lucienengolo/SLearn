// 72-hour max-session enforcement (founder request, 2026-08-01, Batch 7 of
// the beta-readiness roadmap -- "setup a session ending to handle
// connexion of more than 72H"). This is a MAX-duration cap counted from
// the original sign-in, not an idle timeout -- the clock is only reset on
// a genuine new SIGNED_IN event, never on a silent TOKEN_REFRESHED (that
// would defeat the whole point: a token that quietly refreshes forever
// would never expire).
//
// This is defense-in-depth, not the authoritative control: it's enforced
// client-side, so it only fires while the app is actually open in a
// browser tab -- a token that's never opened in a browser again after
// 72h isn't touched by this code at all. The real, server-side control is
// Supabase's own Dashboard -> Authentication -> Sessions/JWT expiry
// settings, which this code can't configure (that's account
// configuration, not application code) -- flagged as a manual follow-up
// for the founder in TODOS.md.
const SESSION_START_KEY = 'slearn_session_started_at';
export const SESSION_MAX_DURATION_MS = 72 * 60 * 60 * 1000;

export function markSessionStart(): void {
  localStorage.setItem(SESSION_START_KEY, String(Date.now()));
}

export function clearSessionStart(): void {
  localStorage.removeItem(SESSION_START_KEY);
}

// No tracked start time (a session that existed before this feature
// shipped, or localStorage was cleared independently of the Supabase
// session) is treated as "not yet expired, start counting from now" --
// not as "expired," and not as "infinitely valid." Blaming an existing
// session for a duration this code never had the chance to observe would
// surprise-log-out real users the moment this ships; establishing a fresh
// baseline is the honest middle ground.
export function isSessionExpired(): boolean {
  const raw = localStorage.getItem(SESSION_START_KEY);
  const startedAt = raw ? Number(raw) : NaN;

  if (raw === null || Number.isNaN(startedAt)) {
    markSessionStart();
    return false;
  }

  return Date.now() - startedAt > SESSION_MAX_DURATION_MS;
}
