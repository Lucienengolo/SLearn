import { useState, useEffect } from 'react';
import { Search, BookOpen, Users, Award, Wifi, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase, Course } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CourseCard from '../Courses/CourseCard';
import { CATEGORY_COVERS } from '../../lib/courseCovers';

type HomePageProps = {
  onNavigate: (page: string) => void;
  onCourseSelect: (courseId: string) => void;
};

type CourseRow = Course & { instructor?: { full_name: string }; category?: { name: string } };
type CourseWithStats = CourseRow & { enrollmentCount: number; averageRating: number };

export default function HomePage({ onNavigate, onCourseSelect }: HomePageProps) {
  const { user } = useAuth();
  const [featuredCourses, setFeaturedCourses] = useState<CourseWithStats[]>([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    totalInstructors: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');

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
        (coursesData as CourseRow[]).map(async (course) => {
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

  // Full search-by-term filtering on the Courses page is a follow-up --
  // this submits to the same place "Explore Courses" goes today.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('courses');
  };

  const trust = [
    { icon: BookOpen, value: stats.totalCourses, label: 'courses' },
    { icon: Users, value: stats.totalStudents, label: 'learners' },
    { icon: Award, value: stats.totalInstructors, label: 'expert instructors' },
    { icon: Wifi, value: null, label: 'Low-data friendly' },
  ];

  return (
    <div>
      {/* Hero -- dark gold gradient with a radial glow, search-forward.
          Replaces the old background-image hero (which referenced a
          nonexistent /banner-p.png and rendered invisible in production --
          see README §5.E). */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1b1205 0%,#3a2a0c 45%,#5a4310 100%)' }}
        aria-label="Hero"
      >
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(600px 300px at 85% 20%, rgba(226,165,42,0.35), transparent 70%)' }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 py-16 sm:py-20 lg:py-[88px]">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold text-gold-200 mb-5"
              style={{ background: 'rgba(226,165,42,0.15)', border: '1px solid rgba(226,165,42,0.35)' }}
            >
              Built for African learners
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[66px] leading-[1.05] text-white mb-4">
              Learn the skills that grow your income
            </h1>
            <p className="text-lg leading-relaxed text-white/70 mb-7 max-w-lg">
              Practical courses from local experts — build, market and run real projects. Learn at your own
              pace, on any device, even on a slow connection.
            </p>

            <form
              onSubmit={handleSearch}
              className="flex items-center gap-2 bg-white rounded-[14px] p-1.5 pl-4 max-w-lg shadow-xl"
            >
              <Search size={20} className="text-gray-400 flex-shrink-0" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="What do you want to learn?"
                className="flex-1 min-w-0 border-none outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="bg-primary-500 text-gray-900 hover:bg-primary-400 transition font-semibold rounded-[10px] h-11 px-5 flex-shrink-0"
              >
                Search
              </button>
            </form>

            <div className="flex gap-4 mt-4 flex-wrap">
              {['Web development', 'Digital marketing', 'Data analysis', 'Design'].map((topic) => (
                <span key={topic} className="text-sm text-white/60">{topic}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-canvas-150 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-wrap gap-8 justify-center items-center">
          {trust.map((t) => (
            <div key={t.label} className="flex items-center gap-2.5">
              <t.icon size={18} className="text-primary-700" />
              <span className="text-sm text-gray-600">
                {t.value !== null && <strong className="text-gray-900">{t.value}</strong>} {t.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-[1200px] mx-auto px-6 pt-14 pb-2">
        <div className="flex gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-primary-200 bg-primary-50 text-primary-700 text-sm font-medium">
            All
          </span>
          {Object.entries(CATEGORY_COVERS).map(([name, cover]) => (
            <button
              key={name}
              onClick={() => onNavigate('courses')}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:border-primary-200 hover:text-gray-900 transition whitespace-nowrap"
            >
              <cover.icon size={16} />
              {name}
            </button>
          ))}
        </div>
      </section>

      {/* Featured courses */}
      <section className="max-w-[1200px] mx-auto px-6 pt-7 pb-16 sm:pb-[72px]">
        <div className="flex justify-between items-end mb-6">
          <div>
            <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-primary-700">Most popular</span>
            <h2 className="font-display text-3xl sm:text-4xl mt-1.5 text-gray-900">Featured courses</h2>
          </div>
          <button
            onClick={() => onNavigate('courses')}
            className="hidden sm:flex items-center gap-1.5 text-primary-700 hover:text-primary-800 font-semibold transition"
          >
            View all
            <ArrowRight size={18} />
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
      </section>

      {/* Instructor CTA -- deliberately green (not gold): the design
          system reserves gold for reward/recognition moments, so this
          secondary CTA uses the system's other brand color to read as
          distinct from the primary "Enroll"-style gold actions. */}
      <section className="max-w-[1200px] mx-auto px-6 pb-20">
        <div
          className="rounded-[20px] overflow-hidden p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center"
          style={{ background: 'linear-gradient(120deg,#0F5F3C,#157A4D)' }}
        >
          <div>
            <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-green-200">For instructors</span>
            <h2 className="font-display text-3xl sm:text-4xl text-white mt-2 mb-3">
              Teach what you know. Earn as you grow.
            </h2>
            <p className="text-white/80 max-w-md">
              Publish your first course in an afternoon. We handle hosting, payments and certificates — you
              focus on your students.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <button
              onClick={() => onNavigate(user ? 'become-instructor' : 'courses')}
              className="bg-primary-500 text-gray-900 hover:bg-primary-400 transition font-semibold rounded-[10px] h-12 px-6"
            >
              Become an instructor
            </button>
            <span className="text-sm text-white/70">Free to start · Keep up to 85% of sales</span>
          </div>
        </div>
      </section>

      {/* Why choose -- kept from the previous version (not in the improved
          prototype's Home screen, which folds this into the trust strip
          + instructor CTA above), since it's real, useful content. */}
      <section className="bg-canvas-25 border-t border-canvas-150">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <h2 className="font-display text-3xl text-gray-900 mb-8 text-center">Why choose S@Learn?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { title: 'Learn at your own pace', body: 'Access courses anytime, anywhere' },
              { title: 'Earn certificates', body: 'Get recognized for your achievements' },
              { title: 'Expert instructors', body: 'Learn from industry professionals' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-[14px] border border-canvas-150 p-6 flex items-start gap-3">
                <CheckCircle size={20} className="text-primary-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
