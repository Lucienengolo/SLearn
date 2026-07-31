import { useEffect, useRef, useState } from 'react';
import { Award, Search, Users, UserPlus, Megaphone, FileText, ClipboardList, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchInstructorLearners,
  computeCourseProgressBars,
  LearnerRow,
  STALE_THRESHOLD_DAYS,
} from '../../lib/instructorLearners';
import { Course } from '../../lib/supabase';
import { fetchClassworkPosts, deleteClassworkPost, ClassworkPostWithCourse } from '../../lib/classwork';
import { renderRichText } from '../../lib/richText';
import { ICON_BADGE_GRADIENTS } from '../../lib/iconBadgeTones';
import AddStudentModal from './AddStudentModal';
import ClassworkComposer from './ClassworkComposer';
import GradingPanel from './GradingPanel';
import InstructorLeague from './InstructorLeague';
import TutorMatches from '../Tutors/TutorMatches';
import Chat from '../Tutors/Chat';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type SLearnClassroomProps = {
  onBack: () => void;
};

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'not_started';
type Section = 'stream' | 'classwork' | 'people' | 'league' | 'tutor-matches';

const SECTION_LABEL_KEYS: Record<Section, TranslationKey> = {
  stream: 'dashboard.classroom.sectionStream',
  classwork: 'dashboard.classroom.sectionClasswork',
  people: 'dashboard.classroom.sectionPeople',
  league: 'dashboard.league.title',
  'tutor-matches': 'dashboard.classroom.sectionTutorMatches',
};

const TYPE_META_KEYS: Record<ClassworkPostWithCourse['type'], { labelKey: TranslationKey; Icon: typeof Megaphone; tint: string }> = {
  announcement: { labelKey: 'dashboard.classroom.postType.announcement', Icon: Megaphone, tint: 'bg-gray-100 text-gray-600' },
  material: { labelKey: 'dashboard.classroom.postType.material', Icon: FileText, tint: 'bg-primary-50 text-primary-700' },
  assignment: { labelKey: 'dashboard.classroom.postType.assignment', Icon: ClipboardList, tint: 'bg-green-50 text-green-700' },
};

const statusOf = (row: LearnerRow): StatusFilter =>
  row.completedAt ? 'completed' : row.progressPercentage > 0 ? 'in_progress' : 'not_started';

