import { Flame, Trophy } from 'lucide-react';
import { StudentProgress } from '../../lib/gamification';
import { Totem } from '../../lib/totems';
import IconBadge from '../UI/IconBadge';
import { useLocale } from '../../contexts/LocaleContext';
import type { TranslationKey } from '../../lib/i18n';

type StreakXPCardProps = {
  progress: StudentProgress;
  totem: Totem | null;
  onEditTotem: () => void;
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const TIER_NEXT: Record<StudentProgress['tier'], StudentProgress['tier'] | null> = {
  Bronze: 'Silver',
  Silver: 'Gold',
  Gold: null,
};

const TIER_KEYS: Record<StudentProgress['tier'], TranslationKey> = {
  Bronze: 'dashboard.tier.bronze',
  Silver: 'dashboard.tier.silver',
  Gold: 'dashboard.tier.gold',
};

const TIER_LEAGUE_KEYS: Record<StudentProgress['tier'], TranslationKey> = {
  Bronze: 'dashboard.streak.tierLeague.bronze',
  Silver: 'dashboard.streak.tierLeague.silver',
  Gold: 'dashboard.streak.tierLeague.gold',
};

// Product Register (DESIGN.md, 2026-07-24): a 3-card row mirroring the
// Pathfinder reference's Avatar / Streak / League layout, not just an
// icon-tile summary. Founder: "keep my colors" -- accent stays the app's
// own primary-gold (flame/trophy keep their own semantic tints: orange for
// fire, gold for trophy), no new green accent introduced.
export default function StreakXPCard({ progress, totem, onEditTotem }: StreakXPCardProps) {
  const { t } = useLocale();
  const nextTier = TIER_NEXT[progress.tier];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-[14px] border border-canvas-150 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col items-center text-center">
        {totem ? (
          <>
            <span className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3 ${totem.bgClass}`}>
              {totem.emoji}
            </span>
            <p className="font-display text-base text-gray-900 leading-tight">{totem.name}</p>
            <p className="text-2xs text-gray-500 mb-2">{totem.country}</p>
          </>
        ) : (
          <>
            <span className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3 bg-gray-100 text-gray-400">
              ?
            </span>
            <p className="text-sm text-gray-500 mb-2">{t('dashboard.streak.noTotem')}</p>
          </>
        )}
        <button onClick={onEditTotem} className="text-2xs font-semibold text-primary-700 hover:text-primary-800 transition">
          {totem ? t('dashboard.streak.change') : t('dashboard.streak.pickTotem')}
        </button>
      </div>

      <div className="rounded-[14px] border border-canvas-150 shadow-sm hover:shadow-md transition-shadow p-5">
        <div className="flex items-center gap-2 mb-3">
          <IconBadge icon={Flame} tone="orange" size={36} iconSize={18} shape="square" />
          <div>
            <p className="font-display text-xl text-gray-900 leading-none">
              {progress.streakDays} {t(progress.streakDays === 1 ? 'dashboard.streak.day' : 'dashboard.streak.days')}
            </p>
            <p className="text-2xs text-gray-500">{t('dashboard.streak.currentStreak')}</p>
          </div>
        </div>
        <div
          className="flex items-center justify-between gap-1.5"
          role="img"
          aria-label={`${t('dashboard.streak.activityAria')}, ${progress.streakDays} ${t(progress.streakDays === 1 ? 'dashboard.streak.day' : 'dashboard.streak.days')} ${t('dashboard.streak.currentStreak')}`}
        >
          {progress.last7Days.map((active, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Flame size={16} className={active ? 'text-orange-500' : 'text-gray-200'} />
              <span className="text-2xs text-gray-400">{DAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] border border-canvas-150 shadow-sm hover:shadow-md transition-shadow p-5">
        <div className="flex items-center gap-2 mb-3">
          <IconBadge icon={Trophy} tone="gold" size={36} iconSize={18} shape="square" />
          <div>
            <p className="font-display text-xl text-gray-900 leading-none">{t(TIER_LEAGUE_KEYS[progress.tier])}</p>
            <p className="text-2xs text-gray-500">{progress.xp} {t('dashboard.streak.creditsEarned')}</p>
          </div>
        </div>
        {nextTier ? (
          <>
            <div className="h-2 rounded-full bg-canvas-150 overflow-hidden mb-1.5">
              <div
                className="h-full bg-primary-500 transition-[width] duration-300 ease-out"
                style={{ width: `${progress.tierProgressPct}%` }}
              />
            </div>
            <p className="text-2xs text-gray-500">
              {progress.xpToNextTier} {t(progress.xpToNextTier === 1 ? 'dashboard.streak.creditSingular' : 'dashboard.streak.creditPlural')}{' '}
              {t('dashboard.streak.toTier')} {t(TIER_KEYS[nextTier])}
            </p>
          </>
        ) : (
          <p className="text-2xs text-primary-700 font-medium">{t('dashboard.streak.topTierReached')}</p>
        )}
      </div>
    </div>
  );
}
