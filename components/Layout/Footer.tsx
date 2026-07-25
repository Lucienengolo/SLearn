type FooterProps = {
  onNavigate: (page: string) => void;
};

type FooterColumn = {
  title: string;
  links: { label: string; page: string }[];
};

// Global footer (founder request, 2026-07-24), structured after the
// reference screenshot: dark contrast band, logo + top nav-header row,
// multi-column link grid, disclaimer, copyright. Every link routes
// somewhere real -- no fabricated Terms/Privacy/social pages, since none
// exist yet (regulatory/compliance is still an explicit P3 "let's talk
// first" item, not something to fake with dead links).
const TOP_LINKS: { label: string; page: string }[] = [
  { label: 'Individuals', page: 'home' },
  { label: 'Courses', page: 'courses' },
  { label: 'Schools & Universities', page: 'audience-schools' },
  { label: 'Business', page: 'audience-business' },
  { label: 'Government', page: 'audience-government' },
  { label: 'Become an Instructor', page: 'become-instructor' },
];

const COLUMNS: FooterColumn[] = [
  {
    title: 'For Learners',
    links: [
      { label: 'Browse courses', page: 'courses' },
      { label: 'Find a tutor', page: 'my-requests' },
      { label: 'My certificates', page: 'certificates' },
    ],
  },
  {
    title: 'For Educators',
    links: [{ label: 'Become an instructor', page: 'become-instructor' }],
  },
  {
    title: 'For Organizations',
    links: [
      { label: 'Schools & Universities', page: 'audience-schools' },
      { label: 'Business', page: 'audience-business' },
      { label: 'Government', page: 'audience-government' },
    ],
  },
];

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6 pb-10 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <img src="/3D_S-Logo-removebg.png" alt="S@Learn logo" className="h-8 w-auto" />
            <span className="text-lg font-bold text-white">
              <span className="text-primary-400">@</span>Learn
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer audience links">
            {TOP_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => onNavigate(link.page)}
                className="text-sm font-semibold text-primary-400 hover:text-primary-300 transition uppercase tracking-wide"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-10">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-white font-semibold mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => onNavigate(link.page)}
                      className="text-sm text-gray-400 hover:text-white transition"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/10 text-2xs text-gray-500 space-y-3">
          <p>
            S@Learn connects learners with independent instructors and tutors. Course content and tutor
            availability are provided by individual instructors; verification status is shown where available.
          </p>
          <p>&copy; {new Date().getFullYear()} S@Learn — Store of Learning. Built in Douala, Cameroon.</p>
        </div>
      </div>
    </footer>
  );
}