// "S@Learn Classroom" -- the instructor's entire class-management workspace
// (founder request, 2026-07-27, explicitly Google Classroom-inspired), not
// just a student list anymore: Stream (post announcements/materials/
// assignments), Classwork (assignments + grading), People (the original
// cross-course learner roster this page shipped with on 2026-07-24), League,
// and Tutor Matching all live here as one combined workspace across every
// course the instructor teaches -- matching the founder's choice of "one
// workspace, course-switcher inside" over a per-course Classroom clone.
export default function SLearnClassroom({ onBack }: SLearnClassroomProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [section, setSection] = useState<Section>('stream');
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [totalQuizAttempts, setTotalQuizAttempts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [addStudentOpen, setAddStudentOpen] = useState(false);

  // Founder screenshot (mobile, Stream tab): the section tabs overflow the
  // viewport ("Tutor Matches" clipped mid-word) with nothing telling the
  // user there's more to scroll to -- overflow-x-auto alone works, but looks
  // like a rendering bug rather than an intentional scroll area. Track
  // whether there's more content in either direction so a fade can only
  // show up when it's actually true (a fade that's always on would lie on
  // wide screens where every tab already fits).
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const updateOverflow = () => {
      setTabOverflow({
        left: el.scrollLeft > 0,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };
    updateOverflow();
    el.addEventListener('scroll', updateOverflow);
    window.addEventListener('resize', updateOverflow);
    return () => {
      el.removeEventListener('scroll', updateOverflow);
      window.removeEventListener('resize', updateOverflow);
    };
  }, []);

  const [posts, setPosts] = useState<ClassworkPostWithCourse[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<'all' | string>('all');
  const [gradingPost, setGradingPost] = useState<ClassworkPostWithCourse | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const data = await fetchInstructorLearners(user.id);
    setCourses(data.courses);
    setRows(data.rows);
    setTotalQuizAttempts(data.totalQuizAttempts);
    setLoading(false);
  };

  const loadPosts = async (courseIds: string[]) => {
    setPostsLoading(true);
    const result = await fetchClassworkPosts(courseIds);
    setPosts(result);
    setPostsLoading(false);
  };

  useEffect(() => {
    if ((section === 'stream' || section === 'classwork') && courses.length > 0) {
      loadPosts(courses.map((c) => c.id));
    }
  }, [section, courses]);

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteClassworkPost(postId);
      showToast(t('dashboard.classroom.removedToast'), 'success');
      loadPosts(courses.map((c) => c.id));
    } catch {
      showToast(t('dashboard.classroom.removeFailedToast'), 'error');
    }
  };

  const filteredRows = rows.filter((row) => {
    if (statusFilter !== 'all' && statusOf(row) !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !row.fullName.toLowerCase().includes(q) &&
        !row.email.toLowerCase().includes(q) &&
        !row.courseTitle.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const visiblePosts = posts
    .filter((p) => courseFilter === 'all' || p.course_id === courseFilter)
    .filter((p) => section === 'stream' || p.type !== 'announcement');

  const distinctLearnerCount = new Set(rows.map((r) => r.studentId)).size;
  const completedCount = rows.filter((r) => !!r.completedAt).length;
  const notStartedCount = rows.filter((r) => statusOf(r) === 'not_started').length;
  const staleCount = rows.filter((r) => r.isStale).length;
  const certifiedCount = rows.filter((r) => r.hasCertificate).length;

  const courseProgressBars = computeCourseProgressBars(rows, courses);
  const chartMax = Math.max(1, ...courseProgressBars.map((b) => b.averageProgress));

  const statTiles = [
    { value: distinctLearnerCount, label: t('dashboard.classroom.statLearners') },
    { value: completedCount, label: t('dashboard.classroom.statCompletions') },
    { value: totalQuizAttempts, label: t('dashboard.classroom.quizAttempts') },
    { value: certifiedCount, label: t('dashboard.classroom.certificatesEarnedLower') },
  ];

  const statusBadge = (row: LearnerRow) => {
    const status = statusOf(row);
    if (status === 'completed') {
      return <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">{t('dashboard.classroom.status.completed')}</span>;
    }
    if (status === 'in_progress') {
      return <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{t('dashboard.classroom.status.inProgress')}</span>;
    }
    return <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">{t('dashboard.classroom.status.notStarted')}</span>;
  };

  const courseOptions = courses.map((c) => ({ id: c.id, title: c.title }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition mb-4 sm:hidden">
        ← {t('dashboard.backToDashboard')}
      </button>

      <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-1">{t('dashboard.classroom.title')}</h1>
      <p className="text-gray-500 mb-6">{t('dashboard.classroom.subtitle')}</p>

      <div className="relative mb-6">
        <div ref={tabsRef} className="flex items-center gap-1 border-b border-canvas-150 overflow-x-auto">
          {(Object.keys(SECTION_LABEL_KEYS) as Section[]).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`text-md px-3 py-2.5 transition whitespace-nowrap ${
                section === s
                  ? 'font-semibold text-gray-900 border-b-2 border-gray-900 -mb-px'
                  : 'font-medium text-gray-500 hover:text-gray-900'
              }`}
            >
              {t(SECTION_LABEL_KEYS[s])}
            </button>
          ))}
        </div>
        {tabOverflow.left && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-100 to-transparent" aria-hidden="true" />
        )}
        {tabOverflow.right && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-100 to-transparent" aria-hidden="true" />
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{t('dashboard.common.noCoursesYet')}</h3>
          <p className="text-gray-500 text-sm">{t('dashboard.classroom.noCoursesBody')}</p>
        </div>
      ) : (
        <>
          {(section === 'stream' || section === 'classwork') && !gradingPost && (
            <div>
              {section === 'stream' && user && (
                <ClassworkComposer
                  instructorId={user.id}
                  courses={courseOptions}
                  defaultCourseId={courseFilter === 'all' ? null : courseFilter}
                  onPosted={() => loadPosts(courses.map((c) => c.id))}
                />
              )}

              {courses.length > 1 && (
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="h-10 px-3 mb-4 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="all">{t('dashboard.classroom.allCourses')}</option>
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              {postsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
                  <p className="text-gray-500 text-sm">
                    {section === 'stream' ? t('dashboard.classroom.nothingPostedYet') : t('dashboard.classroom.noClassworkPostedYet')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visiblePosts.map((post) => {
                    const meta = TYPE_META_KEYS[post.type];
                    return (
                      <div key={post.id} className="rounded-[14px] border border-canvas-150 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-full ${meta.tint}`}>
                              <meta.Icon size={12} />
                              {t(meta.labelKey)}
                            </span>
                            {courseFilter === 'all' && post.course && (
                              <span className="text-2xs text-gray-400">{post.course.title}</span>
                            )}
                            {post.due_at && (
                              <span className="text-2xs text-gray-500">{t('dashboard.classroom.duePrefix')} {new Date(post.due_at).toLocaleDateString()}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
                            title={t('dashboard.classroom.removeTitle')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className="font-semibold text-gray-900">{post.title}</p>
                        {post.body && <div className="text-sm text-gray-600 mt-1">{renderRichText(post.body)}</div>}
                        {post.attachment_url && (
                          <a
                            href={post.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary-700 hover:underline mt-2 inline-block"
                          >
                            {post.attachment_url}
                          </a>
                        )}
                        {section === 'classwork' && post.type === 'assignment' && (
                          <button
                            onClick={() => setGradingPost(post)}
                            className="mt-3 text-sm font-medium text-primary-700 hover:underline"
                          >
                            {t('dashboard.classroom.viewSubmissionsGrade')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'classwork' && gradingPost && <GradingPanel post={gradingPost} onBack={() => setGradingPost(null)} />}

          {section === 'league' && <InstructorLeague courses={courseOptions} />}

          {section === 'tutor-matches' && user && (
            <div>
              {selectedMatchId ? (
                <div>
                  <button
                    onClick={() => setSelectedMatchId(null)}
                    className="text-sm text-gray-500 hover:text-gray-800 transition mb-4"
                  >
                    ← {t('dashboard.classroom.backToMatches')}
                  </button>
                  <Chat matchId={selectedMatchId} currentUserId={user.id} viewerRole="tutor" />
                </div>
              ) : (
                <TutorMatches tutorId={user.id} onSelectMatch={setSelectedMatchId} />
              )}
            </div>
          )}

          {section === 'people' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-4 mb-6">
                <div className="space-y-4">
                  <div className="rounded-[10px] border border-canvas-150 bg-canvas-25 p-4 shadow-sm">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t('dashboard.classroom.information')}</p>
                    <p className="text-sm text-gray-700">
                      {courses.length} {t(courses.length === 1 ? 'dashboard.classroom.courseSingular' : 'dashboard.classroom.coursePlural')}
                    </p>
                    <p className="text-sm text-gray-700">
                      {distinctLearnerCount} {t(distinctLearnerCount === 1 ? 'dashboard.classroom.learnerSingular' : 'dashboard.classroom.learnerPlural')}
                    </p>
                    <p className="text-2xs text-gray-500 mt-1.5">
                      {rows.length} {t(rows.length === 1 ? 'dashboard.classroom.totalEnrollmentSingular' : 'dashboard.classroom.totalEnrollmentPlural')}
                    </p>
                  </div>

                  {notStartedCount > 0 || staleCount > 0 ? (
                    <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-amber-900 mb-2">{t('dashboard.classroom.attention')}</p>
                      <ul className="text-sm text-amber-800 space-y-0.5">
                        {notStartedCount > 0 && (
                          <li>
                            {notStartedCount} {t(notStartedCount === 1 ? 'dashboard.classroom.enrollmentSingular' : 'dashboard.classroom.enrollmentPlural')}{' '}
                            {t(notStartedCount === 1 ? 'dashboard.classroom.hasntStartedYet' : 'dashboard.classroom.haventStartedYet')}
                          </li>
                        )}
                        {staleCount > 0 && (
                          <li>
                            {staleCount} {t(staleCount === 1 ? 'dashboard.classroom.enrollmentSingular' : 'dashboard.classroom.enrollmentPlural')}{' '}
                            {t('dashboard.classroom.inactiveSince')} {STALE_THRESHOLD_DAYS}+ {t('dashboard.streak.days')}
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-[10px] border border-canvas-150 bg-canvas-25 p-4 shadow-sm">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{t('dashboard.classroom.attention')}</p>
                      <p className="text-sm text-gray-500">{t('dashboard.classroom.nothingNeedsAttention')}</p>
                    </div>
                  )}
                </div>

                <div>
                  <div className="relative mb-3">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('dashboard.classroom.searchPlaceholderLearner')}
                      className="w-full pl-10 pr-3.5 h-11 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {statTiles.map((tile) => (
                      <div
                        key={tile.label}
                        className="rounded-[10px] border border-canvas-150 p-3.5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <p className="font-display text-xl text-gray-900 leading-none">{tile.value}</p>
                        <p className="text-2xs text-gray-500 mt-1">{tile.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[10px] border border-canvas-150 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-2xs font-semibold text-gray-500 mb-3">{t('dashboard.classroom.classOverallProgress')}</p>
                  {/* Course count is unbounded -- flex-1 bars used to squeeze
                      to unreadable slivers (and overflow the viewport
                      entirely) once an instructor had more than a handful of
                      courses. Fixed-width bars in a horizontally scrollable
                      track fit any screen and any course count instead. */}
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-3 h-24 min-w-max px-0.5">
                      {courseProgressBars.map((bar) => (
                        <div key={bar.courseId} className="w-9 flex-shrink-0 flex flex-col items-center justify-end h-full">
                          <span className="text-2xs font-semibold text-gray-700 mb-1">{bar.averageProgress}%</span>
                          <div
                            className="w-full rounded-t-[4px] bg-primary-500 transition-[height] duration-300 ease-out"
                            style={{ height: `${Math.max(4, (bar.averageProgress / chartMax) * 100)}%` }}
                            role="img"
                            aria-label={`${bar.courseTitle}: ${bar.averageProgress}% average progress`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 mt-2 min-w-max px-0.5">
                      {courseProgressBars.map((bar) => (
                        <span key={bar.courseId} className="w-9 flex-shrink-0 text-2xs text-gray-500 text-center leading-tight truncate">
                          {bar.courseTitle}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-gray-900">{t('dashboard.classroom.learnersHeading')} ({rows.length})</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddStudentOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-primary-500 text-gray-900 h-9 px-3.5 rounded-full text-sm font-medium shadow-sm hover:shadow-md hover:bg-primary-400 transition-[box-shadow,background-color]"
                  >
                    <UserPlus size={15} />
                    {t('dashboard.classroom.addStudent')}
                  </button>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    title={t('dashboard.classroom.filterByStatusTitle')}
                    className="h-9 px-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="all">{t('dashboard.classroom.allLearners')}</option>
                    <option value="completed">{t('dashboard.classroom.status.completed')}</option>
                    <option value="in_progress">{t('dashboard.classroom.status.inProgress')}</option>
                    <option value="not_started">{t('dashboard.classroom.status.notStarted')}</option>
                  </select>
                </div>
              </div>

              <div className="rounded-[14px] border border-canvas-150 divide-y divide-canvas-150 shadow-sm">
                {filteredRows.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-10">{t('dashboard.classroom.noLearnersMatch')}</p>
                ) : (
                  filteredRows.map((row) => (
                    <div key={row.enrollmentId} className="flex items-center gap-3.5 p-4 hover:bg-gray-50 transition-colors">
                      {row.avatarUrl ? (
                        <img src={row.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm text-white shadow-sm"
                          style={{ background: ICON_BADGE_GRADIENTS.gold }}
                        >
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
                              {t('dashboard.myProgress.certifiedBadge')}
                            </span>
                          )}
                          {row.isStale && (
                            <span className="text-2xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-800">
                              {t('dashboard.classroom.needsAttention')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {row.email} · <span className="text-gray-400">{row.courseTitle}</span>
                        </p>
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
                        {t('dashboard.classroom.lastActive')} {new Date(row.lastActivityAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

      <AddStudentModal
        isOpen={addStudentOpen}
        courses={courseOptions}
        onClose={() => setAddStudentOpen(false)}
        onEnrolled={fetchData}
      />
    </div>
  );
}
