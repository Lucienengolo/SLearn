import { LayoutDashboard, MessageCircle, Award, User, TrendingUp, Trophy, GraduationCap } from 'lucide-react';
import { Totem } from '../../lib/totems';
import { StudentProgressTier } from '../../lib/gamification';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type DashboardSidebarProps = {
  current: 'dashboard' | 'my-progress' | 'league' | 'my-requests' | 'certificates' | 'account-settings';
  onNavigate: (page: string) => void;
  fullName?: string | null;
  totem?: Totem | null;
  tier?: StudentProgressTier | null;
  // Defaults to 'student' -- AccountSettings.tsx is shared by both roles,
  // and "My Requests"/"Certificates" are student-only concepts (an
  // instructor account, being single-role, never has personal enrollments
  // or tutor requests of its own).
  role?: 'student' | 'instructor';
};

// Pathfinder-style dashboard IA (DESIGN.md Patterns, 2026-07-23; Product
// Register pass, 2026-07-24). Founder: "keep my colors" -- active/hover
// accent stays the app's own primary-gold, not a new green accent. A small
// profile header (totem + name + tier pill) sits above the nav items,
// mirroring Pathfinder's avatar+name+"Free" card -- still a shortcut nav to
// pages that already exist, not a parallel IA.
const TIER_KEYS: Record<string, TranslationKey> = {
  Bronze: 'dashboard.tier.bronze',
  Silver: 'dashboard.tier.silver',
  Gold: 'dashboard.tier.gold',
};

const STUDENT_ITEMS = [
  { page: 'dashboard' as const, labelKey: 'nav.dashboard' as TranslationKey, Icon: LayoutDashboard },
  { page: 'my-progress' as const, labelKey: 'dashboard.sidebar.myProgress' as TranslationKey, Icon: TrendingUp },
  { page: 'league' as const, labelKey: 'dashboard.sidebar.league' as TranslationKey, Icon: Trophy },
  { page: 'my-requests' as const, labelKey: 'dashboard.sidebar.myRequests' as TranslationKey, Icon: MessageCircle },
  { page: 'certificates' as const, labelKey: 'dashboard.sidebar.certificates' as TranslationKey, Icon: Award },
  { page: 'account-settings' as const, labelKey: 'dashboard.sidebar.profile' as TranslationKey, Icon: User },
  { page: 'become-instructor' as const, labelKey: 'dashboard.sidebar.forTeachers' as TranslationKey, Icon: GraduationCap },
];

const INSTRUCTOR_ITEMS = [
  { page: 'dashboard' as const, labelKey: 'nav.dashboard' as TranslationKey, Icon: LayoutDashboard },
  { page: 'account-settings' as const, labelKey: 'dashboard.sidebar.profile' as TranslationKey, Icon: User },
];

export default function DashboardSidebar({ current, onNavigate, fullName, totem, tier, role = 'student' }: DashboardSidebarProps) {
  const { t } = useLocale();
  const items = role === 'instructor' ? INSTRUCTOR_ITEMS : STUDENT_ITEMS;

  return (
    <div className="flex lg:flex-col gap-4">
      {(fullName || totem || tier) && (
        <div className="hidden lg:flex items-center gap-3 rounded-[14px] border border-canvas-150 p-4 shadow-sm">
          <span
            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${totem?.bgClass ?? 'bg-gray-100'}`}
          >
            {totem?.emoji ?? <User size={18} className="text-gray-400" />}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">{fullName ?? t('dashboard.sidebar.studentFallback')}</p>
            {tier && (
              <span className="inline-block text-2xs font-semibold px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 mt-0.5">
                {t(TIER_KEYS[tier] ?? 'dashboard.tier.bronze')}
              </span>
            )}
          </div>
        </div>
      )}

      <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible" aria-label={t('nav.dashboard')}>
        {items.map(({ page, labelKey, Icon }) => {
          const isActive = current === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium whitespace-nowrap transition ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={17} />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
