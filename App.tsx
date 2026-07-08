import { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Layout/Header';
import HomePage from './components/Home/HomePage';
import CourseList from './components/Courses/CourseList';
import CourseDetail from './components/Courses/CourseDetail';
import StudentDashboard from './components/Dashboard/StudentDashboard';

// Code-split the less-frequently-visited surfaces: instructor tooling, the
// application wizard, lesson playback (pulls in the quiz viewer + Kairos
// Mind chat UI), and certificates — none of these are needed for the
// first paint of the guest/learner browsing path.
const LessonViewer = lazy(() => import('./components/Lessons/LessonViewer'));
const InstructorDashboard = lazy(() => import('./components/Dashboard/InstructorDashboard'));
const InstructorApplicationFlow = lazy(() => import('./components/Dashboard/InstructorApplication'));
const CertificatesPage = lazy(() => import('./components/Certificates/CertificatesPage'));
const AccountSettings = lazy(() => import('./components/Account/AccountSettings'));
const ReviewQueue = lazy(() => import('./components/Dashboard/ReviewQueue'));

function PageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

function AppContent() {
  const { profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('course-')) {
        setSelectedCourseId(hash.replace('course-', ''));
        setCurrentPage('course-detail');
      } else if (hash.startsWith('lesson-')) {
        setSelectedLessonId(hash.replace('lesson-', ''));
        setCurrentPage('lesson-viewer');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCurrentPage('course-detail');
    window.location.hash = `course-${courseId}`;
  };

  const handleStartLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setCurrentPage('lesson-viewer');
    window.location.hash = `lesson-${lessonId}`;
  };

  const handleBackToCourses = () => {
    setCurrentPage('courses');
    setSelectedCourseId(null);
    window.location.hash = '';
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setSelectedLessonId(null);
    window.location.hash = '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Instructor studio is gated on role AND verified — role alone is not
  // enough, since it's only flipped by the instructor-approval backend
  // after the applicant passes the verification pipeline.
  const isVerifiedInstructor = !!profile && profile.role === 'instructor' && profile.verified;

  return (
    <div className="min-h-screen bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-primary-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      <Header onNavigate={handleNavigate} currentPage={currentPage} />

      <main id="main-content">
        {currentPage === 'home' && (
          <HomePage onNavigate={handleNavigate} onCourseSelect={handleCourseSelect} />
        )}

        {currentPage === 'courses' && (
          <CourseList onCourseSelect={handleCourseSelect} />
        )}

        {currentPage === 'course-detail' && selectedCourseId && (
          <CourseDetail
            courseId={selectedCourseId}
            onBack={handleBackToCourses}
            onStartLesson={handleStartLesson}
          />
        )}

        {currentPage === 'lesson-viewer' && selectedLessonId && (
          <Suspense fallback={<PageFallback />}>
            <LessonViewer
              lessonId={selectedLessonId}
              onBack={() => {
                if (selectedCourseId) {
                  handleCourseSelect(selectedCourseId);
                } else {
                  handleBackToDashboard();
                }
              }}
            />
          </Suspense>
        )}

        {currentPage === 'dashboard' && profile && (
          <>
            {isVerifiedInstructor ? (
              <Suspense fallback={<PageFallback />}>
                <InstructorDashboard />
              </Suspense>
            ) : (
              <StudentDashboard
                onCourseSelect={handleCourseSelect}
                onCertificateView={() => setCurrentPage('certificates')}
                onBecomeInstructor={() => handleNavigate('become-instructor')}
              />
            )}
          </>
        )}

        {currentPage === 'become-instructor' && profile && !isVerifiedInstructor && (
          <Suspense fallback={<PageFallback />}>
            <InstructorApplicationFlow />
          </Suspense>
        )}

        {currentPage === 'certificates' && (
          <Suspense fallback={<PageFallback />}>
            <CertificatesPage onBack={handleBackToDashboard} />
          </Suspense>
        )}

        {currentPage === 'account-settings' && profile && (
          <Suspense fallback={<PageFallback />}>
            <AccountSettings onBack={handleBackToDashboard} />
          </Suspense>
        )}

        {currentPage === 'review-queue' && profile?.is_reviewer && (
          <Suspense fallback={<PageFallback />}>
            <ReviewQueue />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
