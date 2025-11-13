import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Header from './components/Layout/Header';
import HomePage from './components/Home/HomePage';
import CourseList from './components/Courses/CourseList';
import CourseDetail from './components/Courses/CourseDetail';
import LessonViewer from './components/Lessons/LessonViewer';
import StudentDashboard from './components/Dashboard/StudentDashboard';
import InstructorDashboard from './components/Dashboard/InstructorDashboard';
import CertificatesPage from './components/Certificates/CertificatesPage';

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
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onNavigate={handleNavigate} currentPage={currentPage} />

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
      )}

      {currentPage === 'dashboard' && profile && (
        <>
          {profile.role === 'instructor' ? (
            <InstructorDashboard />
          ) : (
            <StudentDashboard
              onCourseSelect={handleCourseSelect}
              onCertificateView={() => setCurrentPage('certificates')}
            />
          )}
        </>
      )}

      {currentPage === 'certificates' && (
        <CertificatesPage onBack={handleBackToDashboard} />
      )}
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
