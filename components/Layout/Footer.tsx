import { useLocale } from '../../contexts/LocaleContext';
import { TranslationKey } from '../../lib/i18n';

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
//
// Link labels built from `t()` inside the component (not a module-level
// constant) so they re-translate on locale change -- several reuse the
// existing nav.audience.* keys rather than duplicating them.
function buildTopLinks(t: (key: TranslationKey) => string): { label: string; page: string }[] {
  return [
    { label: t('nav.audience.individual'), page: 'home' },
    { label: t('nav.courses'), page: 'courses' },
    { label: t('nav.audience.schools'), page: 'audience-schools' },
    { label: t('nav.audience.business'), page: 'audience-business' },
    { label: t('nav.audience.government'), page: 'audience-government' },
    { label: t('footer.becomeInstructor'), page: 'become-instructor' },
  ];
}

function buildColumns(t: (key: TranslationKey) => string): FooterColumn[] {
  return [
    {
      title: t('footer.columns.learners.title'),
      links: [
        { label: t('footer.columns.learners.browse'), page: 'courses' },
        { label: t('footer.columns.learners.findTutor'), page: 'my-requests' },
        { label: t('footer.columns.learners.certificates'), page: 'certificates' },
      ],
    },
    {
      title: t('footer.columns.educators.title'),
      links: [{ label: t('footer.becomeInstructor'), page: 'become-instructor' }],
    },
    {
      title: t('footer.columns.organizations.title'),
      links: [
        { label: t('nav.audience.schools'), page: 'audience-schools' },
        { label: t('nav.audience.business'), page: 'audience-business' },
        { label: t('nav.audience.government'), page: 'audience-government' },
      ],
    },
  ];
}

export default function Footer({ onNavigate }: FooterProps) {
  const { t } = useLocale();
  const topLinks = buildTopLinks(t);
  const columns = buildColumns(t);

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
            {topLinks.map((link) => (
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 py-10">
          {columns.map((col) => (
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
          <p>{t('footer.disclaimer')}</p>
          <p>&copy; {new Date().getFullYear()} {t('footer.copyrightSuffix')}</p>
        </div>
      </div>
    </footer>
  );
}
