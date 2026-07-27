import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Award, Zap } from 'lucide-react';
import { supabase, Enrollment, Course, CourseStats, StudentCourseProgress, Certificate } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCourseCover } from '../../lib/courseCovers';
import { fetchStudentProgress, StudentProgress } from '../../lib/gamification';
import { totemByName } from '../../lib/totems';
import DashboardSidebar from './DashboardSidebar';

type MyProgressProps = {
  onBack: () => void;
  onNavigate: (page: string) => void;
  onCourseSelect: (courseId: string) => void;
};

type EnrollmentRow = Enrollment & {
  course: Course & { instructor: { full_name: string }; category?: { name: string } };
};

type ProgressRow = EnrollmentRow & {
  totalLessons: number;
  completedLessons: number;
  hasCertificate: boolean;
};

export default function MyProgress({ onBack, onNavigate, onCourseSelect }: MyProgressProps) {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`*, course:courses(*, instructor:profiles!instructor_id(full_name), category:categories(name))`)
        .eq('student_id', user.id)
        .order('enrolled_at', { ascending: false });

      const enrollments = (enrollmentsData ?? []) as EnrollmentRow[];
      const courseIds = enrollments.map((e) => e.course_id);

      const [{ data: statsRows }, { data: progressRows }, { data: certificateRows }] = await Promise.all([
        supabase.from('course_stats').select('course_id, lesson_count').in('course_id', courseIds),
        supabase.from('student_course_progress').select('*').eq('student_id', user.id).in('course_id', courseIds),
        supabase.from('certificates').select('course_id').eq('student_id', user.id).in('course_id', courseIds),
      ]);

      const lessonCountByCourseId = new Map(
        (statsRows ?? []).map((s: Pick<CourseStats, 'course_id' | 'lesson_count'>) => [s.course_id, s.lesson_count])
      );
      const completedByCourseId = new Map(
        (progressRows ?? []).map((p: StudentCourseProgress) => [p.course_id, p.completed_lesson_count])
      );
      const certifiedCourseIds = new Set((certificateRows ?? []).map((c: Pick<Certificate, 'course_id'>) => c.course_id));

      if (!cancelled) {
        setRows(
          enrollments.map((enrollment) => ({
            ...enrollment,
            totalLessons: lessonCountByCourseId.get(enrollment.course_id) ?? 0,
            completedLessons: completedByCourseId.get(enrollment.course_id) ?? 0,
            hasCertificate: certifiedCourseIds.has(enrollment.course_id),
          }))
        );
        setLoading(false);
      }
    })();

    fetchStudentProgress(user.id).then((result) => {
      if (!cancelled) setProgress(result);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totem = totemByName(profile?.totem);
  const completedCount = rows.filter((r) => r.completed_at).length;
  const certificateCount = rows.filter((r) => r.hasCertificate).length;
  const avgProgress = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.progress_percentage, 0) / rows.length) : 0;

  const statTiles = [
    { icon: BookOpen, value: rows.length, label: 'Courses enrolled', tint: 'bg-primary-50 text-primary-700' },
    { icon: CheckCircle, value: completedCount, label: 'Completed', tint: 'bg-green-50 text-green-600' },
    { icon: Zap, value: `${avgProgress}%`, label: 'Average progress', tint: 'bg-primary-50 text-primary-700' },
    { icon: Award, value: certificateCount, label: 'Certificates earned', tint: 'bg-gray-100 text-gray-600' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
      <DashboardSidebar
        current="my-progress"
        onNavigate={onNavigate}
        fullName={profile?.full_name}
        totem={totem}
        tier={progress?.tier ?? null}
      />
      <div>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-4 lg:hidden">
          ← Back to dashboard
        </button>

        <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">My Progress</h1>
        <p className="text-gray-500 mb-7">Your progress across every course you're enrolled in.</p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-[14px] border border-canvas-150 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform]"
            >
              <span className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-3 ${tile.tint}`}>
                <tile.icon size={20} />
              </span>
              <div className="font-display text-3xl text-gray-900 leading-none">{tile.value}</div>
              <div className="text-sm text-gray-500 mt-1">{tile.label}</div>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
            <BookOpen size={40} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-1">No courses yet</h3>
            <p className="text-gray-500 text-sm">Enroll in a course to start tracking your progress.</p>
          </div>
        ) : (
          <div className="rounded-[14px] border border-canvas-150 overflow-hidden shadow-sm">
            {rows.map((row, index) => {
              const cover = getCourseCover(row.course.category?.name);
              return (
                <button
                  key={row.id}
                  onClick={() => onCourseSelect(row.course_id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition ${
                    index !== rows.length - 1 ? 'border-b border-canvas-150' : ''
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: cover.gradient }}
                  >
                    {row.course.thumbnail_url ? (
                      <img src={row.course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <cover.icon size={20} className="text-white/85" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 truncate">{row.course.title}</p>
                      {row.hasCertificate && (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-primary-700 flex-shrink-0">
                          <Award size={12} />
                          Certified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {row.completedLessons} of {row.totalLessons} lessons · {row.course.instructor.full_name}
                    </p>
                  </div>
                  <div className="w-32 flex-shrink-0 flex items-center gap-2.5">
                    <div className="flex-1 h-[7px] rounded-full bg-canvas-150 overflow-hidden">
                      <div
                        className={`h-full transition-[width] duration-300 ease-out ${row.progress_percentage === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                        style={{ width: `${row.progress_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 flex-shrink-0">{row.progress_percentage}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
