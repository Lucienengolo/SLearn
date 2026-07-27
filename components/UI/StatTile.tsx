import { LucideIcon } from 'lucide-react';
import { ICON_BADGE_GRADIENTS, IconBadgeTone } from '../../lib/iconBadgeTones';

export type StatTileTone = Exclude<IconBadgeTone, 'red'>;

type StatTileProps = {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone: StatTileTone;
};

// Gradient + soft shadow + a semi-filled icon (duotone-ish via fillOpacity)
// instead of a flat single-tint background -- founder wanted more
// "realistic" icon treatment platform-wide; a true 3D/illustrated icon set
// needs external art this environment can't produce, so this reaches for
// the same effect with what lucide-react + CSS can actually do. Shares its
// gradient palette with the more general-purpose IconBadge.tsx.
export default function StatTile({ icon: Icon, value, label, tone }: StatTileProps) {
  return (
    <div className="rounded-[14px] border border-canvas-150 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform]">
      <span
        className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-3 shadow-sm"
        style={{ background: ICON_BADGE_GRADIENTS[tone] }}
      >
        <Icon size={20} className="text-white" fill="currentColor" fillOpacity={0.25} />
      </span>
      <div className="font-display text-3xl text-gray-900 leading-none">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
