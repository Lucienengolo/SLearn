import { useLocale } from '../../contexts/LocaleContext';

type AudienceNavProps = {
  onNavigate: (page: string) => void;
  currentPage: string;
};

// DESIGN.md "Patterns" (2026-07-23): thin audience-track utility bar above
// the main header. Exactly 4 tabs -- "Individual" covers the existing
// parent/student/tutor experience as one track (no separate Parents/Tutors
// split), matching how Coursera treats "For Individuals". Ink-and-paper
// only: no pills, no icons, the only accent is the Oxblood underline on the
// active tab.
const TABS = [
  { page: 'home', key: 'nav.audience.individual' as const, isIndividual: true },
  { page: 'audience-schools', key: 'nav.audience.schools' as const },
  { page: 'audience-business', key: 'nav.audience.business' as const },
  { page: 'audience-government', key: 'nav.audience.government' as const },
];

export default function AudienceNav({ onNavigate, currentPage }: AudienceNavProps) {
  const { t } = useLocale();

  return (
    <div className="bg-paper border-b border-ink-border">
      <div className="max-w-[1200px] mx-auto px-6">
        <nav className="flex items-center gap-5 overflow-x-auto" aria-label="Audience">
          {TABS.map((tab) => {
            const isActive = tab.isIndividual
              ? currentPage !== 'audience-schools' && currentPage !== 'audience-business' && currentPage !== 'audience-government'
              : currentPage === tab.page;
            return (
              <button
                key={tab.page}
                onClick={() => onNavigate(tab.page)}
                aria-current={isActive ? 'page' : undefined}
                className={`whitespace-nowrap text-[11px] font-plex-mono uppercase tracking-wide py-2 border-b-2 transition-colors ${
                  isActive
                    ? 'border-oxblood text-ink'
                    : 'border-transparent text-warm-gray hover:text-ink'
                }`}
              >
                {t(tab.key)}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
