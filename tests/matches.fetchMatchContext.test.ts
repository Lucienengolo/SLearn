import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMatchContext } from '../lib/matches';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function makeBuilder(data: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data, error: null })),
      })),
    })),
  };
}

// Regression: performance audit, 2026-08-07 -- Chat.tsx and PaymentStatus.tsx
// both independently call fetchMatchContext(matchId), and started mounting
// side by side in SLearnClassroom.tsx's tutor-match detail view, doubling
// all four of this function's underlying queries on every visit. In-flight
// calls for the same matchId now share one request.
describe('fetchMatchContext request dedup', () => {
  let fromCallCount: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    fromCallCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      fromCallCount++;
      if (table === 'matches') return makeBuilder({ id: 'match-1', request_id: 'req-1', tutor_id: 'tutor-1' }) as unknown as ReturnType<typeof supabase.from>;
      if (table === 'tutor_requests') return makeBuilder({ id: 'req-1' }) as unknown as ReturnType<typeof supabase.from>;
      if (table === 'public_profiles') return makeBuilder({ id: 'tutor-1', full_name: 'Tutor' }) as unknown as ReturnType<typeof supabase.from>;
      if (table === 'tutor_profile_fields') return makeBuilder({ tutor_id: 'tutor-1' }) as unknown as ReturnType<typeof supabase.from>;
      throw new Error(`unexpected table ${table}`);
    });
  });

  it('dedupes concurrent calls for the same matchId into a single set of queries', async () => {
    const [a, b] = await Promise.all([fetchMatchContext('match-1'), fetchMatchContext('match-1')]);

    expect(a).toBe(b);
    expect(fromCallCount).toBe(4); // matches, tutor_requests, public_profiles, tutor_profile_fields -- once each
  });

  it('does not dedupe a later call once the first has already resolved', async () => {
    await fetchMatchContext('match-1');
    await fetchMatchContext('match-1');

    expect(fromCallCount).toBe(8);
  });

  it('does not dedupe concurrent calls for different matchIds', async () => {
    await Promise.all([fetchMatchContext('match-1'), fetchMatchContext('match-2')]);

    expect(fromCallCount).toBe(8);
  });
});
