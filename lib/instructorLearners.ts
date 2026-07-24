import { supabase, Course } from './supabase';

// Data layer for the centralized "S@Learn Classroom" page (2026-07-24) --
// same shape of aggregation as CourseStudents.tsx's per-course fetch, but
// across EVERY course the instructor owns. Kept as pure, separately
// testable functions (unlike CourseStudents.tsx's inline logic) because the
// multi-course averaging here is genuinely more complex and worth locking
// down with unit tests.

export type LearnerRow = {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  courseTitle: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  enrolledAt: string;
  completedAt: string | null;
  progressPercentage: number;
  hasCertificate: boolean;
  lastActivityAt: string;
  isStale: boolean;
};

export type CourseProgressBar = { courseId: string; courseTitle: string; averageProgress: number };

export const STALE_THRESHOLD_DAYS = 14;

type RawEnrollment = {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_percentage: number;
  student: { full_name: string | null; email: string; avatar_url: string | null } | null;
};

// Pure: builds learner rows from already-fetched raw data. `lastActivityKey`
// is `${studentId}:${courseId}` so a student enrolled in 2 courses gets an
// independent staleness read per course, not one blended read.
export function buildLearnerRows(
  enrollments: RawEnrollment[],
  courseTitleById: Map<string, string>,
  certifiedKeys: Set<string>,
  lastActivityByKey: Map<string, string>,
  now: Date = new Date()
): LearnerRow[] {
  const staleCutoff = now.getTime() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  return enrollments.map((e) => {
    const key = `${e.student_id}:${e.course_id}`;
    const lastActivityAt = lastActivityByKey.get(key) ?? e.enrolled_at;
    return {
      enrollmentId: e.id,
      studentId: e.student_id,
      courseId: e.course_id,
      courseTitle: courseTitleById.get(e.course_id) ?? 'Unknown course',
      fullName: e.student?.full_name || e.student?.email || 'Unknown student',
      email: e.student?.email || '',
      avatarUrl: e.student?.avatar_url ?? null,
      enrolledAt: e.enrolled_at,
      completedAt: e.completed_at,
      progressPercentage: e.progress_percentage,
      hasCertificate: certifiedKeys.has(key),
      lastActivityAt,
      isStale: !e.completed_at && new Date(lastActivityAt).getTime() < staleCutoff,
    };
  });
}

// Pure: one bar per course, average progress across that course's enrolled
// students. Courses with zero enrollments still appear (0%), matching the
// reference's "always show every subject" chart shape.
export function computeCourseProgressBars(
  rows: LearnerRow[],
  courses: { id: string; title: string }[]
): CourseProgressBar[] {
  return courses.map((c) => {
    const courseRows = rows.filter((r) => r.courseId === c.id);
    const averageProgress = courseRows.length
      ? Math.round(courseRows.reduce((sum, r) => sum + r.progressPercentage, 0) / courseRows.length)
      : 0;
    return { courseId: c.id, courseTitle: c.title, averageProgress };
  });
}

export type InstructorLearnersData = {
  courses: Course[];
  rows: LearnerRow[];
  totalQuizAttempts: number;
};

export async function fetchInstructorLearners(instructorId: string): Promise<InstructorLearnersData> {
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });

  const courseList = (courses ?? []) as Course[];
  const courseIds = courseList.map((c) => c.id);
  const courseTitleById = new Map(courseList.map((c) => [c.id, c.title]));

  if (courseIds.length === 0) {
    return { courses: [], rows: [], totalQuizAttempts: 0 };
  }

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(
      `id, student_id, course_id, enrolled_at, completed_at, progress_percentage,
       student:profiles!student_id(full_name, email, avatar_url)`
    )
    .in('course_id', courseIds)
    .order('enrolled_at', { ascending: false });

  const { data: certificates } = await supabase
    .from('certificates')
    .select('student_id, course_id')
    .in('course_id', courseIds);

  const certifiedKeys = new Set(
    (certificates ?? []).map((c: { student_id: string; course_id: string }) => `${c.student_id}:${c.course_id}`)
  );

  const { data: lessons } = await supabase.from('lessons').select('id, course_id').in('course_id', courseIds);
  const lessonList = (lessons ?? []) as { id: string; course_id: string }[];
  const courseIdByLessonId = new Map(lessonList.map((l) => [l.id, l.course_id]));
  const lessonIds = lessonList.map((l) => l.id);

  const { data: progressRows } = lessonIds.length
    ? await supabase.from('lesson_progress').select('student_id, lesson_id, updated_at').in('lesson_id', lessonIds)
    : { data: [] as { student_id: string; lesson_id: string; updated_at: string }[] };

  const lastActivityByKey = new Map<string, string>();
  for (const p of (progressRows ?? []) as { student_id: string; lesson_id: string; updated_at: string }[]) {
    const courseId = courseIdByLessonId.get(p.lesson_id);
    if (!courseId) continue;
    const key = `${p.student_id}:${courseId}`;
    const current = lastActivityByKey.get(key);
    if (!current || new Date(p.updated_at) > new Date(current)) {
      lastActivityByKey.set(key, p.updated_at);
    }
  }

  const { data: quizzes } = lessonIds.length
    ? await supabase.from('quizzes').select('id').in('lesson_id', lessonIds)
    : { data: [] as { id: string }[] };
  const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
  const { count: totalQuizAttempts } = quizIds.length
    ? await supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).in('quiz_id', quizIds)
    : { count: 0 };

  const rows = buildLearnerRows(
    (enrollments ?? []) as unknown as RawEnrollment[],
    courseTitleById,
    certifiedKeys,
    lastActivityByKey
  );

  return { courses: courseList, rows, totalQuizAttempts: totalQuizAttempts ?? 0 };
}
