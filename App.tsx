import { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LocaleProvider } from './contexts/LocaleContext';
import Header from './components/Layout/Header';
import HomePage from './components/Home/HomePage';
import CourseList from './components/Courses/CourseList';
import CourseDetail from './components/Courses/CourseDetail';
import StudentDashboard from './components/Dashboard/StudentDashboard';
import ResetPasswordPrompt from './components/Auth/ResetPasswordPrompt';

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
const MyRequests = lazy(() => import('./components/Tutors/MyRequests'));
const RequestForm = lazy(() => import('./components/Tutors/RequestForm'));
const MatchStatus = lazy(() => import('./components/Tutors/MatchStatus'));
const InstitutionalLandingPage = lazy(() => import('./components/Institutional/InstitutionalLandingPage'));

function PageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, isPasswordRecovery } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedTutorRequestId, setSelectedTutorRequestId] = useState<string | null>(null);
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('course-')) {
        setSelectedCourseId(hash.replace('course-', ''));
        setCurrentPage('course-detail');
      } else if (hash.startsWith('lesson-')) {
        setSelectedLessonId(hash.replace('lesson-', ''));
        setCurrentPage('lesson-viewer');
      } else if (hash.startsWith('tutor-request-')) {
        setSelectedTutorRequestId(hash.replace('tutor-request-', ''));
        setCurrentPage('tutor-request-detail');
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

  const handleSearchCourses = (term: string) => {
    setCourseSearchTerm(term);
    setCourseCategoryFilter(null);
    handleNavigate('courses');
  };

  const handleFilterCoursesByCategory = (categoryId: string) => {
    setCourseCategoryFilter(categoryId);
    setCourseSearchTerm('');
    handleNavigate('courses');
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

  const handleSelectTutorRequest = (requestId: string) => {
    setSelectedTutorRequestId(requestId);
    setCurrentPage('tutor-request-detail');
    window.location.hash = `tutor-request-${requestId}`;
  };

  const handleBackToMyRequests = () => {
    setCurrentPage('my-requests');
    setSelectedTutorRequestId(null);
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

      {isPasswordRecovery && <ResetPasswordPrompt />}

      <main id="main-content">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onCourseSelect={handleCourseSelect}
            onSearchCourses={handleSearchCourses}
            onFilterByCategory={handleFilterCoursesByCategory}
          />
        )}

        {currentPage === 'courses' && (
          <CourseList
            onCourseSelect={handleCourseSelect}
            initialSearch={courseSearchTerm}
            initialCategory={courseCategoryFilter}
          />
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
                onNavigate={handleNavigate}
                onCourseSelect={handleCourseSelect}
                onCertificateView={() => setCurrentPage('certificates')}
                onBecomeInstructor={() => handleNavigate('become-instructor')}
              />
            )}
          </>
        )}

        {currentPage === 'my-requests' && user && profile?.role === 'student' && (
          <Suspense fallback={<PageFallback />}>
            <div className="max-w-[1200px] mx-auto px-6 py-10">
              <MyRequests
                parentId={user.id}
                onSelectRequest={handleSelectTutorRequest}
                onNewRequest={() => handleNavigate('tutor-request-new')}
              />
            </div>
          </Suspense>
        )}

        {currentPage === 'tutor-request-new' && user && profile?.role === 'student' && (
          <Suspense fallback={<PageFallback />}>
            <div className="max-w-[1200px] mx-auto px-6 py-10">
              <RequestForm onSubmitted={(request) => handleSelectTutorRequest(request.id)} />
            </div>
          </Suspense>
        )}

        {currentPage === 'tutor-request-detail' && user && selectedTutorRequestId && (
          <Suspense fallback={<PageFallback />}>
            <div className="max-w-[1200px] mx-auto px-6 py-10">
              <button onClick={handleBackToMyRequests} className="text-sm text-gray-500 hover:text-gray-800 transition mb-5">
                ← Back to my requests
              </button>
              <MatchStatus requestId={selectedTutorRequestId} currentUserId={user.id} />
            </div>
          </Suspense>
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

        {currentPage === 'audience-schools' && (
          <Suspense fallback={<PageFallback />}>
            <InstitutionalLandingPage accountType="school_university" />
          </Suspense>
        )}

        {currentPage === 'audience-business' && (
          <Suspense fallback={<PageFallback />}>
            <InstitutionalLandingPage accountType="business" />
          </Suspense>
        )}

        {currentPage === 'audience-government' && (
          <Suspense fallback={<PageFallback />}>
            <InstitutionalLandingPage accountType="government" />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LocaleProvider>
  );
}

export default App;
