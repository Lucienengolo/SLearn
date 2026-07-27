import { supabase } from './supabase';

// Wraps the get_global_league/get_course_league/get_instructor_league
// security-definer RPCs (0038_league.sql). These compute rankings live from
// lesson_progress/quiz_attempts server-side -- there is no client-readable
// table of other students' raw progress to query directly, by design (RLS
// only lets a student read their own rows).

export type LeagueRow = {
  studentId: string;
  fullName: string | null;
  totem: string | null;
  xp: number;
  rank: number;
  isMe?: boolean;
};

type RawLeagueRow = {
  student_id: string;
  full_name: string | null;
  totem: string | null;
  xp: number;
  rank: number;
  is_me?: boolean;
};

function toLeagueRow(row: RawLeagueRow): LeagueRow {
  return {
    studentId: row.student_id,
    fullName: row.full_name,
    totem: row.totem,
    xp: row.xp,
    rank: row.rank,
    isMe: row.is_me,
  };
}

export async function fetchGlobalLeague(limit = 50): Promise<LeagueRow[]> {
  const { data, error } = await supabase.rpc('get_global_league', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as RawLeagueRow[]).map(toLeagueRow);
}

export async function fetchCourseLeague(courseId: string, limit = 50): Promise<LeagueRow[]> {
  const { data, error } = await supabase.rpc('get_course_league', { p_course_id: courseId, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as RawLeagueRow[]).map(toLeagueRow);
}

export async function fetchInstructorLeague(courseId: string | null, limit = 100): Promise<LeagueRow[]> {
  const { data, error } = await supabase.rpc('get_instructor_league', { p_course_id: courseId, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as RawLeagueRow[]).map(toLeagueRow);
}

export type StudentCourseOption = { courseId: string; title: string };

// Powers the Classroom League course-switcher dropdown -- the courses a
// student is actually enrolled in (each is its own leaderboard).
export async function fetchStudentCourseOptions(studentId: string): Promise<StudentCourseOption[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id, course:courses(title)')
    .eq('student_id', studentId);
  if (error) throw error;
  return ((data ?? []) as unknown as { course_id: string; course: { title: string } | null }[]).map((row) => ({
    courseId: row.course_id,
    title: row.course?.title ?? 'Untitled course',
  }));
}
