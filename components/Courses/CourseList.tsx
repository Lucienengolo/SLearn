import { useState, useEffect } from 'react';
import { Search, Bookmark } from 'lucide-react';
import { supabase, Course, Category, CourseStats } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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

type SortOption = 'newest' | 'price_low' | 'price_high' | 'title';

const PAGE_SIZE = 12;

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  price_low: 'Price: low to high',
  price_high: 'Price: high to low',
  title: 'Title A-Z',
};

export default function CourseList({ onCourseSelect, initialSearch, initialCategory }: CourseListProps) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory ?? 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearch ?? '');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedCourseIds, setSavedCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (user) fetchSavedCourseIds();
    else setSavedCourseIds(new Set());
  }, [user]);

  useEffect(() => {
    setPage(0);
    if (savedOnly) {
      fetchSavedCourses();
    } else {
      fetchCourses(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery, sortBy, savedOnly]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (data) setCategories(data);
  };

  const fetchSavedCourseIds = async () => {
    if (!user) return;
    const { data } = await supabase.from('saved_courses').select('course_id').eq('student_id', user.id);
    setSavedCourseIds(new Set((data ?? []).map((r) => r.course_id)));
  };

  const attachStats = async (rows: Course[]): Promise<CourseWithStats[]> => {
    const { data: statsRows } = await supabase
      .from('course_stats')
      .select('*')
      .in('course_id', rows.map((c) => c.id));

    const statsByCourseId = new Map((statsRows ?? []).map((s: CourseStats) => [s.course_id, s]));

    return rows.map((course) => {
      const stats = statsByCourseId.get(course.id);
      return {
        ...course,
        enrollmentCount: stats?.enrollment_count ?? 0,
        averageRating: stats?.average_rating ?? 0,
      };
    });
  };

  // "Saved" is a small, personal list -- fetched in full (no pagination)
  // rather than folded into the paginated/filtered query above, since a
  // student's saved list realistically never approaches page-size volume.
  const fetchSavedCourses = async () => {
    if (!user) {
      setCourses([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('saved_courses')
      .select('course:courses(*, instructor:profiles!instructor_id(full_name, verified), category:categories(name))')
      .eq('student_id', user.id);

    const rows = (data ?? [])
      .map((r) => (Array.isArray(r.course) ? r.course[0] : r.course))
      .filter(Boolean) as unknown as Course[];
    const withStats = await attachStats(rows);
    setCourses(withStats);
    setTotalCount(withStats.length);
    setLoading(false);
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
        instructor:profiles!instructor_id(full_name, verified),
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

    if (sortBy === 'price_low') {
      query = query.order('price', { ascending: true });
    } else if (sortBy === 'price_high') {
      query = query.order('price', { ascending: false });
    } else if (sortBy === 'title') {
      query = query.order('title', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const from = targetPage * PAGE_SIZE;
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching courses:', error);
    } else if (data) {
      setTotalCount(count ?? data.length);
      const withStats = await attachStats(data as Course[]);
      setCourses((prev) => (append ? [...prev, ...withStats] : withStats));
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCourses(nextPage, true);
  };

  const handleToggleSave = async (courseId: string) => {
    if (!user) return;
    const isSaved = savedCourseIds.has(courseId);

    setSavedCourseIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(courseId);
      else next.add(courseId);
      return next;
    });

    if (isSaved) {
      await supabase.from('saved_courses').delete().eq('student_id', user.id).eq('course_id', courseId);
      if (savedOnly) setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } else {
      await supabase.from('saved_courses').insert({ student_id: user.id, course_id: courseId });
    }
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

        <div className="flex flex-wrap items-center gap-2 justify-between">
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

          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setSavedOnly((v) => !v)}
                aria-pressed={savedOnly}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-medium transition whitespace-nowrap ${
                  savedOnly
                    ? 'border-primary-200 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-gray-900'
                }`}
              >
                <Bookmark size={15} className={savedOnly ? 'fill-primary-600' : ''} />
                Saved
              </button>
            )}
            {!savedOnly && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort courses"
                className="h-9 pl-3.5 pr-8 border border-gray-200 rounded-full text-sm font-medium text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">
            {savedOnly ? "You haven't saved any courses yet" : 'No courses found'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => onCourseSelect(course.id)}
                isSaved={savedCourseIds.has(course.id)}
                onToggleSave={user ? () => handleToggleSave(course.id) : undefined}
              />
            ))}
          </div>
          {!savedOnly && courses.length < totalCount && (
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
