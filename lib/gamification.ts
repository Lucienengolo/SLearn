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
};

const XP_PER_COMPLETED_LESSON = 10;
const XP_PER_PASSED_QUIZ = 15;

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

export function computeStudentProgress(
  lessons: LessonCompletionRecord[],
  quizAttempts: QuizAttemptRecord[],
  now: Date = new Date()
): StudentProgress {
  const xp = computeXp(lessons, quizAttempts);
  return {
    xp,
    streakDays: computeStreakDays(lessons, quizAttempts, now),
    tier: tierForXp(xp),
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
