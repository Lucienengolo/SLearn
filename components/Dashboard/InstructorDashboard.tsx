import { useState, useEffect } from 'react';
import { Plus, BookOpen, Users, Edit, Trash2, Search } from 'lucide-react';
import { supabase, Course, CourseStats } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import CourseEditor from './CourseEditor';
import CourseStudents from './CourseStudents';
import SLearnClassroom from './SLearnClassroom';
import ConfirmDialog from '../UI/ConfirmDialog';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type CourseWithStats = Course & { enrollmentCount: number; lessonCount: number };
// S@Learn Classroom absorbed Tutor Matches and League as internal sections
// (founder request, 2026-07-27) -- it's the whole class-management
// workspace now, not one tab among several. Only Courses (CRUD) stays
// separate at this top level.
type DashboardTab = 'courses' | 'classroom';

const TAB_LABEL_KEYS: Record<DashboardTab, TranslationKey> = {
  courses: 'nav.courses',
  classroom: 'dashboard.classroom.title',
};

type StatusFilter = 'all' | 'draft' | 'pending' | 'live' | 'rejected';

function courseStatus(course: Course): StatusFilter {
  if (!course.is_published) return 'draft';
  if (course.moderation_status === 'approved') return 'live';
  if (course.moderation_status === 'rejected') return 'rejected';
  return 'pending';
}

function TabNav({ tab, onSelect }: { tab: DashboardTab; onSelect: (t: DashboardTab) => void }) {
  const { t: translate } = useLocale();
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-canvas-150">
      {(Object.keys(TAB_LABEL_KEYS) as DashboardTab[]).map((tabKey) => (
        <button
          key={tabKey}
          onClick={() => onSelect(tabKey)}
          className={`text-md px-3 py-2.5 transition ${
            tab === tabKey
              ? 'font-semibold text-gray-900 border-b-2 border-gray-900 -mb-px'
              : 'font-medium text-gray-500 hover:text-gray-900'
          }`}
        >
          {translate(TAB_LABEL_KEYS[tabKey])}
        </button>
      ))}
    </div>
  );
}

