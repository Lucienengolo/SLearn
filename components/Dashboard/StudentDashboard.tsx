import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Clock, Zap, GraduationCap, Award } from 'lucide-react';
import { supabase, Enrollment, Course, Certificate, CourseStats, StudentCourseProgress } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCourseCover } from '../../lib/courseCovers';

type StudentDashboardProps = {
  onCourseSelect: (courseId: string) => void;
  onCertificateView: () => void;
  onBecomeInstructor: () => void;
};

type EnrollmentRow = Enrollment & {
  course: Course & { instructor: { full_name: string }; category?: { name: string } };
};

type EnrollmentWithCourse = EnrollmentRow & {
  totalLessons: number;
  completedLessons: number;
};

type CertificateWithCourse = Certificate & { course: { title: string } };

type Filter = 'in_progress' | 'completed' | 'all';

export default function StudentDashboard({ onCourseSelect, onCertificateView, onBecomeInstructor }: StudentDashboardProps) {
  const { user, profile } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [certificates, setCertificates] = useState<CertificateWithCourse[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    totalHours: 0,
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    const { data: enrollmentsData } = await supabase
      .from('enrollments')
      .select(`
        *,
        course:courses(
          *,
          instructor:profiles!instructor_id(full_name),
          category:categories(name)
        )
      `)
      .eq('student_id', user.id)
      .order('enrolled_at', { ascending: false });

    if (enrollmentsData) {
      // Two follow-up queries total (not 3 per enrollment -- see
      // course_stats/student_course_progress in 0020/0021_*.sql).
      const courseIds = (enrollmentsData as EnrollmentRow[]).map((e) => e.course_id);
      const [{ data: statsRows }, { data: progressRows }] = await Promise.all([
        supabase.from('course_stats').select('course_id, lesson_count').in('course_id', courseIds),
        supabase
          .from('student_course_progress')
          .select('*')
          .eq('student_id', user.id)
          .in('course_id', courseIds),
      ]);

      const lessonCountByCourseId = new Map(
        (statsRows ?? []).map((s: Pick<CourseStats, 'course_id' | 'lesson_count'>) => [s.course_id, s.lesson_count])
      );
      const completedByCourseId = new Map(
        (progressRows ?? []).map((p: StudentCourseProgress) => [p.course_id, p.completed_lesson_count])
      );

      const enrichedEnrollments = (enrollmentsData as EnrollmentRow[]).map((enrollment) => ({
        ...enrollment,
        totalLessons: lessonCountByCourseId.get(enrollment.course_id) ?? 0,
        completedLessons: completedByCourseId.get(enrollment.course_id) ?? 0,
      }));

      setEnrollments(enrichedEnrollments);

      const completed = enrichedEnrollments.filter((e) => e.completed_at).length;
      const inProgress = enrichedEnrollments.filter((e) => !e.completed_at).length;
      const totalHours = enrichedEnrollments.reduce((sum, e) => sum + (e.course?.duration_hours || 0), 0);

      setStats({
        totalCourses: enrichedEnrollments.length,
        completedCourses: completed,
        inProgressCourses: inProgress,
        totalHours,
      });
    }

    const { data: certificatesData } = await supabase
      .from('certificates')
      .select(`
        *,
        course:courses(title)
      `)
      .eq('student_id', user.id)
      .order('issued_at', { ascending: false });

    if (certificatesData) setCertificates(certificatesData);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const resumeCourse = enrollments.find((e) => !e.completed_at && e.totalLessons > 0);
  const visibleEnrollments = enrollments.filter((e) => {
    if (filter === 'in_progress') return !e.completed_at;
    if (filter === 'completed') return !!e.completed_at;
    return true;
  });

  const statTiles = [
    { icon: BookOpen, value: stats.totalCourses, label: 'Courses enrolled', tint: 'bg-primary-50 text-primary-700' },
    { icon: CheckCircle, value: stats.completedCourses, label: 'Completed', tint: 'bg-green-50 text-green-600' },
    { icon: Clock, value: `${stats.totalHours}h`, label: 'Hours of content', tint: 'bg-gray-100 text-gray-600' },
    { icon: Zap, value: stats.inProgressCourses, label: 'In progress', tint: 'bg-primary-50 text-primary-700' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      {/* Greeting + resume */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mb-7 items-stretch">
        <div>
          <div className="flex items-center justify-between gap-4 mb-1">
            <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-gray-500">Welcome back</span>
            <button
              onClick={onBecomeInstructor}
              className="flex items-center gap-2 bg-white border border-primary-200 text-primary-700 px-4 py-2 rounded-[10px] hover:bg-primary-50 transition font-medium text-sm whitespace-nowrap"
            >
              <GraduationCap size={16} />
              Apply to teach
            </button>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mt-1 mb-2">
            Good to see you{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-600">
            {resumeCourse
              ? 'Pick up where you left off and keep the momentum going.'
              : 'Browse the catalog to start your first course.'}
          </p>
        </div>

        {resumeCourse && (
          <div
            className="rounded-[14px] overflow-hidden text-white p-5 flex flex-col justify-between cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#3C413A,#181B16)' }}
            onClick={() => onCourseSelect(resumeCourse.course_id)}
          >
            <div>
              <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-white/55">Continue learning</span>
              <p className="font-semibold mt-1.5 mb-1 line-clamp-1">{resumeCourse.course.title}</p>
              <p className="text-sm text-white/65">
                {resumeCourse.completedLessons} of {resumeCourse.totalLessons} lessons done
              </p>
            </div>
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
                <div className="h-full bg-primary-400" style={{ width: `${resumeCourse.progress_percentage}%` }} />
              </div>
              <button className="w-full bg-primary-500 text-gray-900 hover:bg-primary-400 transition font-semibold h-10 rounded-[10px]">
                Resume — {resumeCourse.progress_percentage}%
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statTiles.map((tile) => (
          <div key={tile.label} className="rounded-[14px] border border-canvas-150 p-5">
            <span className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-3 ${tile.tint}`}>
              <tile.icon size={20} />
            </span>
            <div className="font-display text-3xl text-gray-900 leading-none">{tile.value}</div>
            <div className="text-sm text-gray-500 mt-1">{tile.label}</div>
          </div>
        ))}
      </div>

      {/* Certificates -- gold, the design system's reward color */}
      {certificates.length > 0 && (
        <div className="rounded-[14px] border border-primary-200 bg-primary-50 p-5 flex items-center gap-4 mb-8">
          <span
            className="w-12 h-12 rounded-[10px] flex-shrink-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#E2A52A,#A66E13)' }}
          >
            <Award size={22} className="text-white" />
          </span>
          <div className="flex-1">
            <p className="font-bold text-primary-700">{certificates.length} certificate{certificates.length > 1 ? 's' : ''} earned</p>
            <p className="text-sm text-gray-600">Share them on your profile or download the PDFs</p>
          </div>
          <button
            onClick={onCertificateView}
            className="bg-white border border-primary-200 text-primary-700 px-4 py-2 rounded-[10px] hover:bg-primary-50 transition font-medium text-sm whitespace-nowrap"
          >
            View certificates
          </button>
        </div>
      )}

      {/* My courses */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl text-gray-900">My courses</h2>
        <div className="flex gap-1">
          {(['in_progress', 'completed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-[10px] transition ${
                filter === f ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {f === 'in_progress' ? 'In progress' : f === 'completed' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {visibleEnrollments.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">
            {enrollments.length === 0 ? 'No courses yet' : 'Nothing here yet'}
          </h3>
          <p className="text-gray-500 text-sm">
            {enrollments.length === 0 ? 'Start learning by enrolling in a course' : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleEnrollments.map((enrollment) => {
            const cover = getCourseCover(enrollment.course.category?.name);
            const CoverIcon = cover.icon;
            return (
              <div
                key={enrollment.id}
                className="rounded-[14px] border border-canvas-150 p-4 flex gap-4 cursor-pointer hover:border-gray-300 transition"
                onClick={() => onCourseSelect(enrollment.course_id)}
              >
                <div
                  className="w-[76px] h-[76px] rounded-[10px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ background: cover.gradient }}
                >
                  {enrollment.course.thumbnail_url ? (
                    <img
                      src={enrollment.course.thumbnail_url}
                      alt={enrollment.course.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CoverIcon size={30} className="text-white/85" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {enrollment.course.category && (
                      <span className="text-2xs text-gray-500">{enrollment.course.category.name}</span>
                    )}
                    {enrollment.completed_at && (
                      <span className="inline-flex items-center gap-1 text-2xs font-semibold text-green-700">
                        <CheckCircle size={12} />
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{enrollment.course.title}</p>
                  <p className="text-sm text-gray-500 mb-3 truncate">{enrollment.course.instructor.full_name}</p>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-[7px] rounded-full bg-canvas-150 overflow-hidden">
                      <div
                        className={`h-full ${enrollment.progress_percentage === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                        style={{ width: `${enrollment.progress_percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 flex-shrink-0">{enrollment.progress_percentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
