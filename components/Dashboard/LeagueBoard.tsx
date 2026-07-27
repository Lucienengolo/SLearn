import { Trophy, User } from 'lucide-react';
import { LeagueRow } from '../../lib/league';
import { totemByName } from '../../lib/totems';

type LeagueBoardProps = {
  rows: LeagueRow[];
  emptyMessage: string;
};

// Top-3 get a gradient medal instead of a flat tint -- a small, real "gold/
// silver/bronze" cue, not just a color swap.
const MEDAL_GRADIENT: Record<number, string> = {
  1: 'linear-gradient(135deg,#F2C94C,#C8881C)',
  2: 'linear-gradient(135deg,#D1D5DB,#6B7280)',
  3: 'linear-gradient(135deg,#D9A066,#8B5A2B)',
};

export default function LeagueBoard({ rows, emptyMessage }: LeagueBoardProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-canvas-150 p-12 text-center">
        <Trophy size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-canvas-150 overflow-hidden shadow-sm">
      {rows.map((row, index) => {
        const totem = totemByName(row.totem);
        const isLast = index === rows.length - 1;
        return (
          <div
            key={row.studentId}
            className={`flex items-center gap-4 px-5 py-3.5 ${!isLast ? 'border-b border-canvas-150' : ''} ${
              row.isMe ? 'bg-primary-50' : ''
            }`}
          >
            <span
              className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                MEDAL_GRADIENT[row.rank] ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500'
              }`}
              style={MEDAL_GRADIENT[row.rank] ? { background: MEDAL_GRADIENT[row.rank] } : undefined}
            >
              {row.rank}
            </span>
            <span
              className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-lg ${totem?.bgClass ?? 'bg-gray-100'}`}
            >
              {totem?.emoji ?? <User size={16} className="text-gray-400" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${row.isMe ? 'font-semibold text-primary-700' : 'font-medium text-gray-900'}`}>
                {row.fullName ?? 'Student'}
                {row.isMe && <span className="ml-1.5 text-2xs font-semibold text-primary-600">(You)</span>}
              </p>
            </div>
            <span className="text-sm font-semibold text-gray-600 flex-shrink-0">{row.xp} XP</span>
          </div>
        );
      })}
    </div>
  );
}
