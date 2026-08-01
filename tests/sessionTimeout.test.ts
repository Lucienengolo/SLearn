import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { markSessionStart, clearSessionStart, isSessionExpired, SESSION_MAX_DURATION_MS } from '../lib/sessionTimeout';

describe('sessionTimeout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not expired right after marking session start', () => {
    markSessionStart();
    expect(isSessionExpired()).toBe(false);
  });

  it('is not expired just under 72 hours later', () => {
    markSessionStart();
    vi.advanceTimersByTime(SESSION_MAX_DURATION_MS - 1000);
    expect(isSessionExpired()).toBe(false);
  });

  it('is expired just over 72 hours later', () => {
    markSessionStart();
    vi.advanceTimersByTime(SESSION_MAX_DURATION_MS + 1000);
    expect(isSessionExpired()).toBe(true);
  });

  it('clearSessionStart removes the marker so the next check re-baselines instead of reporting expired', () => {
    markSessionStart();
    vi.advanceTimersByTime(SESSION_MAX_DURATION_MS + 1000);
    clearSessionStart();

    // No marker at all -- treated as "start counting from now," not expired.
    expect(isSessionExpired()).toBe(false);
  });

  // Regression: a session that existed before this feature shipped (or
  // whose marker was cleared independently of the Supabase session itself)
  // must not be immediately logged out the moment this code starts
  // running -- that would surprise-log-out real users on deploy day.
  it('treats a missing marker as "not yet expired, start counting from now" rather than expired', () => {
    expect(localStorage.getItem('slearn_session_started_at')).toBeNull();
    expect(isSessionExpired()).toBe(false);
    // A baseline should now be set so the NEXT check has something to compare against.
    expect(localStorage.getItem('slearn_session_started_at')).not.toBeNull();
  });

  it('treats a corrupted marker value the same as a missing one', () => {
    localStorage.setItem('slearn_session_started_at', 'not-a-number');
    expect(isSessionExpired()).toBe(false);
    expect(localStorage.getItem('slearn_session_started_at')).not.toBe('not-a-number');
  });
});
