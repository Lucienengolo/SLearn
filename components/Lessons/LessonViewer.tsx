import { useState, useEffect } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, Download, FileText, ListTree, Lock, PlayCircle, Sparkles } from 'lucide-react';
import { supabase, Lesson, Course, LessonProgress, Quiz } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { completeGuestLesson, isGuestLessonComplete } from '../../lib/guestSession';
import { trackEvent } from '../../lib/analytics';
import { getCourseFinalExam, hasPassedQuiz, issueCertificateIfEligible } from '../../lib/certificates';
import QuizViewer from '../Quiz/QuizViewer';
import KairosMindTutor from './KairosMindTutor';

type LessonViewerProps = {
  lessonId: string;
  onBack: () => void;
};

export default function LessonViewer({ lessonId, onBack }: LessonViewerProps) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [courseProgressPercentage, setCourseProgressPercentage] = useState(0);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showKairosMind, setShowKairosMind] = useState(() => localStorage.getItem('kairos-mind-visible') !== 'false');
  const [showCurriculum, setShowCurriculum] = useState(() => localStorage.getItem('curriculum-visible') !== 'false');

  const toggleKairosMind = () => {
    setShowKairosMind((prev) => {
      const next = !prev;
      localStorage.setItem('kairos-mind-visible', String(next));
      return next;
    });
  };

  const toggleCurriculum = () => {
    setShowCurriculum((prev) => {
      const next = !prev;
      localStorage.setItem('curriculum-visible', String(next));
      return next;
    });
  };

  useEffect(() => {
    fetchLessonData();
    // user is a real dependency: on a fresh page load, this can fire
    // before auth resolves, taking the guest-mode branch and never
    // refetching once the real signed-in user loads (found by screenshot-
    // testing the deployed curriculum sidebar showing lessons as
    // incomplete/locked despite being done in the real account).
  }, [lessonId, user]);

  const fetchLessonData = async () => {
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (lessonData) {
      setLesson(lessonData);

      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', lessonData.course_id)
        .single();

      if (courseData) setCourse(courseData);

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', lessonData.course_id)
        .order('order_index');

      if (lessonsData) setAllLessons(lessonsData);

      const { data: quizData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (quizData) setQuiz(quizData);

      if (user) {
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('student_id', user.id)
          .eq('lesson_id', lessonId)
          .maybeSingle();

        if (progressData) {
          setProgress(progressData);
          setCompleted(progressData.completed);
        }

        if (lessonsData && lessonsData.length > 0) {
          const { data: allProgressData } = await supabase
            .from('lesson_progress')
            .select('lesson_id')
            .eq('student_id', user.id)
            .eq('completed', true)
            .in('lesson_id', lessonsData.map((l) => l.id));

          const doneIds = new Set((allProgressData ?? []).map((p) => p.lesson_id));
          setCompletedLessonIds(doneIds);
          setCourseProgressPercentage(Math.round((doneIds.size / lessonsData.length) * 100));
        }
      } else {
        setCompleted(isGuestLessonComplete(lessonId));
        if (lessonsData) {
          const doneIds = new Set(lessonsData.filter((l) => isGuestLessonComplete(l.id)).map((l) => l.id));
          setCompletedLessonIds(doneIds);
          setCourseProgressPercentage(Math.round((doneIds.size / lessonsData.length) * 100));
        }
      }
    }
  };

  const markAsComplete = async () => {
    if (!lesson) return;

    // Guest mode: no account, no server write — track completion + XP
    // in sessionStorage only (see lib/guestSession.ts).
    if (!user) {
      completeGuestLesson(lesson.id);
      setCompleted(true);
      markLessonDoneLocally(lesson.id);
      trackEvent('lesson_completed', { lessonId: lesson.id, courseId: lesson.course_id, guest: true });
      return;
    }

    if (progress) {
      const { error } = await supabase
        .from('lesson_progress')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', progress.id);

      if (!error) {
        setCompleted(true);
        markLessonDoneLocally(lesson.id);
        trackEvent('lesson_completed', { lessonId: lesson.id, courseId: lesson.course_id, guest: false });
        await updateCourseProgress();
      }
    } else {
      const { data, error } = await supabase
        .from('lesson_progress')
        .insert({
          student_id: user.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        setProgress(data);
        setCompleted(true);
        markLessonDoneLocally(lesson.id);
        trackEvent('lesson_completed', { lessonId: lesson.id, courseId: lesson.course_id, guest: false });
        await updateCourseProgress();
      }
    }
  };

  const markLessonDoneLocally = (id: string) => {
    setCompletedLessonIds((prev) => {
      const next = new Set(prev).add(id);
      if (allLessons.length > 0) {
        setCourseProgressPercentage(Math.round((next.size / allLessons.length) * 100));
      }
      return next;
    });
  };

  const updateCourseProgress = async () => {
    if (!user || !lesson || !course) return;

    const { data: allProgress } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('student_id', user.id)
      .in(
        'lesson_id',
        allLessons.map((l) => l.id)
      );

    const completedCount = allProgress?.filter((p) => p.completed).length || 0;
    const progressPercentage = Math.round((completedCount / allLessons.length) * 100);

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle();

    if (enrollment) {
      // A course final exam (if one exists) gates completed_at/the
      // certificate even once every lesson is done -- lessons-100% still
      // updates progress_percentage so the UI reflects real progress, but
      // completed_at only flips once the exam is passed too (see
      // CourseDetail's final-exam CTA, which is where that exam is taken).
      let allDone = progressPercentage === 100;
      if (allDone) {
        const finalExam = await getCourseFinalExam(course.id);
        if (finalExam) {
          allDone = await hasPassedQuiz(user.id, finalExam.id);
        }
      }

      await supabase
        .from('enrollments')
        .update({
          progress_percentage: progressPercentage,
          completed_at: allDone ? new Date().toISOString() : null,
        })
        .eq('id', enrollment.id);

      if (allDone) {
        await issueCertificateIfEligible(user.id, course);
      }
    }
  };

  const goToNextLesson = () => {
    if (!lesson) return;
    const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
    if (currentIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentIndex + 1];
      window.location.hash = `lesson-${nextLesson.id}`;
      fetchLessonData();
    }
  };

  const goToPreviousLesson = () => {
    if (!lesson) return;
    const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
    if (currentIndex > 0) {
      const prevLesson = allLessons[currentIndex - 1];
      window.location.hash = `lesson-${prevLesson.id}`;
      fetchLessonData();
    }
  };

  if (!lesson || !course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const currentIndex = allLessons.findIndex((l) => l.id === lesson.id);
  const hasNextLesson = currentIndex < allLessons.length - 1;

  if (showQuiz && quiz) {
    return (
      <QuizViewer
        quizId={quiz.id}
        onBack={() => setShowQuiz(false)}
        onComplete={() => {
          setShowQuiz(false);
          markAsComplete();
        }}
      />
    );
  }

  const hasPrevLesson = currentIndex > 0;

  const curriculumList = (
    <div className="space-y-1">
      {allLessons.map((l) => {
        const done = completedLessonIds.has(l.id);
        const isCurrent = l.id === lesson.id;
        return (
          <div
            key={l.id}
            onClick={() => {
              if (l.id !== lesson.id) {
                window.location.hash = `lesson-${l.id}`;
              }
            }}
            className={`flex items-center gap-3 p-2.5 rounded-[10px] cursor-pointer transition ${
              isCurrent ? 'bg-primary-50' : 'hover:bg-gray-50'
            }`}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-green-50 text-green-600' : isCurrent ? 'bg-primary-500 text-gray-900' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {done ? <CheckCircle size={14} /> : isCurrent ? <PlayCircle size={14} /> : <Lock size={14} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate ${isCurrent ? 'font-semibold text-primary-700' : 'text-gray-800'}`}>
                {l.title}
              </div>
              <div className="text-2xs text-gray-400">{l.duration_minutes} min</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const leftCol = showCurriculum ? '264px' : 'auto';
  const rightCol = showKairosMind ? '348px' : 'auto';

  return (
    <div className="lg:grid lg:items-start" style={{ gridTemplateColumns: `${leftCol} 1fr ${rightCol}` }}>
      {/* Curriculum sidebar (desktop, toggleable) */}
      {showCurriculum ? (
        <aside className="hidden lg:block border-r border-canvas-150 bg-white lg:h-[calc(100vh-66px)] lg:sticky lg:top-[66px] overflow-y-auto p-3">
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-gray-500">Course content</span>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold text-primary-700">{courseProgressPercentage}%</span>
              <button
                onClick={toggleCurriculum}
                aria-label="Hide course content"
                title="Hide course content"
                className="text-gray-400 hover:text-gray-700 transition"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
          <div className="px-2 pb-3">
            <div className="h-1.5 rounded-full bg-canvas-150 overflow-hidden">
              <div className="h-full bg-primary-500" style={{ width: `${courseProgressPercentage}%` }} />
            </div>
          </div>
          {curriculumList}
        </aside>
      ) : (
        <div className="hidden lg:flex lg:h-[calc(100vh-66px)] lg:sticky lg:top-[66px] border-r border-canvas-150 items-start justify-center pt-5 w-12">
          <button
            onClick={toggleCurriculum}
            aria-label="Show course content"
            title="Show course content"
            className="w-9 h-9 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 transition"
          >
            <ListTree size={16} />
          </button>
        </div>
      )}

      {/* Main */}
      <main className="lg:h-[calc(100vh-66px)] lg:overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-7">
          <div className="flex items-center justify-between mb-5">
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
              <ChevronLeft size={16} />
              Back to course
            </button>
            <button
              onClick={toggleKairosMind}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-700 border border-primary-200 rounded-[10px] h-9 px-3 hover:bg-primary-50 transition"
            >
              <Sparkles size={15} />
              {showKairosMind ? 'Hide Kairos Mind' : 'Show Kairos Mind'}
            </button>
          </div>

          {(lesson.video_file_url || lesson.video_url) && (
            <div className="rounded-[14px] overflow-hidden bg-black mb-5">
              {lesson.video_file_url ? (
                <video controls className="w-full h-auto" src={lesson.video_file_url} />
              ) : (
                <div className="aspect-video">
                  <iframe
                    src={lesson.video_url!}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-500 mb-1">{course.title}</div>
          <h1 className="font-display text-3xl text-gray-900 mb-1">{lesson.title}</h1>
          <p className="text-sm text-gray-500 mb-6">
            Lesson {currentIndex + 1} of {allLessons.length}
            {lesson.duration_minutes > 0 ? ` · ${lesson.duration_minutes} min` : ''}
          </p>

          {lesson.description && (
            <p className="text-gray-600 leading-relaxed mb-6">{lesson.description}</p>
          )}

          {lesson.content && (
            <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
              {lesson.content}
            </div>
          )}

          {lesson.pdf_notes_url && (
            <div className="flex items-center gap-3.5 border border-canvas-150 rounded-[10px] p-3.5 mb-8">
              <span className="w-10 h-10 rounded-[10px] bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-gray-600" />
              </span>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">Lesson notes (PDF)</div>
                <div className="text-2xs text-gray-500">Slides &amp; materials</div>
              </div>
              <a
                href={lesson.pdf_notes_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition rounded-[10px] h-9 px-3.5"
              >
                <Download size={15} />
                Download
              </a>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-6 border-t border-canvas-150">
            <button
              onClick={goToPreviousLesson}
              disabled={!hasPrevLesson}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-700 rounded-[10px] h-11 px-4 hover:bg-gray-50 transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            <div className="flex items-center gap-2.5">
              {completed ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-[10px] h-11 px-4 font-medium">
                  <CheckCircle size={18} />
                  Completed
                </div>
              ) : quiz ? (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="bg-white border border-primary-200 text-primary-700 rounded-[10px] h-11 px-4 hover:bg-primary-50 transition font-medium"
                >
                  Take completion quiz to finish
                </button>
              ) : (
                <button
                  onClick={markAsComplete}
                  className="flex items-center gap-1.5 bg-green-600 text-white rounded-[10px] h-11 px-4 hover:bg-green-700 transition font-medium"
                >
                  <CheckCircle size={18} />
                  Mark complete
                </button>
              )}
              {hasNextLesson && (
                <button
                  onClick={goToNextLesson}
                  className="flex items-center gap-1.5 bg-primary-500 text-gray-900 rounded-[10px] h-11 px-4 hover:bg-primary-400 transition font-medium"
                >
                  Next lesson
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: curriculum + Kairos Mind inline (the docked 3rd column
            is desktop-only -- see lg:grid breakpoint above) */}
        <div className="lg:hidden border-t border-canvas-150 mt-2 px-4 sm:px-6 py-6">
          <button
            onClick={toggleCurriculum}
            className="flex items-center justify-between w-full mb-2"
            aria-expanded={showCurriculum}
          >
            <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-gray-500">Course content</span>
            <ChevronRight size={16} className={`text-gray-400 transition-transform ${showCurriculum ? 'rotate-90' : 'rotate-0'}`} />
          </button>
          {showCurriculum && curriculumList}
        </div>
        {showKairosMind && (
          <div className="lg:hidden border-t border-canvas-150 h-[520px]">
            <KairosMindTutor lessonId={lesson.id} />
          </div>
        )}
      </main>

      {/* Kairos Mind (desktop, docked, toggleable) */}
      {showKairosMind ? (
        <aside className="hidden lg:flex lg:flex-col border-l border-canvas-150 bg-white lg:h-[calc(100vh-66px)] lg:sticky lg:top-[66px] lg:w-[348px]">
          <KairosMindTutor lessonId={lesson.id} />
        </aside>
      ) : (
        <div className="hidden lg:flex lg:h-[calc(100vh-66px)] lg:sticky lg:top-[66px] border-l border-canvas-150 items-start justify-center pt-5 w-12">
          <button
            onClick={toggleKairosMind}
            aria-label="Show Kairos Mind"
            title="Show Kairos Mind"
            className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center hover:bg-primary-100 transition"
          >
            <Sparkles size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
