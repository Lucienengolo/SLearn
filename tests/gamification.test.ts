import { describe, it, expect } from 'vitest';
import { computeStudentProgress, tierForXp } from '../lib/gamification';

describe('tierForXp', () => {
  it('returns Bronze below 100 XP, Silver at 100-299, Gold at 300+', () => {
    expect(tierForXp(0)).toBe('Bronze');
    expect(tierForXp(99)).toBe('Bronze');
    expect(tierForXp(100)).toBe('Silver');
    expect(tierForXp(299)).toBe('Silver');
    expect(tierForXp(300)).toBe('Gold');
  });
});

describe('computeStudentProgress', () => {
  it('returns zero XP and zero streak with no activity', () => {
    const result = computeStudentProgress([], []);
    expect(result.xp).toBe(0);
    expect(result.streakDays).toBe(0);
    expect(result.tier).toBe('Bronze');
    expect(result.last7Days).toEqual([false, false, false, false, false, false, false]);
    expect(result.xpToNextTier).toBe(100);
    expect(result.tierProgressPct).toBe(0);
  });

  it('awards 10 XP per completed lesson, ignoring incomplete ones', () => {
    const result = computeStudentProgress(
      [
        { completed: true, completed_at: '2026-07-20T10:00:00Z' },
        { completed: true, completed_at: '2026-07-21T10:00:00Z' },
        { completed: false, completed_at: null },
      ],
      []
    );
    expect(result.xp).toBe(20);
  });

  it('awards 15 XP per distinct passed quiz, counting a retried quiz only once', () => {
    const result = computeStudentProgress(
      [],
      [
        { quiz_id: 'q1', passed: false, attempted_at: '2026-07-20T10:00:00Z' },
        { quiz_id: 'q1', passed: true, attempted_at: '2026-07-20T11:00:00Z' },
        { quiz_id: 'q1', passed: true, attempted_at: '2026-07-21T11:00:00Z' },
        { quiz_id: 'q2', passed: true, attempted_at: '2026-07-21T12:00:00Z' },
      ]
    );
    // q1 counted once despite 2 passing attempts + 1 failed attempt, q2 once
    expect(result.xp).toBe(30);
  });

  it('counts a 3-day consecutive streak ending today', () => {
    const now = new Date('2026-07-23T18:00:00Z');
    const result = computeStudentProgress(
      [
        { completed: true, completed_at: '2026-07-21T10:00:00Z' },
        { completed: true, completed_at: '2026-07-22T10:00:00Z' },
        { completed: true, completed_at: '2026-07-23T10:00:00Z' },
      ],
      [],
      now
    );
    expect(result.streakDays).toBe(3);
  });

  it('keeps the streak alive through end-of-day when today has no activity yet', () => {
    const now = new Date('2026-07-23T08:00:00Z');
    const result = computeStudentProgress(
      [
        { completed: true, completed_at: '2026-07-21T10:00:00Z' },
        { completed: true, completed_at: '2026-07-22T10:00:00Z' },
      ],
      [],
      now
    );
    expect(result.streakDays).toBe(2);
  });

  it('breaks the streak when a full day is missed', () => {
    const now = new Date('2026-07-23T18:00:00Z');
    const result = computeStudentProgress(
      [
        { completed: true, completed_at: '2026-07-20T10:00:00Z' },
        // 2026-07-21 and 2026-07-22 missing
        { completed: true, completed_at: '2026-07-23T10:00:00Z' },
      ],
      [],
      now
    );
    expect(result.streakDays).toBe(1);
  });

  it('counts a quiz attempt (pass or fail) toward the streak, not just lesson completions', () => {
    const now = new Date('2026-07-23T18:00:00Z');
    const result = computeStudentProgress(
      [],
      [{ quiz_id: 'q1', passed: false, attempted_at: '2026-07-23T10:00:00Z' }],
      now
    );
    expect(result.streakDays).toBe(1);
  });

  it('builds a 7-day week strip oldest-first, ending today', () => {
    const now = new Date('2026-07-23T18:00:00Z');
    const result = computeStudentProgress(
      [
        { completed: true, completed_at: '2026-07-21T10:00:00Z' }, // 2 days ago
        { completed: true, completed_at: '2026-07-23T10:00:00Z' }, // today
      ],
      [],
      now
    );
    // index 4 = 2 days ago (2026-07-21), index 6 = today (2026-07-23)
    expect(result.last7Days).toEqual([false, false, false, false, true, false, true]);
  });

  it('reports XP-to-next-tier and progress percent within the current tier band', () => {
    const bronze = computeStudentProgress(
      [{ completed: true, completed_at: '2026-07-23T10:00:00Z' }, { completed: true, completed_at: '2026-07-22T10:00:00Z' }],
      [],
      new Date('2026-07-23T18:00:00Z')
    ); // 20 XP
    expect(bronze.xpToNextTier).toBe(80);
    expect(bronze.tierProgressPct).toBe(20);

    const gold = computeStudentProgress(
      Array.from({ length: 40 }, (_, i) => ({
        completed: true,
        completed_at: `2026-07-${String((i % 20) + 1).padStart(2, '0')}T10:00:00Z`,
      })),
      [],
      new Date('2026-07-23T18:00:00Z')
    ); // 400 XP, well past the Gold floor
    expect(gold.tier).toBe('Gold');
    expect(gold.xpToNextTier).toBeNull();
    expect(gold.tierProgressPct).toBe(100);
  });
});
