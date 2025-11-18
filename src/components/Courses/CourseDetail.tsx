import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Users, Star, BookOpen, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Course, Lesson, Review, Enrollment } from '../../lib/supabase';

type CourseDetailProps = {
  courseId: string;
  onBack: () => void;
  onStartLesson: (lessonId: string) => void;
};

export default function CourseDetail({ courseId, onBack, onStartLesson }: CourseDetailProps) {
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseData();
  }, [courseId, user]);

  const fetchCourseData = async () => {
    const { data: courseData } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:profiles!instructor_id(full_name, bio),
        category:categories(name)
      `)
      .eq('id', courseId)
      .single();

    if (courseData) {
      setCourse(courseData);

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
      }
    }
    setLoading(false);
  };

  const handleEnroll = async () => {
    if (!user) {
      alert('Please sign in to enroll in courses');
      return;
    }

    const { error } = await supabase.from('enrollments').insert({
      student_id: user.id,
      course_id: courseId,
    });

    if (error) {
      console.error('Error enrolling:', error);
      alert('Failed to enroll in course');
    } else {
      setIsEnrolled(true);
      fetchCourseData();
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!course) return null;

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <ArrowLeft size={20} />
        <span>Back to Courses</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg h-64 flex items-center justify-center text-white">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover rounded-lg" /> 
            ) : (
              <span className="text-8xl opacity-50">📚</span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              {course.category?.name && (
                <span className="text-sm bg-blue-100 text-primary-600 px-3 py-1 rounded">
 {course.category?.name}
                </span>
              )}
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded">
                {course.level}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">{course.title}</h1>
            <p className="text-gray-600 text-lg leading-relaxed">{course.description}</p>
          </div>

          <div className="flex items-center space-x-6 text-gray-600">
            <div className="flex items-center space-x-2">
              <Clock size={20} />
              <span>{course.duration_hours} hours</span>
            </div>
            <div className="flex items-center space-x-2">
              <BookOpen size={20} />
              <span>{lessons.length} lessons</span>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center space-x-2">
                <Star size={20} className="fill-yellow-400 text-yellow-400" />
                <span>{averageRating.toFixed(1)} ({reviews.length} reviews)</span>
              </div>
            )}
          </div>

          {course.instructor && (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Instructor</h3>
              <p className="text-lg font-medium text-gray-700">{course.instructor.full_name}</p>
              {course.instructor.bio && (
                <p className="text-gray-600 mt-2">{course.instructor.bio}</p>
              )}
            </div>
          )}

          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Course Content</h3>
            <div className="space-y-2">
              {lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className={`bg-white p-4 rounded-lg border ${
                    isEnrolled ? 'hover:border-primary-500 cursor-pointer' : 'border-gray-200'
                  }`}
                  onClick={() => isEnrolled && onStartLesson(lesson.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400 font-medium">{index + 1}</span>
                      <div>
                        <h4 className="font-medium text-gray-800">{lesson.title}</h4>
                        {lesson.description && (
                          <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                        )}
                      </div>
                    </div>
                    {lesson.duration_minutes > 0 && (
                      <span className="text-sm text-gray-500">{lesson.duration_minutes} min</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {reviews.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Student Reviews</h3>
              <div className="space-y-4">
                {reviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="bg-white p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{review.student.full_name}</span>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && <p className="text-gray-600">{review.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
            {course.price > 0 ? (
              <p className="text-3xl font-bold text-gray-800 mb-4">${course.price.toFixed(2)}</p>
            ) : (
              <p className="text-3xl font-bold text-green-600 mb-4">Free</p>
            )}

            {isEnrolled ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                  <CheckCircle size={20} />
                  <span className="font-medium">Enrolled</span>
                </div>
                {enrollment && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progress</span>
                      <span>{enrollment.progress_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full"
                        style={{ width: `${enrollment.progress_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => lessons.length > 0 && onStartLesson(lessons[0].id)}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-medium"
                >
                  Continue Learning
                </button>
              </div>
            ) : (
              <button
                onClick={handleEnroll}
                className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition font-medium"
              >
                {user ? 'Enroll Now' : 'Sign In to Enroll'}
              </button>
            )}

            <div className="mt-6 pt-6 border-t space-y-3 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <BookOpen size={18} />
                <span>{lessons.length} lessons</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={18} />
                <span>{course.duration_hours} hours of content</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users size={18} />
                <span>All levels welcome</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
