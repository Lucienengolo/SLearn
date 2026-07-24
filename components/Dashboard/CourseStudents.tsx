import { useEffect, useState } from 'react';
import { ArrowLeft, Award, Search, Users } from 'lucide-react';
import { supabase, Course } from '../../lib/supabase';

type CourseStudentsProps = {
  courseId: string;
  onBack: () => void;
};

type StudentRow = {
  enrollmentId: string;
  studentId: string;
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

const STALE_THRESHOLD_DAYS = 14;

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'not_started';

const statusOf = (row: StudentRow): StatusFilter =>
  row.completedAt ? 'completed' : row.progressPercentage > 0 ? 'in_progress' : 'not_started';

export default function CourseStudents({ courseId, onBack }: CourseStudentsProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    fetchData();
  }, [courseId]);

  const fetchData = async () => {
    setLoading(true);

    const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle();
    setCourse(courseData);

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select(`
        id, student_id, enrolled_at, completed_at, progress_percentage,
        student:profiles!student_id(full_name, email, avatar_url)
      `)
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false });

    const { data: certificates } = await supabase
      .from('certificates')
      .select('student_id')
      .eq('course_id', courseId);

    const certifiedIds = new Set((certificates ?? []).map((c) => c.student_id));

    // Last activity per student, for the "attention" panel (Slearn classroom
    // adaptation, 2026-07-23 -- DESIGN.md Patterns) -- derived from real
    // lesson_progress rows, not a stored "last seen" field.
    const { data: lessonRows } = await supabase.from('lessons').select('id').eq('course_id', courseId);
    const lessonIds = (lessonRows ?? []).map((l: { id: string }) => l.id);
    const { data: progressRows } = lessonIds.length
      ? await supabase.from('lesson_progress').select('student_id, updated_at').in('lesson_id', lessonIds)
      : { data: [] as { student_id: string; updated_at: string }[] };

    const lastActivityByStudent = new Map<string, string>();
    for (const p of (progressRows ?? []) as { student_id: string; updated_at: string }[]) {
      const current = lastActivityByStudent.get(p.student_id);
      if (!current || new Date(p.updated_at) > new Date(current)) {
        lastActivityByStudent.set(p.student_id, p.updated_at);
      }
    }

    const staleCutoff = Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    type EnrollmentWithStudent = {
      id: string;
      student_id: string;
      enrolled_at: string;
      completed_at: string | null;
      progress_percentage: number;
      student: { full_name: string | null; email: string; avatar_url: string | null } | null;
    };

    setRows(
      ((enrollments ?? []) as unknown as EnrollmentWithStudent[]).map((e) => {
        const lastActivityAt = lastActivityByStudent.get(e.student_id) ?? e.enrolled_at;
        return {
          enrollmentId: e.id,
          studentId: e.student_id,
          fullName: e.student?.full_name || e.student?.email || 'Unknown student',
          email: e.student?.email || '',
          avatarUrl: e.student?.avatar_url ?? null,
          enrolledAt: e.enrolled_at,
          completedAt: e.completed_at,
          progressPercentage: e.progress_percentage,
          hasCertificate: certifiedIds.has(e.student_id),
          lastActivityAt,
          isStale: !e.completed_at && new Date(lastActivityAt).getTime() < staleCutoff,
        };
      })
    );

    setLoading(false);
  };

  const filteredRows = rows.filter((row) => {
    if (statusFilter !== 'all' && statusOf(row) !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!row.fullName.toLowerCase().includes(q) && !row.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const completedCount = rows.filter((r) => !!r.completedAt).length;
  const notStartedCount = rows.filter((r) => statusOf(r) === 'not_started').length;
  const inProgressCount = rows.filter((r) => statusOf(r) === 'in_progress').length;
  const staleCount = rows.filter((r) => r.isStale).length;
  const averageProgress = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.progressPercentage, 0) / rows.length)
    : 0;

  // Slearn classroom adaptation (2026-07-23): same 3 status buckets already
  // used by statusBadge below, as a bar chart -- one axis (student count),
  // fixed category order, each bar directly labeled so identity never rests
  // on color alone (dataviz skill non-negotiable).
  const progressChartBuckets = [
    { label: 'Not started', count: notStartedCount, barClass: 'bg-gray-300' },
    { label: 'In progress', count: inProgressCount, barClass: 'bg-primary-500' },
    { label: 'Completed', count: completedCount, barClass: 'bg-green-500' },
  ];
  const progressChartMax = Math.max(1, ...progressChartBuckets.map((b) => b.count));

  const statusBadge = (row: StudentRow) => {
    const status = statusOf(row);
    if (status === 'completed') {
      return <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">Completed</span>;
    }
    if (status === 'in_progress') {
      return <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">In progress</span>;
    }
    return <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not started</span>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6"
      >
        <ArrowLeft size={16} />
        <span>Back to dashboard</span>
      </button>

      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">{course?.title || 'Loading course…'}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">No students yet</h3>
          <p className="text-gray-500 text-sm">Once students enroll in this course, they'll show up here.</p>
        </div>
      ) : (
        <>
          {(notStartedCount > 0 || staleCount > 0) && (
            <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 mb-6">
              <p className="font-semibold text-amber-900 mb-1.5">Attention</p>
              <ul className="text-sm text-amber-800 space-y-0.5">
                {notStartedCount > 0 && (
                  <li>
                    {notStartedCount} student{notStartedCount === 1 ? '' : 's'}{' '}
                    {notStartedCount === 1 ? "hasn't" : "haven't"} started yet
                  </li>
                )}
                {staleCount > 0 && (
                  <li>
                    {staleCount} student{staleCount === 1 ? '' : 's'} inactive for {STALE_THRESHOLD_DAYS}+ days
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 mb-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[10px] border border-canvas-150 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-display text-2xl text-gray-900">{rows.length}</p>
                <p className="text-2xs text-gray-500">Enrolled</p>
              </div>
              <div className="rounded-[10px] border border-canvas-150 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-display text-2xl text-green-700">{completedCount}</p>
                <p className="text-2xs text-gray-500">Completed</p>
              </div>
              <div className="rounded-[10px] border border-canvas-150 p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-display text-2xl text-primary-700">{averageProgress}%</p>
                <p className="text-2xs text-gray-500">Average progress</p>
              </div>
            </div>

            <div className="rounded-[10px] border border-canvas-150 p-4 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-2xs font-semibold text-gray-500 mb-3">Class overall progress</p>
              <div className="flex items-end justify-between gap-3 h-20">
                {progressChartBuckets.map((bucket) => (
                  <div key={bucket.label} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-2xs font-semibold text-gray-700 mb-1">{bucket.count}</span>
                    <div
                      className={`w-full rounded-t-[4px] transition-[height] duration-300 ease-out ${bucket.barClass}`}
                      style={{ height: `${Math.max(4, (bucket.count / progressChartMax) * 100)}%` }}
                      role="img"
                      aria-label={`${bucket.label}: ${bucket.count} student${bucket.count === 1 ? '' : 's'}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2 mt-2">
                {progressChartBuckets.map((bucket) => (
                  <span key={bucket.label} className="text-2xs text-gray-500 flex-1 text-center leading-tight">
                    {bucket.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-10 pr-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              title="Filter by status"
              className="h-11 px-3.5 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="all">All students</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In progress</option>
              <option value="not_started">Not started</option>
            </select>
          </div>

          <div className="rounded-[14px] border border-canvas-150 divide-y divide-canvas-150 shadow-sm">
            {filteredRows.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10">No students match your search.</p>
            ) : (
              filteredRows.map((row) => (
                <div key={row.enrollmentId} className="flex items-center gap-3.5 p-4 hover:bg-gray-50 transition-colors">
                  {row.avatarUrl ? (
                    <img src={row.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                      {row.fullName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">{row.fullName}</p>
                      {statusBadge(row)}
                      {row.hasCertificate && (
                        <span className="flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-full bg-gold-50 text-gold-700">
                          <Award size={12} />
                          Certified
                        </span>
                      )}
                      {row.isStale && (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-800">
                          Needs attention
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{row.email}</p>
                  </div>
                  <div className="w-28 flex-shrink-0 hidden sm:block">
                    <div className="h-1.5 rounded-full bg-canvas-150 overflow-hidden mb-1">
                      <div
                        className="h-full bg-primary-500 transition-[width] duration-300 ease-out"
                        style={{ width: `${row.progressPercentage}%` }}
                      />
                    </div>
                    <p className="text-2xs text-gray-500 text-right">{row.progressPercentage}%</p>
                  </div>
                  <p className="text-2xs text-gray-400 flex-shrink-0 hidden md:block w-28 text-right">
                    Last active {new Date(row.lastActivityAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
