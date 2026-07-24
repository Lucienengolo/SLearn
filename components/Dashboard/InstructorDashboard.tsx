import { useState, useEffect } from 'react';
import { Plus, BookOpen, Users, Edit, Trash2 } from 'lucide-react';
import { supabase, Course, CourseStats } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import CourseEditor from './CourseEditor';
import CourseStudents from './CourseStudents';
import TutorMatches from '../Tutors/TutorMatches';
import Chat from '../Tutors/Chat';
import ConfirmDialog from '../UI/ConfirmDialog';

type CourseWithStats = Course & { enrollmentCount: number; lessonCount: number };
type DashboardTab = 'courses' | 'tutor-matches';

export default function InstructorDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<DashboardTab>('courses');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [studentsCourseId, setStudentsCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseIdPendingDelete, setCourseIdPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, [user]);

  const fetchCourses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        category:categories(name)
      `)
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching courses:', error);
    } else if (data) {
      // One follow-up query for all of the instructor's courses' stats
      // instead of 2 per course (see course_stats in 0020/0021_*.sql).
      const { data: statsRows } = await supabase
        .from('course_stats')
        .select('*')
        .in('course_id', data.map((c: Course) => c.id));

      const statsByCourseId = new Map((statsRows ?? []).map((s: CourseStats) => [s.course_id, s]));

      setCourses(
        data.map((course: Course) => {
          const stats = statsByCourseId.get(course.id);
          return {
            ...course,
            enrollmentCount: stats?.enrollment_count ?? 0,
            lessonCount: stats?.lesson_count ?? 0,
          };
        })
      );
    }
    setLoading(false);
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseIdPendingDelete) return;
    const courseId = courseIdPendingDelete;
    setCourseIdPendingDelete(null);

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      showToast('Failed to delete course', 'error');
    } else {
      showToast('Course deleted', 'success');
      fetchCourses();
    }
  };

  const handleTogglePublish = async (courseId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('courses')
      .update({ is_published: !currentStatus })
      .eq('id', courseId);

    if (error) {
      showToast('Failed to update course status', 'error');
    } else {
      fetchCourses();
    }
  };

  if (showEditor) {
    return (
      <CourseEditor
        courseId={selectedCourse}
        onBack={() => {
          setShowEditor(false);
          setSelectedCourse(null);
          fetchCourses();
        }}
      />
    );
  }

  if (studentsCourseId) {
    return <CourseStudents courseId={studentsCourseId} onBack={() => setStudentsCourseId(null)} />;
  }

  if (tab === 'tutor-matches' && user) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex items-center gap-1 mb-8 border-b border-canvas-150">
          <button
            onClick={() => setTab('courses')}
            className="text-md px-3 py-2.5 font-medium text-gray-500 hover:text-gray-900 transition"
          >
            Courses
          </button>
          <button
            onClick={() => setTab('tutor-matches')}
            className="text-md px-3 py-2.5 font-semibold text-gray-900 border-b-2 border-gray-900 -mb-px"
          >
            Tutor Matches
          </button>
        </div>

        {selectedMatchId ? (
          <div>
            <button
              onClick={() => setSelectedMatchId(null)}
              className="text-sm text-gray-500 hover:text-gray-800 transition mb-4"
            >
              ← Back to matches
            </button>
            <Chat matchId={selectedMatchId} currentUserId={user.id} viewerRole="tutor" />
          </div>
        ) : (
          <TutorMatches tutorId={user.id} onSelectMatch={setSelectedMatchId} />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="flex items-center gap-1 mb-6 border-b border-canvas-150">
        <button
          onClick={() => setTab('courses')}
          className="text-md px-3 py-2.5 font-semibold text-gray-900 border-b-2 border-gray-900 -mb-px"
        >
          Courses
        </button>
        <button
          onClick={() => setTab('tutor-matches')}
          className="text-md px-3 py-2.5 font-medium text-gray-500 hover:text-gray-900 transition"
        >
          Tutor Matches
        </button>
      </div>

      <div className="flex justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-gray-900">My courses</h1>
          <p className="text-gray-500 mt-1">Create and manage your courses</p>
        </div>
        <button
          onClick={() => {
            setSelectedCourse(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 bg-primary-500 text-gray-900 h-11 px-5 rounded-[10px] hover:bg-primary-400 transition font-semibold whitespace-nowrap"
        >
          <Plus size={18} />
          <span>Create course</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">No courses yet</h3>
          <p className="text-gray-500 text-sm mb-6">Create your first course to get started</p>
          <button
            onClick={() => setShowEditor(true)}
            className="bg-primary-500 text-gray-900 h-11 px-5 rounded-[10px] hover:bg-primary-400 transition font-semibold"
          >
            Create your first course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-[14px] border border-canvas-150 shadow-sm hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 transition-[box-shadow,transform,border-color]"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                      {!course.is_published ? (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Draft</span>
                      ) : course.moderation_status === 'approved' ? (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">Live</span>
                      ) : course.moderation_status === 'rejected' ? (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-red-50 text-red-600">Changes requested</span>
                      ) : (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">Pending review</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm line-clamp-2">{course.description}</p>
                    {course.moderation_status === 'rejected' && course.moderation_notes && (
                      <p className="text-sm text-red-600 mt-2">
                        <strong>Reviewer notes:</strong> {course.moderation_notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="text-center p-3 bg-primary-50 rounded-[10px]">
                    <Users size={16} className="text-primary-700 mx-auto mb-1" />
                    <p className="font-display text-xl text-primary-700">{course.enrollmentCount}</p>
                    <p className="text-2xs text-gray-500">Students</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-[10px]">
                    <BookOpen size={16} className="text-green-600 mx-auto mb-1" />
                    <p className="font-display text-xl text-green-700">{course.lessonCount}</p>
                    <p className="text-2xs text-gray-500">Lessons</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-[10px]">
                    <p className="font-display text-xl text-gray-900 mt-[22px]">
                      {course.price > 0 ? `$${course.price}` : 'Free'}
                    </p>
                    <p className="text-2xs text-gray-500">Price</p>
                  </div>
                </div>

                <button
                  onClick={() => setStudentsCourseId(course.id)}
                  className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 h-10 rounded-[10px] hover:bg-gray-50 transition font-medium mb-2"
                >
                  <Users size={15} />
                  <span>{course.enrollmentCount} student{course.enrollmentCount === 1 ? '' : 's'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedCourse(course.id);
                      setShowEditor(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary-500 text-gray-900 h-10 rounded-[10px] hover:bg-primary-400 transition font-medium"
                  >
                    <Edit size={15} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleTogglePublish(course.id, course.is_published)}
                    className={`flex-1 h-10 rounded-[10px] transition font-medium ${
                      course.is_published
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {course.is_published ? 'Unpublish' : 'Submit for review'}
                  </button>
                  <button
                    onClick={() => setCourseIdPendingDelete(course.id)}
                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-[10px] hover:bg-red-100 transition flex-shrink-0"
                    title="Delete course"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!courseIdPendingDelete}
        title="Delete this course?"
        message="This action cannot be undone. Students already enrolled will lose access."
        confirmLabel="Delete course"
        destructive
        onConfirm={handleConfirmDeleteCourse}
        onCancel={() => setCourseIdPendingDelete(null)}
      />
    </div>
  );
}
