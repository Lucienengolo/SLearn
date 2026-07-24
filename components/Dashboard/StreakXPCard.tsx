import { Flame, Trophy } from 'lucide-react';
import { StudentProgress } from '../../lib/gamification';
import { Totem } from '../../lib/totems';

type StreakXPCardProps = {
  progress: StudentProgress;
  totem: Totem | null;
  onEditTotem: () => void;
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const TIER_NEXT: Record<StudentProgress['tier'], string | null> = {
  Bronze: 'Silver',
  Silver: 'Gold',
  Gold: null,
};

// Product Register (DESIGN.md, 2026-07-24): a 3-card row mirroring the
// Pathfinder reference's Avatar / Streak / League layout, not just an
// icon-tile summary. Founder: "keep my colors" -- accent stays the app's
// own primary-gold (flame/trophy keep their own semantic tints: orange for
// fire, gold for trophy), no new green accent introduced.
export default function StreakXPCard({ progress, totem, onEditTotem }: StreakXPCardProps) {
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
            <p className="text-sm text-gray-500 mb-2">No totem picked yet</p>
          </>
        )}
        <button onClick={onEditTotem} className="text-2xs font-semibold text-primary-700 hover:text-primary-800 transition">
          {totem ? 'Change' : 'Pick a totem'}
        </button>
      </div>

      <div className="rounded-[14px] border border-canvas-150 shadow-sm hover:shadow-md transition-shadow p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-orange-50 text-orange-600 flex-shrink-0">
            <Flame size={18} />
          </span>
          <div>
            <p className="font-display text-xl text-gray-900 leading-none">
              {progress.streakDays} {progress.streakDays === 1 ? 'day' : 'days'}
            </p>
            <p className="text-2xs text-gray-500">Current streak</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1.5" role="img" aria-label={`Activity over the last 7 days, ${progress.streakDays} day current streak`}>
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
          <span className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-primary-50 text-primary-700 flex-shrink-0">
            <Trophy size={18} />
          </span>
          <div>
            <p className="font-display text-xl text-gray-900 leading-none">{progress.tier} League</p>
            <p className="text-2xs text-gray-500">{progress.xp} credits earned</p>
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
              {progress.xpToNextTier} credit{progress.xpToNextTier === 1 ? '' : 's'} to {nextTier}
            </p>
          </>
        ) : (
          <p className="text-2xs text-primary-700 font-medium">Top tier reached</p>
        )}
      </div>
    </div>
  );
}
