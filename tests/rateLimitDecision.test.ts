import { describe, it, expect } from 'vitest';
import { decideRateLimitAction, RATE_LIMIT_CONFIG } from '../lib/rateLimitDecision';

describe('decideRateLimitAction', () => {
  it('allows a request under the throttle threshold', () => {
    const decision = decideRateLimitAction({
      isBanned: false,
      requestCountInWindow: RATE_LIMIT_CONFIG.throttleThreshold,
      violationCountBeforeThisRequest: 0,
    });
    expect(decision).toEqual({ action: 'allow' });
  });

  it('throttles a request that crosses the threshold, without banning', () => {
    const decision = decideRateLimitAction({
      isBanned: false,
      requestCountInWindow: RATE_LIMIT_CONFIG.throttleThreshold + 1,
      violationCountBeforeThisRequest: 0,
    });
    expect(decision).toEqual({ action: 'throttle', newViolationCount: 1, shouldBan: false });
  });

  it('accumulates violations across separate throttled requests', () => {
    const decision = decideRateLimitAction({
      isBanned: false,
      requestCountInWindow: RATE_LIMIT_CONFIG.throttleThreshold + 1,
      violationCountBeforeThisRequest: 2,
    });
    expect(decision).toEqual({ action: 'throttle', newViolationCount: 3, shouldBan: false });
  });

  it('escalates to a ban once violations reach the escalation threshold', () => {
    const decision = decideRateLimitAction({
      isBanned: false,
      requestCountInWindow: RATE_LIMIT_CONFIG.throttleThreshold + 1,
      violationCountBeforeThisRequest: RATE_LIMIT_CONFIG.violationEscalationThreshold - 1,
    });
    expect(decision).toEqual({
      action: 'throttle',
      newViolationCount: RATE_LIMIT_CONFIG.violationEscalationThreshold,
      shouldBan: true,
    });
  });

  it('keeps escalating shouldBan for any violation count past the threshold', () => {
    const decision = decideRateLimitAction({
      isBanned: false,
      requestCountInWindow: RATE_LIMIT_CONFIG.throttleThreshold + 1,
      violationCountBeforeThisRequest: RATE_LIMIT_CONFIG.violationEscalationThreshold + 10,
    });
    expect(decision.action).toBe('throttle');
    expect(decision).toMatchObject({ shouldBan: true });
  });

  it('short-circuits to banned regardless of request count once isBanned is true', () => {
    const decision = decideRateLimitAction({
      isBanned: true,
      requestCountInWindow: 1,
      violationCountBeforeThisRequest: 0,
    });
    expect(decision).toEqual({ action: 'banned' });
  });
});
