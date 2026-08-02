import { describe, it, expect } from 'vitest';
import { buildLearnerRows, computeCourseProgressBars, LearnerRow } from '../lib/instructorLearners';

describe('buildLearnerRows', () => {
  const now = new Date('2026-07-24T18:00:00Z');
  const courseTitleById = new Map([
    ['course-1', 'Course A'],
    ['course-2', 'Course B'],
  ]);

  it('attaches the right course title and computes staleness per (student, course) pair independently', () => {
    const rows = buildLearnerRows(
      [
        {
          id: 'enr-1',
          student_id: 'student-1',
          course_id: 'course-1',
          enrolled_at: '2026-06-01T00:00:00Z',
          completed_at: null,
          progress_percentage: 40,
          student: { full_name: 'Jane Doe', avatar_url: null },
        },
        {
          id: 'enr-2',
          student_id: 'student-1',
          course_id: 'course-2',
          enrolled_at: '2026-06-01T00:00:00Z',
          completed_at: null,
          progress_percentage: 60,
          student: { full_name: 'Jane Doe', avatar_url: null },
        },
      ],
      courseTitleById,
      new Set(),
      new Map([
        ['student-1:course-1', '2026-06-05T00:00:00Z'], // stale (49 days ago)
        ['student-1:course-2', '2026-07-23T00:00:00Z'], // fresh (yesterday)
      ]),
      new Map([['student-1', 'jane@example.com']]),
      now
    );

    expect(rows).toHaveLength(2);
    const courseARow = rows.find((r) => r.courseId === 'course-1')!;
    const courseBRow = rows.find((r) => r.courseId === 'course-2')!;

    expect(courseARow.courseTitle).toBe('Course A');
    expect(courseARow.isStale).toBe(true);
    expect(courseBRow.courseTitle).toBe('Course B');
    expect(courseBRow.isStale).toBe(false);
  });

  it('marks certificates per (student, course) key, not globally per student', () => {
    const rows = buildLearnerRows(
      [
        {
          id: 'enr-1',
          student_id: 'student-1',
          course_id: 'course-1',
          enrolled_at: '2026-06-01T00:00:00Z',
          completed_at: '2026-06-10T00:00:00Z',
          progress_percentage: 100,
          student: { full_name: 'Jane Doe', avatar_url: null },
        },
        {
          id: 'enr-2',
          student_id: 'student-1',
          course_id: 'course-2',
          enrolled_at: '2026-06-01T00:00:00Z',
          completed_at: null,
          progress_percentage: 20,
          student: { full_name: 'Jane Doe', avatar_url: null },
        },
      ],
      courseTitleById,
      new Set(['student-1:course-1']),
      new Map(),
      new Map([['student-1', 'jane@example.com']]),
      now
    );

    expect(rows.find((r) => r.courseId === 'course-1')!.hasCertificate).toBe(true);
    expect(rows.find((r) => r.courseId === 'course-2')!.hasCertificate).toBe(false);
  });

  it('never flags a completed enrollment as stale even with no recent activity', () => {
    const rows = buildLearnerRows(
      [
        {
          id: 'enr-1',
          student_id: 'student-1',
          course_id: 'course-1',
          enrolled_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-15T00:00:00Z',
          progress_percentage: 100,
          student: { full_name: 'Jane Doe', avatar_url: null },
        },
      ],
      courseTitleById,
      new Set(),
      new Map(),
      new Map([['student-1', 'jane@example.com']]),
      now
    );
    expect(rows[0].isStale).toBe(false);
  });

  // Regression: profiles.email is no longer selectable via a plain
  // embedded join (2026-08-02 security fix) -- email now comes from a
  // separate emailByStudentId map (populated by the get_my_students_emails
  // RPC), not the embedded `student` object.
  it('takes email from the emailByStudentId map, not the embedded student object', () => {
    const rows = buildLearnerRows(
      [
        {
          id: 'enr-1',
          student_id: 'student-1',
          course_id: 'course-1',
          enrolled_at: '2026-06-01T00:00:00Z',
          completed_at: null,
          progress_percentage: 40,
          student: { full_name: null, avatar_url: null },
        },
      ],
      courseTitleById,
      new Set(),
      new Map(),
      new Map([['student-1', 'jane@example.com']]),
      now
    );

    expect(rows[0].email).toBe('jane@example.com');
    // full_name falls back to email when the student never set a display name.
    expect(rows[0].fullName).toBe('jane@example.com');
  });

  it('leaves email empty when the RPC has no entry for that student', () => {
    const rows = buildLearnerRows(
      [
        {
          id: 'enr-1',
          student_id: 'student-1',
          course_id: 'course-1',
          enrolled_at: '2026-06-01T00:00:00Z',
          completed_at: null,
          progress_percentage: 40,
          student: { full_name: 'Jane Doe', avatar_url: null },
        },
      ],
      courseTitleById,
      new Set(),
      new Map(),
      new Map(),
      now
    );

    expect(rows[0].email).toBe('');
    expect(rows[0].fullName).toBe('Jane Doe');
  });
});

describe('computeCourseProgressBars', () => {
  it('averages progress per course and includes courses with zero enrollments', () => {
    const rows = [
      { courseId: 'course-1', progressPercentage: 40 },
      { courseId: 'course-1', progressPercentage: 80 },
      { courseId: 'course-2', progressPercentage: 20 },
    ] as unknown as LearnerRow[];
    const bars = computeCourseProgressBars(rows, [
      { id: 'course-1', title: 'Course A' },
      { id: 'course-2', title: 'Course B' },
      { id: 'course-3', title: 'Course C (no students)' },
    ]);

    expect(bars).toEqual([
      { courseId: 'course-1', courseTitle: 'Course A', averageProgress: 60 },
      { courseId: 'course-2', courseTitle: 'Course B', averageProgress: 20 },
      { courseId: 'course-3', courseTitle: 'Course C (no students)', averageProgress: 0 },
    ]);
  });
});
