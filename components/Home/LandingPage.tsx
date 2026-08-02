import { useState, useEffect } from 'react';
import { BookOpen, Users, Award, Wifi, ArrowRight, GraduationCap, MessageCircle, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLocale } from '../../contexts/LocaleContext';
import { renderRichText } from '../../lib/richText';
import IconBadge from '../UI/IconBadge';

type LandingPageProps = {
  onNavigate: (page: string) => void;
  onGetStarted: () => void;
};

type Testimonial = {
  id: string;
  rating: number;
  comment: string;
  studentName: string;
  courseTitle: string;
};

// New marketing landing page (founder feedback, 2026-07-22 item #8; built
// 2026-07-24). Shown to logged-out visitors at "home" -- signed-in users
// still land on the course browser (App.tsx routing), so this doesn't
// disrupt the existing product experience, only adds a real first
// impression for someone who's never seen the platform.
export default function LandingPage({ onNavigate, onGetStarted }: LandingPageProps) {
  const { t } = useLocale();
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0, totalInstructors: 0 });
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    fetchStats();
    fetchTestimonials();
  }, []);

  const fetchStats = async () => {
    const [{ count: coursesCount }, { count: studentsCount }, { count: instructorsCount }] = await Promise.all([
      supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'instructor'),
    ]);
    setStats({
      totalCourses: coursesCount ?? 0,
      totalStudents: studentsCount ?? 0,
      totalInstructors: instructorsCount ?? 0,
    });
  };

  // Real student reviews, not fabricated marketing quotes -- rating >= 4
  // and a written comment, most recent first. Honest social proof: if
  // there aren't any yet, the section just doesn't render (see below),
  // rather than shipping placeholder quotes.
  const fetchTestimonials = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, comment, student:profiles!student_id(full_name), course:courses(title)')
      .gte('rating', 4)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);

    if (data) {
      setTestimonials(
        (data as unknown as { id: string; rating: number; comment: string; student: { full_name: string } | null; course: { title: string } | null }[])
          .filter((r) => r.comment)
          .map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            studentName: r.student?.full_name ?? 'S@Learn student',
            courseTitle: r.course?.title ?? '',
          }))
      );
    }
  };

  const pillars = [
    {
      icon: BookOpen,
      title: t('landing.pillars.courses.title'),
      body: t('landing.pillars.courses.body'),
      tone: 'gold' as const,
    },
    {
      icon: MessageCircle,
      title: t('landing.pillars.tutors.title'),
      body: t('landing.pillars.tutors.body'),
      tone: 'blue' as const,
    },
    {
      icon: Award,
      title: t('landing.pillars.certificates.title'),
      body: t('landing.pillars.certificates.body'),
      tone: 'green' as const,
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1b1205 0%,#3a2a0c 45%,#5a4310 100%)' }}
        aria-label="Hero"
      >
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(600px 300px at 85% 20%, rgba(226,165,42,0.35), transparent 70%)' }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 py-20 sm:py-24 lg:py-28 text-center">
          <span
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold text-gold-200 mb-6"
            style={{ background: 'rgba(226,165,42,0.15)', border: '1px solid rgba(226,165,42,0.35)' }}
          >
            {t('common.builtForLearners')}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[64px] leading-[1.05] text-white mb-5 max-w-3xl mx-auto">
            {t('landing.hero.title')}
          </h1>
          <p className="text-lg leading-relaxed text-white/70 mb-8 max-w-xl mx-auto">
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 bg-primary-500 text-gray-900 shadow-md hover:shadow-lg hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold rounded-full h-12 px-6"
            >
              {t('landing.hero.getStarted')}
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => onNavigate('courses')}
              className="bg-white/10 text-white border border-white/25 hover:bg-white/15 transition font-semibold rounded-full h-12 px-6"
            >
              {t('common.browseCourses')}
            </button>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-canvas-150 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-wrap gap-8 justify-center items-center">
          {[
            { icon: BookOpen, value: stats.totalCourses, label: t('common.trust.courses') },
            { icon: Users, value: stats.totalStudents, label: t('common.trust.learners') },
            { icon: GraduationCap, value: stats.totalInstructors, label: t('common.trust.instructors') },
            { icon: Wifi, value: null, label: t('common.trust.lowData') },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <item.icon size={18} className="text-primary-700" />
              <span className="text-sm text-gray-600">
                {item.value !== null && <strong className="text-gray-900">{item.value}</strong>} {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* What we do */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-primary-700">{t('landing.whatWeDo.eyebrow')}</span>
          <h2 className="font-display text-3xl sm:text-4xl mt-1.5 text-gray-900">{t('landing.whatWeDo.title')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-[14px] border border-canvas-150 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform]"
            >
              <IconBadge icon={p.icon} tone={p.tone} size={44} iconSize={22} shape="square" className="mb-4" />
              <h3 className="font-semibold text-lg text-gray-900 mb-1.5">{p.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials -- real reviews only; section omits itself if there
          are none yet, rather than shipping fabricated quotes. */}
      {testimonials.length > 0 && (
        <section className="bg-canvas-25 border-y border-canvas-150">
          <div className="max-w-[1200px] mx-auto px-6 py-16 sm:py-20">
            <div className="text-center mb-10">
              <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-primary-700">
                {t('landing.testimonials.eyebrow')}
              </span>
              <h2 className="font-display text-3xl sm:text-4xl mt-1.5 text-gray-900">{t('landing.testimonials.title')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {testimonials.map((review) => (
                <div key={review.id} className="bg-white rounded-[14px] border border-canvas-150 p-6 shadow-sm">
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < review.rating ? 'fill-primary-500 text-primary-500' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed mb-4">&ldquo;{renderRichText(review.comment)}&rdquo;</div>
                  <p className="text-sm font-semibold text-gray-900">{review.studentName}</p>
                  {review.courseTitle && <p className="text-2xs text-gray-500">{review.courseTitle}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Vision */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 sm:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-primary-700">{t('landing.vision.eyebrow')}</span>
          <h2 className="font-display text-3xl sm:text-4xl mt-1.5 mb-4 text-gray-900">{t('landing.vision.title')}</h2>
          <p className="text-gray-600 leading-relaxed">
            {t('landing.vision.body')}
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-[1200px] mx-auto px-6 pb-20">
        <div
          className="rounded-[20px] overflow-hidden p-8 sm:p-12 text-center shadow-lg hover:shadow-xl transition-shadow"
          style={{ background: 'linear-gradient(120deg,#0F5F3C,#157A4D)' }}
        >
          <h2 className="font-display text-3xl sm:text-4xl text-white mb-3">{t('landing.finalCta.title')}</h2>
          <p className="text-white/80 max-w-md mx-auto mb-6">
            {t('landing.finalCta.body')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="bg-primary-500 text-gray-900 shadow-sm hover:shadow-md hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold rounded-full h-12 px-6"
            >
              {t('landing.finalCta.button')}
            </button>
            <button
              onClick={() => onNavigate('courses')}
              className="bg-white/10 text-white border border-white/25 hover:bg-white/15 transition font-semibold rounded-full h-12 px-6 flex items-center gap-2"
            >
              {t('common.browseCourses')}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
