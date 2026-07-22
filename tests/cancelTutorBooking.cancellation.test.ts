import { describe, it, expect, vi } from 'vitest';
import { decideCancellationPath, attemptRefundWithRetry } from '../supabase/functions/cancel-tutor-booking/cancellation.ts';

describe('decideCancellationPath', () => {
  const now = new Date('2026-08-01T12:00:00Z');

  it('routes to auto_refund when the session is more than 24h away', () => {
    const sessionDate = new Date('2026-08-03T12:00:00Z').toISOString(); // 48h out
    expect(decideCancellationPath(sessionDate, now)).toBe('auto_refund');
  });

  it('routes to dispute_review when the session is less than 24h away', () => {
    const sessionDate = new Date('2026-08-01T20:00:00Z').toISOString(); // 8h out
    expect(decideCancellationPath(sessionDate, now)).toBe('dispute_review');
  });

  it('routes to dispute_review exactly at the 24h boundary (not inclusive)', () => {
    const sessionDate = new Date('2026-08-02T12:00:00Z').toISOString(); // exactly 24h
    expect(decideCancellationPath(sessionDate, now)).toBe('dispute_review');
  });

  it('routes to auto_refund when no session date has been confirmed yet', () => {
    expect(decideCancellationPath(null, now)).toBe('auto_refund');
  });

  it('routes to dispute_review for a session date already in the past', () => {
    const sessionDate = new Date('2026-07-30T12:00:00Z').toISOString();
    expect(decideCancellationPath(sessionDate, now)).toBe('dispute_review');
  });
});

describe('attemptRefundWithRetry', () => {
  it('succeeds immediately without a second attempt when the first refund works', async () => {
    const attempt = vi.fn(async () => ({ outcome: 'succeeded' as const }));
    const outcome = await attemptRefundWithRetry(attempt);
    expect(outcome).toEqual({ succeeded: true });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once and succeeds on the second attempt', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'failed', message: 'card declined' })
      .mockResolvedValueOnce({ outcome: 'succeeded' });
    const outcome = await attemptRefundWithRetry(attempt);
    expect(outcome).toEqual({ succeeded: true });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('gives up after exactly two failed attempts and surfaces the second error', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'failed', message: 'network error' })
      .mockResolvedValueOnce({ outcome: 'failed', message: 'still down' });
    const outcome = await attemptRefundWithRetry(attempt);
    expect(outcome).toEqual({ succeeded: false, message: 'still down' });
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