export default function InstructorDashboard() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<DashboardTab>('courses');
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [studentsCourseId, setStudentsCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseIdPendingDelete, setCourseIdPendingDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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
      showToast(t('dashboard.instructor.toastDeleteFailed'), 'error');
    } else {
      showToast(t('dashboard.instructor.toastDeleted'), 'success');
      fetchCourses();
    }
  };

  const handleTogglePublish = async (courseId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('courses')
      .update({ is_published: !currentStatus })
      .eq('id', courseId);

    if (error) {
      showToast(t('dashboard.instructor.toastUpdateStatusFailed'), 'error');
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
    return (
      <CourseStudents
        courseId={studentsCourseId}
        onBack={() => setStudentsCourseId(null)}
        onEditCourse={() => {
          setSelectedCourse(studentsCourseId);
          setStudentsCourseId(null);
          setShowEditor(true);
        }}
      />
    );
  }

  if (tab === 'classroom') {
    return <SLearnClassroom onBack={() => setTab('courses')} />;
  }

  const visibleCourses = courses.filter((course) => {
    if (statusFilter !== 'all' && courseStatus(course) !== statusFilter) return false;
    if (search.trim() && !course.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <TabNav tab={tab} onSelect={setTab} />

      <div className="flex justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-gray-900">{t('dashboard.student.myCourses')}</h1>
          <p className="text-gray-500 mt-1">{t('dashboard.instructor.createManageSubtitle')}</p>
        </div>
        <button
          onClick={() => {
            setSelectedCourse(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 bg-primary-500 text-gray-900 h-11 px-5 rounded-[10px] hover:bg-primary-400 transition font-semibold whitespace-nowrap"
        >
          <Plus size={18} />
          <span>{t('dashboard.instructor.createCourse')}</span>
        </button>
      </div>

      {courses.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dashboard.instructor.searchYourCourses')}
              className="w-full pl-10 pr-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-11 px-3.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 sm:w-56"
          >
            <option value="all">{t('dashboard.instructor.allStatuses')}</option>
            <option value="draft">{t('dashboard.instructor.statusDraft')}</option>
            <option value="pending">{t('dashboard.instructor.statusPendingReview')}</option>
            <option value="live">{t('dashboard.instructor.statusLive')}</option>
            <option value="rejected">{t('dashboard.instructor.statusChangesRequested')}</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('dashboard.common.noCoursesYet')}</h3>
          <p className="text-gray-500 text-sm mb-6">{t('dashboard.instructor.noCoursesYetBody')}</p>
          <button
            onClick={() => setShowEditor(true)}
            className="bg-primary-500 text-gray-900 h-11 px-5 rounded-[10px] hover:bg-primary-400 transition font-semibold"
          >
            {t('dashboard.instructor.createFirstCourse')}
          </button>
        </div>
      ) : visibleCourses.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <Search size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('dashboard.instructor.noMatches')}</h3>
          <p className="text-gray-500 text-sm">{t('dashboard.instructor.tryDifferentSearch')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visibleCourses.map((course) => (
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
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">{t('dashboard.instructor.statusDraft')}</span>
                      ) : course.moderation_status === 'approved' ? (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">{t('dashboard.instructor.statusLive')}</span>
                      ) : course.moderation_status === 'rejected' ? (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-red-50 text-red-600">{t('dashboard.instructor.statusChangesRequested')}</span>
                      ) : (
                        <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{t('dashboard.instructor.statusPendingReview')}</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm line-clamp-2">{course.description}</p>
                    {course.moderation_status === 'rejected' && course.moderation_notes && (
                      <p className="text-sm text-red-600 mt-2">
                        <strong>{t('dashboard.instructor.reviewerNotes')}</strong> {course.moderation_notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="text-center p-3 bg-primary-50 rounded-[10px]">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1 shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#F2C94C,#C8881C)' }}
                    >
                      <Users size={14} className="text-white" fill="currentColor" fillOpacity={0.25} />
                    </span>
                    <p className="font-display text-xl text-primary-700">{course.enrollmentCount}</p>
                    <p className="text-2xs text-gray-500">{t('dashboard.instructor.studentsStatLabel')}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-[10px]">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1 shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#4ADE80,#15803D)' }}
                    >
                      <BookOpen size={14} className="text-white" fill="currentColor" fillOpacity={0.25} />
                    </span>
                    <p className="font-display text-xl text-green-700">{course.lessonCount}</p>
                    <p className="text-2xs text-gray-500">{t('dashboard.instructor.lessonsStatLabel')}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-[10px]">
                    <p className="font-display text-xl text-gray-900 mt-[22px]">
                      {course.price > 0 ? `$${course.price}` : t('common.free')}
                    </p>
                    <p className="text-2xs text-gray-500">{t('dashboard.instructor.priceStatLabel')}</p>
                  </div>
                </div>

                <button
                  onClick={() => setStudentsCourseId(course.id)}
                  className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 h-10 rounded-[10px] hover:bg-gray-50 transition font-medium mb-2"
                >
                  <Users size={15} />
                  <span>
                    {course.enrollmentCount}{' '}
                    {t(course.enrollmentCount === 1 ? 'dashboard.instructor.studentCountSingular' : 'dashboard.instructor.studentCountPlural')}
                  </span>
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
                    <span>{t('dashboard.instructor.edit')}</span>
                  </button>
                  <button
                    onClick={() => handleTogglePublish(course.id, course.is_published)}
                    className={`flex-1 h-10 rounded-[10px] transition font-medium ${
                      course.is_published
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {course.is_published ? t('dashboard.instructor.unpublish') : t('dashboard.instructor.submitForReview')}
                  </button>
                  <button
                    onClick={() => setCourseIdPendingDelete(course.id)}
                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 rounded-[10px] hover:bg-red-100 transition flex-shrink-0"
                    title={t('dashboard.instructor.deleteCourseTitle')}
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
        title={t('dashboard.instructor.deleteCourseConfirmTitle')}
        message={t('dashboard.instructor.deleteCourseConfirmMessage')}
        confirmLabel={t('dashboard.instructor.deleteCourseTitle')}
        destructive
        onConfirm={handleConfirmDeleteCourse}
        onCancel={() => setCourseIdPendingDelete(null)}
      />
    </div>
  );
}
