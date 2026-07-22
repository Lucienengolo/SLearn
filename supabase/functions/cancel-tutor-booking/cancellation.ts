// Pure cancellation-policy logic, framework/runtime-agnostic (no Deno or
// Stripe imports) so it's unit-testable under Vitest. index.ts is the thin
// Deno.serve wrapper + the actual Stripe refund call.

// CEO plan's cancellation policy: full automatic refund if cancelled more
// than 24h before the session; a staff dispute-review queue handles
// cancellations inside that window. No confirmed session date yet (deposit
// paid before a date was set) carries no "scarce slot" risk, so it gets the
// same auto-refund treatment as a comfortably-early cancellation.
export function decideCancellationPath(confirmedSessionDate: string | null, now: Date): 'auto_refund' | 'dispute_review' {
  if (!confirmedSessionDate) return 'auto_refund';
  const hoursUntilSession = (new Date(confirmedSessionDate).getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilSession > 24 ? 'auto_refund' : 'dispute_review';
}

export type RefundAttemptResult = { outcome: 'succeeded' } | { outcome: 'failed'; message: string };

export type RefundOutcome = { succeeded: true } | { succeeded: false; message: string };

// Error & Rescue Registry: "Stripe refund API call fails on cancellation ->
// retry once, then route to the same staff dispute-review queue rather than
// silently failing." Exactly two attempts, never more -- a genuinely down
// Stripe shouldn't turn one cancellation into an unbounded retry loop.
export async function attemptRefundWithRetry(attemptRefund: () => Promise<RefundAttemptResult>): Promise<RefundOutcome> {
  const first = await attemptRefund();
  if (first.outcome === 'succeeded') return { succeeded: true };

  const second = await attemptRefund();
  if (second.outcome === 'succeeded') return { succeeded: true };

  return { succeeded: false, message: second.message };
}
