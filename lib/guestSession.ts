// Guest mode: unauthenticated visitors can browse and complete free courses.
// Progress and XP live in sessionStorage only — no server writes, and it
// disappears the moment the browser tab/session ends (by design, per README
// §5.A). There is no migration path into a real account; if a guest signs
// up, they start fresh like any new student.
type GuestSessionData = {
  enrolledCourseIds: string[];
  completedLessonIds: string[];
  xp: number;
};

const STORAGE_KEY = 'slearn_guest_session_v1';
const XP_PER_LESSON = 10;

export const GUEST_XP_EVENT = 'slearn:guest-xp-changed';

function readSession(): GuestSessionData {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { enrolledCourseIds: [], completedLessonIds: [], xp: 0 };
    return JSON.parse(raw);
  } catch {
    return { enrolledCourseIds: [], completedLessonIds: [], xp: 0 };
  }
}

function writeSession(data: GuestSessionData) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isGuestEnrolled(courseId: string): boolean {
  return readSession().enrolledCourseIds.includes(courseId);
}

export function guestEnroll(courseId: string): void {
  const session = readSession();
  if (!session.enrolledCourseIds.includes(courseId)) {
    session.enrolledCourseIds.push(courseId);
    writeSession(session);
  }
}

export function isGuestLessonComplete(lessonId: string): boolean {
  return readSession().completedLessonIds.includes(lessonId);
}

export function completeGuestLesson(lessonId: string): void {
  const session = readSession();
  if (session.completedLessonIds.includes(lessonId)) return;
  session.completedLessonIds.push(lessonId);
  session.xp += XP_PER_LESSON;
  writeSession(session);
  window.dispatchEvent(new Event(GUEST_XP_EVENT));
}

export function getGuestCourseProgress(lessonIds: string[]): number {
  if (lessonIds.length === 0) return 0;
  const { completedLessonIds } = readSession();
  const completed = lessonIds.filter((id) => completedLessonIds.includes(id)).length;
  return Math.round((completed / lessonIds.length) * 100);
}

export function getGuestXP(): number {
  return readSession().xp;
}
