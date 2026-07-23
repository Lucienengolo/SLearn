import { StudentProgress } from '../../lib/gamification';

type StreakXPCardProps = {
  progress: StudentProgress;
};

const TICK_COUNT = 7;

// DESIGN.md "Patterns" (2026-07-23): gamification re-skinned into
// ink-and-paper -- square Oxblood ticks (not fire emoji), a plain IBM Plex
// Mono XP number labeled "credits earned" (not a lightning-bolt stat card),
// and a typographic tier label (not a 3D badge icon). No animation beyond
// what DESIGN.md's Motion section already allows.
export default function StreakXPCard({ progress }: StreakXPCardProps) {
  const filledTicks = Math.min(progress.streakDays, TICK_COUNT);

  return (
    <div className="bg-white border border-ink-border rounded-lg p-6 font-general-sans text-ink">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-plex-mono uppercase tracking-wide text-warm-gray mb-2">Streak</p>
          <div className="flex items-center gap-1.5 mb-2" role="img" aria-label={`${progress.streakDays} day streak`}>
            {Array.from({ length: TICK_COUNT }, (_, i) => (
              <span
                key={i}
                className={`w-3.5 h-3.5 rounded-sm ${i < filledTicks ? 'bg-oxblood' : 'bg-ink-border'}`}
              />
            ))}
          </div>
          <p className="text-[15px] font-medium">
            {progress.streakDays} {progress.streakDays === 1 ? 'day' : 'days'}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-plex-mono uppercase tracking-wide text-warm-gray mb-2">Credits earned</p>
          <p className="font-plex-mono text-[28px] leading-none mb-2">{progress.xp}</p>
          <p className="text-[13px] font-plex-mono uppercase tracking-wide text-forest">{progress.tier}</p>
        </div>
      </div>
    </div>
  );
}
