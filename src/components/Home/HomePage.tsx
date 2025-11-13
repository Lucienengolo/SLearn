import { useState, useEffect } from 'react';
import { BookOpen, Users, Award, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CourseCard from '../Courses/CourseCard';

type HomePageProps = {
  onNavigate: (page: string) => void;
  onCourseSelect: (courseId: string) => void;
};

export default function HomePage({ onNavigate, onCourseSelect }: HomePageProps) {
  const { user } = useAuth();
  const [featuredCourses, setFeaturedCourses] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalInstructors: 0,
  });

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    const { data: coursesData } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:profiles!instructor_id(full_name),
        category:categories(name)
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(6);

    if (coursesData) {
      const coursesWithStats = await Promise.all(
        coursesData.map(async (course: any) => {
          const { count: enrollmentCount } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('course_id', course.id);

          const averageRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

          return {
            ...course,
            enrollmentCount: enrollmentCount || 0,
            averageRating,
          };
        })
      );
      setFeaturedCourses(coursesWithStats);
    }

    const { count: coursesCount } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    const { count: studentsCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    const { count: instructorsCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'instructor');

    setStats({
      totalCourses: coursesCount || 0,
      totalStudents: studentsCount || 0,
      totalInstructors: instructorsCount || 0,
    });
  };

  return (
    <div>
      <section
        className="text-white py-20 bg-cover bg-center"
        style={{ backgroundImage: `url('/dist/assets/banner%20page.png')` }}
        aria-label="Home banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Learn New Skills Online
            </h1>
            <p className="text-xl text-primary-100 mb-8">
              Discover thousands of courses taught by expert instructors. Start learning today and achieve your goals.
            </p>
            {!user && (
              <button
                onClick={() => onNavigate('courses')}
                className="bg-white text-primary-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition font-semibold text-lg"
              >
                Explore Courses
              </button>
            )}
            {user && (
              <button
                onClick={() => onNavigate('dashboard')}
                className="bg-white text-primary-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition font-semibold text-lg"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <BookOpen className="text-primary-600" size={32} />
              </div>
              <h3 className="text-3xl font-bold text-gray-800 mb-2">{stats.totalCourses}+</h3>
              <p className="text-gray-600">Courses Available</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Users className="text-green-600" size={32} />
              </div>
              <h3 className="text-3xl font-bold text-gray-800 mb-2">{stats.totalStudents}+</h3>
              <p className="text-gray-600">Active Students</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
                <Award className="text-orange-600" size={32} />
              </div>
              <h3 className="text-3xl font-bold text-gray-800 mb-2">{stats.totalInstructors}+</h3>
              <p className="text-gray-600">Expert Instructors</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Featured Courses</h2>
              <p className="text-gray-600 mt-2">Explore our most popular courses</p>
            </div>
            <button
              onClick={() => onNavigate('courses')}
              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <span>View All</span>
              <ArrowRight size={20} />
            </button>
          </div>

          {featuredCourses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No courses available yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onClick={() => onCourseSelect(course.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

         <section
        className="text-white py-20 bg-cover bg-center"
        style={{ backgroundImage: `url('/dist/assets/banner%20R.png')` }}
        aria-label="Home banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Why Choose LearnHub?</h2>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <TrendingUp className="flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="font-semibold text-lg">Learn at Your Own Pace</h3>
                    <p className="text-blue-100">Access courses anytime, anywhere</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <Award className="flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="font-semibold text-lg">Earn Certificates</h3>
                    <p className="text-blue-100">Get recognized for your achievements</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <Users className="flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="font-semibold text-lg">Expert Instructors</h3>
                    <p className="text-blue-100">Learn from industry professionals</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Start Learning?</h3>
              <p className="text-blue-100 mb-6">
                Join thousands of students already learning on LearnHub
              </p>
              {!user ? (
                <button
                  onClick={() => onNavigate('courses')}
                  className="w-full bg-white text-primary-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition font-semibold"
                >
                  Get Started Today
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('courses')}
                  className="w-full bg-white text-primary-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition font-semibold"
                >
                  Browse Courses
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
