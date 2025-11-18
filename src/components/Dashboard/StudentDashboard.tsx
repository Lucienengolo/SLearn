import { useState, useEffect } from 'react';
import { BookOpen, Award, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type StudentDashboardProps = {
  onCourseSelect: (courseId: string) => void;
  onCertificateView: () => void;
};

export default function StudentDashboard({ onCourseSelect, onCertificateView }: StudentDashboardProps) {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    totalHours: 0,
  });
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
      const enrichedEnrollments = await Promise.all(
        enrollmentsData.map(async (enrollment: any) => {
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', enrollment.course_id);

          const { count: completedLessons } = await supabase
            .from('lesson_progress')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', user.id)
            .eq('completed', true)
            .in(
              'lesson_id',
              (await supabase
                .from('lessons')
                .select('id')
                .eq('course_id', enrollment.course_id)).data?.map((l: any) => l.id) || []
            );

          return {
            ...enrollment,
            totalLessons: totalLessons || 0,
            completedLessons: completedLessons || 0,
          };
        })
      );

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Learning Dashboard</h1>
        <p className="text-gray-600 mt-1">Track your progress and continue learning</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="text-primary-600" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.totalCourses}</span>
          </div>
          <p className="text-gray-600 text-sm">Total Courses</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Award className="text-green-600" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.completedCourses}</span>
          </div>
          <p className="text-gray-600 text-sm">Completed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-orange-600" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.inProgressCourses}</span>
          </div>
          <p className="text-gray-600 text-sm">In Progress</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-purple-600" size={24} />
            <span className="text-3xl font-bold text-gray-800">{stats.totalHours}h</span>
          </div>
          <p className="text-gray-600 text-sm">Total Hours</p>
        </div>
      </div>

      {certificates.length > 0 && (
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">Certificates Earned</h3>
              <p className="text-blue-100">You have {certificates.length} certificate(s)</p>
            </div>
            <button
              onClick={onCertificateView}
              className="bg-white text-primary-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition font-medium"
            >
              View All
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">My Courses</h2>

        {enrollments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No courses yet</h3>
            <p className="text-gray-600">Start learning by enrolling in a course</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => onCourseSelect(enrollment.course_id)}
              >
                <div className="h-40 bg-gradient-to-br from-primary-400 to-primary-600 rounded-t-lg flex items-center justify-center">
                  {enrollment.course.thumbnail_url ? (
                    <img
                      src={enrollment.course.thumbnail_url}
                      alt={enrollment.course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl text-white opacity-50">📚</span>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    {enrollment.course.category && (
                      <span className="text-xs bg-blue-100 text-primary-600 px-2 py-1 rounded">
                        {enrollment.course.category.name}
                      </span>
                    )}
                    {enrollment.completed_at && (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded flex items-center gap-1">
                        <Award size={12} />
                        Completed
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">
                    {enrollment.course.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    by {enrollment.course.instructor.full_name}
                  </p>

                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{enrollment.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          enrollment.progress_percentage === 100
                            ? 'bg-green-600'
                            : 'bg-primary-600'
                        }`}
                        style={{ width: `${enrollment.progress_percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    {enrollment.completedLessons} of {enrollment.totalLessons} lessons completed
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
