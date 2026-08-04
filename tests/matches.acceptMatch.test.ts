import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptMatch } from '../lib/matches';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

// Regression: founder report, 2026-08-04 -- "tutor matching is not working
// correctly." Root cause: acceptMatch() never set parent_timeout_at, so the
// hourly expire_unresponsive_parent_matches() cron (confirmed active in
// production) could never auto-expire a 'messaging' match the parent went
// silent on -- its WHERE clause requires parent_timeout_at is not null.
// That permanently occupied the tutor's one active-match slot, silently
// failing every subsequent match attempt for their subjects. This test
// pins the actual bug: parent_timeout_at must be set, ~48h out.
describe('acceptMatch', () => {
  let updatePayload: Record<string, unknown> | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    updatePayload = undefined;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const builder = {
        update: vi.fn((payload: Record<string, unknown>) => {
          if (table === 'matches') updatePayload = payload;
          return builder;
        }),
        eq: vi.fn(() => Promise.resolve({ error: null })),
      };
      return builder as unknown as ReturnType<typeof supabase.from>;
    });
  });

  it('sets status, tutor_responded_at, messaging_started_at, and parent_timeout_at', async () => {
    const before = Date.now();
    await acceptMatch('match-1');
    const after = Date.now();

    expect(updatePayload).toBeDefined();
    expect(updatePayload?.status).toBe('messaging');
    expect(typeof updatePayload?.tutor_responded_at).toBe('string');
    expect(typeof updatePayload?.messaging_started_at).toBe('string');

    // parent_timeout_at must actually be set (the bug: it was omitted
    // entirely) and land ~48h out, not just any non-null value.
    expect(updatePayload?.parent_timeout_at).toBeDefined();
    const timeoutAt = new Date(updatePayload!.parent_timeout_at as string).getTime();
    const expectedMin = before + 48 * 60 * 60 * 1000;
    const expectedMax = after + 48 * 60 * 60 * 1000;
    expect(timeoutAt).toBeGreaterThanOrEqual(expectedMin);
    expect(timeoutAt).toBeLessThanOrEqual(expectedMax);
  });

  it('throws when the update fails', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      const builder = {
        update: vi.fn(() => builder),
        eq: vi.fn(() => Promise.resolve({ error: { message: 'boom' } })),
      };
      return builder as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(acceptMatch('match-1')).rejects.toBeTruthy();
  });
});
