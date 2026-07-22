import { describe, it, expect, vi } from 'vitest';
import { assignBestAvailableCandidate } from '../supabase/functions/match-tutor-request/assignment.ts';

type Candidate = { tutorId: string };

describe('assignBestAvailableCandidate', () => {
  it('assigns the first candidate when there is no conflict', async () => {
    const candidates: Candidate[] = [{ tutorId: 'a' }, { tutorId: 'b' }];
    const tryAssign = vi.fn(async (c: Candidate) => ({ outcome: 'assigned' as const, candidate: c, result: { id: c.tutorId } }));

    const outcome = await assignBestAvailableCandidate(candidates, tryAssign);

    expect(outcome).toEqual({ assigned: true, candidate: { tutorId: 'a' }, result: { id: 'a' } });
    expect(tryAssign).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next candidate on a concurrent-assignment conflict', async () => {
    // Simulates the exact race Post-Spec-Review item 22 flagged: two
    // requests scoring the same single available tutor. The best-ranked
    // candidate ('a') is already taken by the time this request's insert
    // runs (a real 23505 unique-violation from the DB) -- the second-best
    // candidate ('b') should still get assigned instead of the whole
    // request failing.
    const candidates: Candidate[] = [{ tutorId: 'a' }, { tutorId: 'b' }];
    const tryAssign = vi.fn(async (c: Candidate) => {
      if (c.tutorId === 'a') return { outcome: 'conflict' as const };
      return { outcome: 'assigned' as const, candidate: c, result: { id: c.tutorId } };
    });

    const outcome = await assignBestAvailableCandidate(candidates, tryAssign);

    expect(outcome).toEqual({ assigned: true, candidate: { tutorId: 'b' }, result: { id: 'b' } });
    expect(tryAssign).toHaveBeenCalledTimes(2);
  });

  it('reports no_candidates_available when every candidate conflicts', async () => {
    const candidates: Candidate[] = [{ tutorId: 'a' }, { tutorId: 'b' }];
    const tryAssign = vi.fn(async () => ({ outcome: 'conflict' as const }));

    const outcome = await assignBestAvailableCandidate(candidates, tryAssign);

    expect(outcome).toEqual({ assigned: false, reason: 'no_candidates_available' });
  });

  it('reports no_candidates_available immediately when given an empty candidate list', async () => {
    const tryAssign = vi.fn();
    const outcome = await assignBestAvailableCandidate([], tryAssign);

    expect(outcome).toEqual({ assigned: false, reason: 'no_candidates_available' });
    expect(tryAssign).not.toHaveBeenCalled();
  });

  it('stops immediately on a hard error instead of trying remaining candidates', async () => {
    const candidates: Candidate[] = [{ tutorId: 'a' }, { tutorId: 'b' }];
    const tryAssign = vi.fn(async () => ({ outcome: 'error' as const, message: 'connection reset' }));

    const outcome = await assignBestAvailableCandidate(candidates, tryAssign);

    expect(outcome).toEqual({ assigned: false, reason: 'error', message: 'connection reset' });
    expect(tryAssign).toHaveBeenCalledTimes(1);
  });
});
