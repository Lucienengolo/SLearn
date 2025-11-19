import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, ChevronRight, Download, FileText, Video as VideoIcon } from 'lucide-react';
import { supabase, Lesson } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import QuizViewer from '../Quiz/QuizViewer';

type LessonViewerProps = {
  lessonId: string;
  onBack: () => void;
};

export default function LessonViewer({ lessonId, onBack }: LessonViewerProps) {
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<any>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    fetchLessonData();
  }, [lessonId]);

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
      }
    }
  };

  const markAsComplete = async () => {
    if (!user || !lesson) return;

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
        await updateCourseProgress();
      }
    }
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
      await supabase
        .from('enrollments')
        .update({
          progress_percentage: progressPercentage,
          completed_at: progressPercentage === 100 ? new Date().toISOString() : null,
        })
        .eq('id', enrollment.id);

      if (progressPercentage === 100) {
        const { data: existingCert } = await supabase
          .from('certificates')
          .select('*')
          .eq('student_id', user.id)
          .eq('course_id', course.id)
          .maybeSingle();

        if (!existingCert) {
          await supabase.from('certificates').insert({
            student_id: user.id,
            course_id: course.id,
          });
        }
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Course</span>
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 text-white p-4">
          <div className="text-sm text-gray-400 mb-1">{course.title}</div>
          <h1 className="text-2xl font-bold">
            Lesson {currentIndex + 1}: {lesson.title}
          </h1>
        </div>

        {(lesson as any).video_file_url ? (
          <div className="bg-black">
            <video
              controls
              className="w-full h-auto"
              src={(lesson as any).video_file_url}
            />
          </div>
        ) : lesson.video_url ? (
          <div className="aspect-video bg-black">
            <iframe
              src={lesson.video_url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : null}

        <div className="p-6 space-y-6">
          {lesson.description && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">About this lesson</h2>
              <p className="text-gray-600">{lesson.description}</p>
            </div>
          )}

          {lesson.content && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Lesson Content</h2>
              <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {lesson.content}
              </div>
            </div>
          )}

          {(lesson as any).pdf_notes_url && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText size={24} className="text-primary-600" />
                  <div>
                    <h3 className="font-semibold text-gray-800">PDF Notes</h3>
                    <p className="text-sm text-gray-600">Lesson notes and materials</p>
                  </div>
                </div>
                <a
                  href={(lesson as any).pdf_notes_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                >
                  <Download size={18} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          )}

          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              {completed ? (
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                  <CheckCircle size={20} />
                  <span className="font-medium">Completed</span>
                </div>
              ) : (
                <button
                  onClick={markAsComplete}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Mark as Complete
                </button>
              )}

              {quiz && (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition font-medium"
                >
                  Take Quiz
                </button>
              )}
            </div>

            {hasNextLesson && (
              <button
                onClick={goToNextLesson}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                <span>Next Lesson</span>
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Course Progress</h3>
        <div className="space-y-2">
          {allLessons.map((l, index) => (
            <div
              key={l.id}
              className={`flex items-center space-x-3 p-2 rounded ${
                l.id === lesson.id ? 'bg-primary-50' : ''
              }`}
            >
              <span className="text-sm text-gray-500">{index + 1}</span>
              <span className={`text-sm flex-1 ${l.id === lesson.id ? 'font-medium text-primary-600' : 'text-gray-700'}`}>
                {l.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
