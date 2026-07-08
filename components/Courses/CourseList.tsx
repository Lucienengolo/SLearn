import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase, Course, Category } from '../../lib/supabase';
import CourseCard from './CourseCard';
import { getCourseCover } from '../../lib/courseCovers';

type CourseListProps = {
  onCourseSelect: (courseId: string) => void;
};

type CourseWithStats = Course & {
  instructor?: { full_name: string };
  category?: { name: string };
  enrollmentCount: number;
  averageRating: number;
};

export default function CourseList({ onCourseSelect }: CourseListProps) {
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchCourses();
  }, [selectedCategory, searchQuery]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (data) setCategories(data);
  };

  const fetchCourses = async () => {
    setLoading(true);
    let query = supabase
      .from('courses')
      .select(`
        *,
        instructor:profiles!instructor_id(full_name),
        category:categories(name)
      `)
      .eq('is_published', true);

    if (selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching courses:', error);
    } else if (data) {
      const coursesWithStats = await Promise.all(
        data.map(async (course: Course) => {
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
      setCourses(coursesWithStats);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="mb-7">
        <h1 className="font-display text-3xl sm:text-4xl text-gray-900 mb-6">Explore courses</h1>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search courses..."
            aria-label="Search courses"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 h-12 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium transition ${
              selectedCategory === 'all'
                ? 'border-primary-200 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-gray-900'
            }`}
          >
            All categories
          </button>
          {categories.map((category) => {
            const CategoryIcon = getCourseCover(category.name).icon;
            const active = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium transition whitespace-nowrap ${
                  active
                    ? 'border-primary-200 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-gray-900'
                }`}
              >
                <CategoryIcon size={15} />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No courses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => onCourseSelect(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
