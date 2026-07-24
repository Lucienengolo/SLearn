import { useState, useEffect } from 'react';
import { Clock, Users, Star, BookOpen, CheckCircle, Lock, PlayCircle, ChevronRight, Wifi, Award, GraduationCap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase, Course, Lesson, Review, Enrollment, Quiz } from '../../lib/supabase';
import { getGuestCourseProgress, isGuestLessonComplete, guestEnroll, isGuestEnrolled } from '../../lib/guestSession';
import { trackEvent } from '../../lib/analytics';
import { getCourseCover } from '../../lib/courseCovers';
import { getCourseFinalExam, hasPassedQuiz, issueCertificateIfEligible } from '../../lib/certificates';
import ReviewForm from './ReviewForm';
import QuizViewer from '../Quiz/QuizViewer';

type CourseDetailProps = {
  courseId: string;
  onBack: () => void;
  onStartLesson: (lessonId: string) => void;
};

type CourseWithRelations = Course & {
  instructor?: { full_name: string; bio: string | null; verified?: boolean };
  category?: { name: string };
};

type ReviewWithStudent = Review & { student: { full_name: string } };

export default function CourseDetail({ courseId, onBack, onStartLesson }: CourseDetailProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const isInstructor = profile?.role === 'instructor';
  const [course, setCourse] = useState<CourseWithRelations | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<ReviewWithStudent[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutNotice, setCheckoutNotice] = useState<'success' | 'cancel' | null>(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [finalExam, setFinalExam] = useState<Quiz | null>(null);
  const [finalExamPassed, setFinalExamPassed] = useState(false);
  const [showFinalExam, setShowFinalExam] = useState(false);

  useEffect(() => {
    fetchCourseData();
  }, [courseId, user]);

  // Stripe redirects back with ?checkout=success|cancel before the hash
  // (see create-checkout-session's success_url/cancel_url). Consume it once
  // so a page refresh doesn't re-trigger the banner, then poll briefly for
  // success since stripe-webhook creates the enrollment asynchronously.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout !== 'success' && checkout !== 'cancel') return;

    setCheckoutNotice(checkout);
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);

    if (checkout === 'success') {
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts += 1;
        await fetchCourseData();
        if (attempts >= 5) clearInterval(poll);
      }, 2000);
      return () => clearInterval(poll);
    }
  }, [courseId]);

  useEffect(() => {
    if (checkoutNotice === 'success' && isEnrolled) {
      setCheckoutNotice(null);
    }
  }, [checkoutNotice, isEnrolled]);

  const fetchCourseData = async () => {
    const { data: courseData } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:profiles!instructor_id(full_name, bio, verified),
        category:categories(name)
      `)
      .eq('id', courseId)
      .single();

    if (courseData) {
      setCourse(courseData);

      const exam = await getCourseFinalExam(courseId);
      setFinalExam(exam);

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (lessonsData) setLessons(lessonsData);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          *,
          student:profiles!student_id(full_name)
        `)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (reviewsData) setReviews(reviewsData);

      if (user) {
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('student_id', user.id)
          .eq('course_id', courseId)
          .maybeSingle();

        if (enrollmentData) {
          setIsEnrolled(true);
          setEnrollment(enrollmentData);
        }

        if (exam) {
          setFinalExamPassed(await hasPassedQuiz(user.id, exam.id));
        }

        if (lessonsData && lessonsData.length > 0) {
          const { data: progressData } = await supabase
            .from('lesson_progress')
            .select('lesson_id, completed')
            .eq('student_id', user.id)
            .in('lesson_id', lessonsData.map((l) => l.id))
            .eq('completed', true);

          setCompletedLessonIds(new Set((progressData ?? []).map((p) => p.lesson_id)));
        }
      } else if (isGuestEnrolled(courseId)) {
        setIsEnrolled(true);
        if (lessonsData) {
          setCompletedLessonIds(new Set(lessonsData.filter((l) => isGuestLessonComplete(l.id)).map((l) => l.id)));
        }
      }
    }
    setLoading(false);
  };

  const handleEnroll = async () => {
    // Accounts are single-role: instructors can't also enroll as students.
    if (isInstructor) return;

    if (!user) {
      // Guest mode: free courses only, tracked in sessionStorage, no server write.
      if (course && course.price === 0) {
        guestEnroll(courseId);
        setIsEnrolled(true);
        trackEvent('course_enrolled', { courseId, guest: true, price: course.price });
      } else {
        showToast('Please sign in to enroll in paid courses', 'error');
      }
      return;
    }

    if (course && course.price > 0) {
      setStartingCheckout(true);
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { courseId, origin: window.location.origin },
      });
      setStartingCheckout(false);

      if (error || !data?.url) {
        console.error('Error starting checkout:', error);
        showToast('Could not start checkout. Please try again.', 'error');
        return;
      }

      window.location.href = data.url;
      return;
    }

    const { error } = await supabase.from('enrollments').insert({
      student_id: user.id,
      course_id: courseId,
    });

    if (error) {
      console.error('Error enrolling:', error);
      showToast('Failed to enroll in course', 'error');
    } else {
      setIsEnrolled(true);
      trackEvent('course_enrolled', { courseId, guest: false, price: course?.price });
      fetchCourseData();
    }
  };

  const handleFinalExamPassed = async () => {
    if (!user || !enrollment || !course) return;
    await supabase
      .from('enrollments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', enrollment.id);
    await issueCertificateIfEligible(user.id, course);
    setShowFinalExam(false);
    fetchCourseData();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!course) return null;

  if (showFinalExam && finalExam) {
    return (
      <QuizViewer
        quizId={finalExam.id}
        onBack={() => setShowFinalExam(false)}
        onComplete={handleFinalExamPassed}
      />
    );
  }

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  // Matches the "enrolled students write their own review" RLS policy:
  // signed in, enrolled, and not the course's own instructor account.
  const myReview = user ? reviews.find((r) => r.student_id === user.id) ?? null : null;
  const canReview = !!user && isEnrolled && !isInstructor;

  const progressPercentage = enrollment
    ? enrollment.progress_percentage
    : getGuestCourseProgress(lessons.map((l) => l.id));

  const cover = getCourseCover(course.category?.name);
  const CoverIcon = cover.icon;
  const firstAvailableLessonId = lessons.find((l) => !completedLessonIds.has(l.id))?.id ?? lessons[0]?.id;
  const finalExamPending =
    !!user && !!finalExam && !finalExamPassed && !enrollment?.completed_at && progressPercentage === 100;

  const enrollButton = (className: string) => (
    <button
      onClick={handleEnroll}
      disabled={startingCheckout}
      className={`${className} bg-primary-500 text-gray-900 shadow-sm hover:shadow-md hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm`}
    >
      {startingCheckout
        ? 'Redirecting to checkout…'
        : user
        ? course.price > 0
          ? 'Enroll now — pay & enroll'
          : 'Enroll now'
        : course.price === 0
        ? 'Start free (guest)'
        : 'Sign in to enroll'}
    </button>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <div className="max-w-[1200px] mx-auto px-6 pt-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <button onClick={onBack} className="hover:text-gray-800 transition">Courses</button>
          {course.category?.name && (
            <>
              <ChevronRight size={14} />
              <span>{course.category.name}</span>
            </>
          )}
          <ChevronRight size={14} />
          <span className="text-gray-700">{course.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* MAIN */}
          <div className="min-w-0 space-y-7">
            <div
              className="relative rounded-[14px] overflow-hidden h-[220px] sm:h-[260px] flex items-end p-6 shadow-md"
              style={{ background: cover.gradient }}
            >
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  fetchPriority="high"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <CoverIcon size={88} className="absolute top-6 right-6 text-white/15" />
              )}
              <div className="relative">
                <div className="flex gap-2 mb-3">
                  {course.category?.name && (
                    <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-white bg-white/15 px-2.5 py-1 rounded-full">
                      {course.category.name}
                    </span>
                  )}
                  <span className="text-2xs font-semibold text-white bg-white/15 px-2.5 py-1 rounded-full capitalize">
                    {course.level}
                  </span>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl text-white leading-tight">{course.title}</h1>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-6 pb-6 border-b border-canvas-150">
              {reviews.length > 0 && (
                <div className="flex items-center gap-2">
                  <Star size={18} className="fill-primary-500 text-primary-500" />
                  <span className="font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-500">({reviews.length} reviews)</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Users size={18} />
                {lessons.length > 0 ? `Open to all levels` : 'No lessons yet'}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={18} />
                {course.duration_hours} hours
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <BookOpen size={18} />
                {lessons.length} lessons
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl text-gray-900 mb-2.5">About this course</h2>
              <p className="text-gray-600 leading-relaxed">{course.description}</p>
            </div>

            {/* Curriculum */}
            <div>
              <div className="flex justify-between items-baseline mb-4">
                <h2 className="font-display text-2xl text-gray-900">Course content</h2>
                <span className="text-sm text-gray-500">{lessons.length} lessons · {course.duration_hours}h total</span>
              </div>
              <div className="space-y-2">
                {lessons.map((lesson) => {
                  const done = completedLessonIds.has(lesson.id);
                  const isCurrent = isEnrolled && !done && lesson.id === firstAvailableLessonId;
                  const clickable = isEnrolled;
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => clickable && onStartLesson(lesson.id)}
                      className={`flex items-center gap-3.5 p-3.5 rounded-[14px] border shadow-sm transition-[box-shadow,transform,border-color] ${
                        clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300' : 'cursor-not-allowed opacity-70'
                      } ${isCurrent ? 'border-primary-200 bg-primary-50' : 'border-canvas-150'}`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          done ? 'bg-green-50 text-green-600' : isCurrent ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {done ? <CheckCircle size={16} /> : clickable ? <PlayCircle size={16} /> : <Lock size={16} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{lesson.title}</p>
                        {lesson.description && (
                          <p className="text-sm text-gray-500 truncate">{lesson.description}</p>
                        )}
                      </div>
                      {lesson.duration_minutes > 0 && (
                        <span className="text-sm text-gray-500 flex-shrink-0">{lesson.duration_minutes} min</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instructor */}
            {course.instructor && (
              <div className="rounded-[14px] border border-canvas-150 p-6 flex gap-4 items-start shadow-sm">
                <span
                  className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold"
                  style={{ background: cover.gradient }}
                >
                  {course.instructor.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
                <div>
                  <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-gray-500">Instructor</span>
                  <p className="text-lg font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
                    {course.instructor.full_name}
                    {course.instructor.verified && (
                      <span
                        className="text-2xs font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 normal-case tracking-normal"
                        title="Verified instructor"
                      >
                        <CheckCircle size={12} />
                        Verified
                      </span>
                    )}
                  </p>
                  {course.instructor.bio && (
                    <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{course.instructor.bio}</p>
                  )}
                </div>
              </div>
            )}

            {/* Reviews */}
            {(reviews.length > 0 || canReview) && (
              <div>
                <h2 className="font-display text-2xl text-gray-900 mb-4">Student reviews</h2>
                {canReview && (
                  <div className="mb-4">
                    <ReviewForm
                      courseId={courseId}
                      userId={user!.id}
                      existingReview={myReview}
                      onSubmitted={fetchCourseData}
                    />
                  </div>
                )}
                <div className="space-y-3">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="rounded-[14px] border border-canvas-150 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-gray-900">{review.student.full_name}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i < review.rating ? 'fill-primary-500 text-primary-500' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ENROLL SIDEBAR (desktop) */}
          <div className="hidden lg:block sticky top-[90px]">
            <div className="rounded-[14px] border border-canvas-150 shadow-lg p-5">
              {checkoutNotice === 'success' && !isEnrolled && (
                <div className="mb-4 text-sm text-primary-700 bg-primary-50 p-3 rounded-[10px]">
                  Payment received — activating your enrollment…
                </div>
              )}
              {checkoutNotice === 'cancel' && (
                <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-[10px]">
                  Checkout cancelled — you have not been charged.
                </div>
              )}

              <p className="font-display text-4xl text-gray-900 mb-4">
                {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free'}
              </p>

              {isEnrolled ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium bg-green-50 text-green-700 px-3 py-2.5 rounded-[10px]">
                    <CheckCircle size={18} />
                    Enrolled — {progressPercentage}% complete
                  </div>
                  {lessons.length > 0 && (
                    <div className="h-2 rounded-full bg-canvas-150 overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-[width] duration-300 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  )}
                  {!user && (
                    <p className="text-2xs text-gray-500">
                      Browsing as guest — your progress is only saved for this session.
                    </p>
                  )}
                  {finalExamPending ? (
                    <>
                      <p className="text-2xs text-gray-500">
                        All lessons complete — pass the final exam to earn your certificate.
                      </p>
                      <button
                        onClick={() => setShowFinalExam(true)}
                        className="w-full flex items-center justify-center gap-1.5 bg-primary-500 text-gray-900 shadow-sm hover:shadow-md hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold h-12 rounded-[10px]"
                      >
                        <GraduationCap size={18} />
                        Take final exam
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => firstAvailableLessonId && onStartLesson(firstAvailableLessonId)}
                      className="w-full bg-primary-500 text-gray-900 shadow-sm hover:shadow-md hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold h-12 rounded-[10px]"
                    >
                      Continue learning
                    </button>
                  )}
                </div>
              ) : isInstructor ? (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-[10px] text-center">
                  Instructor accounts can't enroll in courses
                </div>
              ) : (
                enrollButton('w-full h-12 rounded-[10px]')
              )}

              <div className="mt-5 pt-5 border-t border-canvas-150 space-y-2.5 text-sm text-gray-600">
                <div className="flex items-center gap-2.5">
                  <Wifi size={16} className="text-gray-400" />
                  Learn on any device, offline-friendly
                </div>
                <div className="flex items-center gap-2.5">
                  <Award size={16} className="text-gray-400" />
                  Certificate of completion
                </div>
                <div className="flex items-center gap-2.5">
                  <BookOpen size={16} className="text-gray-400" />
                  {lessons.length} lessons · {course.duration_hours}h of content
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky enroll bar */}
      {!isInstructor && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-canvas-150 shadow-lg px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {isEnrolled ? (
              <>
                <div className="text-2xs text-gray-500">
                  {finalExamPending ? 'Final exam remaining' : `${progressPercentage}% complete`}
                </div>
                <div className="font-bold text-gray-900">{finalExamPending ? 'Take final exam' : 'Continue learning'}</div>
              </>
            ) : (
              <div className="font-bold text-lg text-gray-900">
                {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free'}
              </div>
            )}
          </div>
          {isEnrolled ? (
            <button
              onClick={() =>
                finalExamPending ? setShowFinalExam(true) : firstAvailableLessonId && onStartLesson(firstAvailableLessonId)
              }
              className="bg-primary-500 text-gray-900 hover:bg-primary-400 transition font-semibold h-11 px-5 rounded-[10px] flex-shrink-0"
            >
              {finalExamPending ? 'Take exam' : 'Continue'}
            </button>
          ) : (
            enrollButton('h-11 px-5 rounded-[10px] flex-shrink-0')
          )}
        </div>
      )}
    </div>
  );
}
