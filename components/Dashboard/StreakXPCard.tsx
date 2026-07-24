import { Flame, Zap, Trophy } from 'lucide-react';
import { StudentProgress } from '../../lib/gamification';

type StreakXPCardProps = {
  progress: StudentProgress;
};

const TIER_TINT: Record<StudentProgress['tier'], string> = {
  Bronze: 'bg-orange-50 text-orange-700',
  Silver: 'bg-gray-100 text-gray-600',
  Gold: 'bg-primary-50 text-primary-700',
};

// DESIGN.md "Product Register" (2026-07-24): reverses the 2026-07-23
// icon-free/typographic-only decision -- founder wants dashboards to feel
// modern like the W3Schools reference, not restrained like the booking-flow
// Editorial register. Real icons + elevation, matching StudentDashboard's
// existing stat-tile visual language (same tint-circle + font-display
// number pattern), not a new ink-and-paper card dropped into an old-token
// page.
export default function StreakXPCard({ progress }: StreakXPCardProps) {
  const tiles = [
    {
      Icon: Flame,
      value: progress.streakDays,
      label: progress.streakDays === 1 ? 'day streak' : 'day streak',
      tint: 'bg-orange-50 text-orange-600',
    },
    {
      Icon: Zap,
      value: progress.xp,
      label: 'credits earned',
      tint: 'bg-primary-50 text-primary-700',
    },
  ];

  return (
    <div className="rounded-[14px] border border-canvas-150 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="grid grid-cols-3 gap-4 items-center">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex items-center gap-3">
            <span className={`w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 ${tile.tint}`}>
              <tile.Icon size={20} />
            </span>
            <div>
              <p className="font-display text-2xl text-gray-900 leading-none">{tile.value}</p>
              <p className="text-2xs text-gray-500 mt-0.5">{tile.label}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <span className={`w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 ${TIER_TINT[progress.tier]}`}>
            <Trophy size={20} />
          </span>
          <div>
            <p className="font-display text-lg text-gray-900 leading-none">{progress.tier}</p>
            <p className="text-2xs text-gray-500 mt-0.5">league</p>
          </div>
        </div>
      </div>
    </div>
  );
}
