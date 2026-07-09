import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase, Course, Category, CourseStats } from '../../lib/supabase';
import CourseCard from './CourseCard';
import { getCourseCover } from '../../lib/courseCovers';

type CourseListProps = {
  onCourseSelect: (courseId: string) => void;
  initialSearch?: string;
  initialCategory?: string | null;
};

type CourseWithStats = Course & {
  instructor?: { full_name: string };
  category?: { name: string };
  enrollmentCount: number;
  averageRating: number;
};

const PAGE_SIZE = 12;

export default function CourseList({ onCourseSelect, initialSearch, initialCategory }: CourseListProps) {
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory ?? 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearch ?? '');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setPage(0);
    fetchCourses(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (data) setCategories(data);
  };

  const fetchCourses = async (targetPage: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    let query = supabase
      .from('courses')
      .select(
        `
        *,
        instructor:profiles!instructor_id(full_name),
        category:categories(name)
      `,
        { count: 'exact' }
      )
      .eq('is_published', true);

    if (selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const from = targetPage * PAGE_SIZE;
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching courses:', error);
    } else if (data) {
      setTotalCount(count ?? data.length);

      // One follow-up query for every course's stats, instead of 2 per
      // course (previously enrollment count + reviews, N+1 -- see
      // course_stats in 0020/0021_*.sql).
      const { data: statsRows } = await supabase
        .from('course_stats')
        .select('*')
        .in('course_id', data.map((c: Course) => c.id));

      const statsByCourseId = new Map((statsRows ?? []).map((s: CourseStats) => [s.course_id, s]));

      const page = data.map((course: Course) => {
        const stats = statsByCourseId.get(course.id);
        return {
          ...course,
          enrollmentCount: stats?.enrollment_count ?? 0,
          averageRating: stats?.average_rating ?? 0,
        };
      });

      setCourses((prev) => (append ? [...prev, ...page] : page));
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCourses(nextPage, true);
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => onCourseSelect(course.id)}
              />
            ))}
          </div>
          {courses.length < totalCount && (
            <div className="text-center mt-8">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition font-medium h-11 px-6 rounded-[10px] disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : `Load more (${totalCount - courses.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
