import { describe, it, expect } from 'vitest';
import { scoreCandidate, rankCandidates, type TutorCandidate, type MatchRequest } from '../supabase/functions/match-tutor-request/scoring.ts';

const request: MatchRequest = { neighborhood: 'Bonamoussadi', preferredLanguage: 'fr' };

function candidate(overrides: Partial<TutorCandidate> = {}): TutorCandidate {
  return {
    tutorId: 'tutor-a',
    neighborhood: 'Bonamoussadi',
    languages: ['fr'],
    responseTimeMinutes: 30,
    ...overrides,
  };
}

describe('scoreCandidate', () => {
  it('gives full marks to a tutor matching neighborhood, language, and fast response', () => {
    expect(scoreCandidate(candidate(), request)).toBe(100);
  });

  it('withholds neighborhood points for a tutor in a different area', () => {
    expect(scoreCandidate(candidate({ neighborhood: 'Akwa' }), request)).toBe(60);
  });

  it('withholds language points for a tutor who does not speak the requested language', () => {
    expect(scoreCandidate(candidate({ languages: ['en'] }), request)).toBe(70);
  });

  it('gives half availability credit for a 2-4h response time', () => {
    expect(scoreCandidate(candidate({ responseTimeMinutes: 120 }), request)).toBe(85);
  });

  it('gives zero availability credit for a >4h response time, but does not exclude the candidate', () => {
    expect(scoreCandidate(candidate({ responseTimeMinutes: 600 }), request)).toBe(70);
  });

  it('gives zero availability credit when response time was never self-reported', () => {
    expect(scoreCandidate(candidate({ responseTimeMinutes: null }), request)).toBe(70);
  });

  it('does not score budget at all -- only the four Eng Review E6 factors exist', () => {
    // No budget field on TutorCandidate/MatchRequest is itself the assertion:
    // this test exists so a future change adding one gets caught by a type
    // error here, not silently expanding what E6 reviewed.
    const full = candidate();
    expect(scoreCandidate(full, request)).toBe(scoreCandidate(full, { ...request }));
  });
});

describe('rankCandidates', () => {
  it('ranks a full-match candidate above a partial-match candidate', () => {
    const perfect = candidate({ tutorId: 'perfect' });
    const partial = candidate({ tutorId: 'partial', neighborhood: 'Akwa' });
    const ranked = rankCandidates([partial, perfect], request);
    expect(ranked.map((c) => c.tutorId)).toEqual(['perfect', 'partial']);
  });

  it('breaks a tied score by faster response time', () => {
    const slow = candidate({ tutorId: 'slow', responseTimeMinutes: 55 });
    const fast = candidate({ tutorId: 'fast', responseTimeMinutes: 10 });
    const ranked = rankCandidates([slow, fast], request);
    expect(ranked.map((c) => c.tutorId)).toEqual(['fast', 'slow']);
  });

  it('breaks a fully tied score deterministically by tutorId', () => {
    const b = candidate({ tutorId: 'b' });
    const a = candidate({ tutorId: 'a' });
    const ranked = rankCandidates([b, a], request);
    expect(ranked.map((c) => c.tutorId)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [candidate({ tutorId: 'z' }), candidate({ tutorId: 'a' })];
    const originalOrder = input.map((c) => c.tutorId);
    rankCandidates(input, request);
    expect(input.map((c) => c.tutorId)).toEqual(originalOrder);
  });
});
