import { useState, useEffect } from 'react';
import { BookOpen, Users, Award, Wifi, ArrowRight, CheckCircle, GraduationCap, MessageCircle, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0, totalInstructors: 0 });
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    fetchStats();
    fetchTestimonials();
  }, []);

  const fetchStats = async () => {
    const [{ count: coursesCount }, { count: studentsCount }, { count: instructorsCount }] = await Promise.all([
      supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'instructor'),
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
      title: 'Practical courses',
      body: 'Learn real, income-generating skills from local experts — at your own pace, on any device.',
    },
    {
      icon: MessageCircle,
      title: 'Verified tutors',
      body: "Book a vetted, identity-checked tutor for your child, matched to your neighborhood and budget.",
    },
    {
      icon: Award,
      title: 'Real certificates',
      body: 'Finish a course, pass the final exam, and earn a certificate that proves what you actually learned.',
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
            Built for African learners
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[64px] leading-[1.05] text-white mb-5 max-w-3xl mx-auto">
            One platform to learn, teach, and get tutored — built for how you actually connect
          </h1>
          <p className="text-lg leading-relaxed text-white/70 mb-8 max-w-xl mx-auto">
            Practical courses from local experts, a marketplace to book verified tutors, and certificates that
            mean something. Works on any device, even on a slow connection.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 bg-primary-500 text-gray-900 shadow-md hover:shadow-lg hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold rounded-full h-12 px-6"
            >
              Get started free
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => onNavigate('courses')}
              className="bg-white/10 text-white border border-white/25 hover:bg-white/15 transition font-semibold rounded-full h-12 px-6"
            >
              Browse courses
            </button>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-canvas-150 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-wrap gap-8 justify-center items-center">
          {[
            { icon: BookOpen, value: stats.totalCourses, label: 'courses' },
            { icon: Users, value: stats.totalStudents, label: 'learners' },
            { icon: GraduationCap, value: stats.totalInstructors, label: 'expert instructors' },
            { icon: Wifi, value: null, label: 'Low-data friendly' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-2.5">
              <t.icon size={18} className="text-primary-700" />
              <span className="text-sm text-gray-600">
                {t.value !== null && <strong className="text-gray-900">{t.value}</strong>} {t.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* What we do */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-primary-700">What we do</span>
          <h2 className="font-display text-3xl sm:text-4xl mt-1.5 text-gray-900">Everything to learn and grow</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-[14px] border border-canvas-150 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform]"
            >
              <span className="w-11 h-11 rounded-[10px] bg-primary-50 text-primary-700 flex items-center justify-center mb-4">
                <p.icon size={22} />
              </span>
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
                From real students
              </span>
              <h2 className="font-display text-3xl sm:text-4xl mt-1.5 text-gray-900">What learners are saying</h2>
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
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">&ldquo;{review.comment}&rdquo;</p>
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
          <span className="text-2xs font-semibold tracking-[0.08em] uppercase text-primary-700">Our vision</span>
          <h2 className="font-display text-3xl sm:text-4xl mt-1.5 mb-4 text-gray-900">World-class, built for us</h2>
          <p className="text-gray-600 leading-relaxed">
            Not a stripped-down version of a Western product — a genuinely polished platform designed around how
            African learners actually connect: local currency, local exam systems, tutors your family can trust,
            and a product that works even on a slow connection.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-[1200px] mx-auto px-6 pb-20">
        <div
          className="rounded-[20px] overflow-hidden p-8 sm:p-12 text-center shadow-lg hover:shadow-xl transition-shadow"
          style={{ background: 'linear-gradient(120deg,#0F5F3C,#157A4D)' }}
        >
          <h2 className="font-display text-3xl sm:text-4xl text-white mb-3">Ready to get started?</h2>
          <p className="text-white/80 max-w-md mx-auto mb-6">
            Join for free — browse courses as a guest, or create an account to save progress, book tutors, and
            earn certificates.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="bg-primary-500 text-gray-900 shadow-sm hover:shadow-md hover:bg-primary-400 hover:-translate-y-0.5 transition-[box-shadow,transform,background-color] font-semibold rounded-full h-12 px-6"
            >
              Create free account
            </button>
            <button
              onClick={() => onNavigate('courses')}
              className="bg-white/10 text-white border border-white/25 hover:bg-white/15 transition font-semibold rounded-full h-12 px-6 flex items-center gap-2"
            >
              Browse courses
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Minimal footer -- no footer existed anywhere in the app before
          this; scoped to the landing page only for now rather than
          retrofitting every other page. */}
      <footer className="border-t border-canvas-150 py-8">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle size={14} className="text-primary-700" />
            S@Learn — Store of Learning
          </span>
          <span>&copy; {new Date().getFullYear()} S@Learn. Built in Douala, Cameroon.</span>
        </div>
      </footer>
    </div>
  );
}
