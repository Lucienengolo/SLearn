import { supabase } from './supabase';

// DESIGN.md "Patterns" (2026-07-23): gamification derived entirely from
// existing lesson_progress/quiz_attempts data -- no new schema, no new
// deploy dependency. Deliberately NOT a competitive leaderboard (ranking
// against other students needs privacy decisions + a cron-driven weekly
// reset, same shape of work as the tutor-matching cron jobs -- out of scope
// here, see TODOS.md). This is a personal-only XP/streak/tier readout.

export type LessonCompletionRecord = { completed: boolean; completed_at: string | null };
export type QuizAttemptRecord = { quiz_id: string; passed: boolean; attempted_at: string };

export type StudentProgressTier = 'Bronze' | 'Silver' | 'Gold';

export type StudentProgress = {
  xp: number;
  streakDays: number;
  tier: StudentProgressTier;
  /** Last 7 calendar days, oldest first, ending today -- for the week-strip UI. */
  last7Days: boolean[];
  /** XP needed to reach the next tier, or null if already at the top tier (Gold). */
  xpToNextTier: number | null;
  /** 0-100 progress toward the next tier (relative to the current tier's own span). Always 100 at Gold. */
  tierProgressPct: number;
};

const XP_PER_COMPLETED_LESSON = 10;
const XP_PER_PASSED_QUIZ = 15;
const TIER_THRESHOLDS: Record<StudentProgressTier, number> = { Bronze: 0, Silver: 100, Gold: 300 };

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function tierForXp(xp: number): StudentProgressTier {
  if (xp >= 300) return 'Gold';
  if (xp >= 100) return 'Silver';
  return 'Bronze';
}

// Counts each quiz's XP once (its first PASS), not once per attempt --
// otherwise a student could farm XP by retrying an already-passed quiz.
function computeXp(lessons: LessonCompletionRecord[], quizAttempts: QuizAttemptRecord[]): number {
  const completedLessons = lessons.filter((l) => l.completed).length;
  const passedQuizIds = new Set(quizAttempts.filter((a) => a.passed).map((a) => a.quiz_id));
  return completedLessons * XP_PER_COMPLETED_LESSON + passedQuizIds.size * XP_PER_PASSED_QUIZ;
}

// Consecutive calendar days of activity (lesson completion or quiz attempt),
// ending today. If today has no activity yet, the streak is still counted
// as "alive" through yesterday -- it only breaks once a full day passes
// with nothing logged (standard streak UX: grace until the day ends).
function computeStreakDays(
  lessons: LessonCompletionRecord[],
  quizAttempts: QuizAttemptRecord[],
  now: Date = new Date()
): number {
  const activityDates = new Set<string>();
  for (const l of lessons) {
    if (l.completed && l.completed_at) activityDates.add(toISODate(new Date(l.completed_at)));
  }
  for (const a of quizAttempts) {
    activityDates.add(toISODate(new Date(a.attempted_at)));
  }

  const cursor = new Date(now);
  if (!activityDates.has(toISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activityDates.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function activityDateSet(lessons: LessonCompletionRecord[], quizAttempts: QuizAttemptRecord[]): Set<string> {
  const dates = new Set<string>();
  for (const l of lessons) {
    if (l.completed && l.completed_at) dates.add(toISODate(new Date(l.completed_at)));
  }
  for (const a of quizAttempts) {
    dates.add(toISODate(new Date(a.attempted_at)));
  }
  return dates;
}

// Oldest-first, ending today -- renders left-to-right as Mon..Sun-style week
// strip (Product Register, DESIGN.md 2026-07-24: matches the Pathfinder
// reference's day-by-day streak row instead of a plain tick count).
function computeLast7Days(
  lessons: LessonCompletionRecord[],
  quizAttempts: QuizAttemptRecord[],
  now: Date = new Date()
): boolean[] {
  const dates = activityDateSet(lessons, quizAttempts);
  const days: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const cursor = new Date(now);
    cursor.setDate(cursor.getDate() - i);
    days.push(dates.has(toISODate(cursor)));
  }
  return days;
}

function computeTierProgress(xp: number, tier: StudentProgressTier): { xpToNextTier: number | null; tierProgressPct: number } {
  if (tier === 'Gold') return { xpToNextTier: null, tierProgressPct: 100 };
  const currentFloor = TIER_THRESHOLDS[tier];
  const nextTier: StudentProgressTier = tier === 'Bronze' ? 'Silver' : 'Gold';
  const nextFloor = TIER_THRESHOLDS[nextTier];
  const span = nextFloor - currentFloor;
  const into = xp - currentFloor;
  return {
    xpToNextTier: nextFloor - xp,
    tierProgressPct: Math.max(0, Math.min(100, Math.round((into / span) * 100))),
  };
}

export function computeStudentProgress(
  lessons: LessonCompletionRecord[],
  quizAttempts: QuizAttemptRecord[],
  now: Date = new Date()
): StudentProgress {
  const xp = computeXp(lessons, quizAttempts);
  const tier = tierForXp(xp);
  const { xpToNextTier, tierProgressPct } = computeTierProgress(xp, tier);
  return {
    xp,
    streakDays: computeStreakDays(lessons, quizAttempts, now),
    tier,
    last7Days: computeLast7Days(lessons, quizAttempts, now),
    xpToNextTier,
    tierProgressPct,
  };
}

export async function fetchStudentProgress(studentId: string): Promise<StudentProgress> {
  const [{ data: lessons }, { data: quizAttempts }] = await Promise.all([
    supabase.from('lesson_progress').select('completed, completed_at').eq('student_id', studentId),
    supabase.from('quiz_attempts').select('quiz_id, passed, attempted_at').eq('student_id', studentId),
  ]);

  return computeStudentProgress(
    (lessons ?? []) as LessonCompletionRecord[],
    (quizAttempts ?? []) as QuizAttemptRecord[]
  );
}
