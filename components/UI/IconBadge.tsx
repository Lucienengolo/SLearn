import { LucideIcon } from 'lucide-react';
import { ICON_BADGE_GRADIENTS, IconBadgeTone } from '../../lib/iconBadgeTones';

type IconBadgeProps = {
  icon: LucideIcon;
  tone: IconBadgeTone;
  size?: number;
  iconSize?: number;
  shape?: 'circle' | 'square';
  className?: string;
};

// Gradient + soft shadow + a semi-filled icon instead of a flat single-tint
// background -- the same treatment StatTile.tsx uses for stat tiles,
// factored out for the many one-off icon badges scattered across the app
// (avatar fallbacks, dialog icons, result icons, section headers, ...).
export default function IconBadge({ icon: Icon, tone, size = 36, iconSize, shape = 'circle', className = '' }: IconBadgeProps) {
  return (
    <span
      className={`flex items-center justify-center shadow-sm flex-shrink-0 ${shape === 'circle' ? 'rounded-full' : 'rounded-[10px]'} ${className}`}
      style={{ width: size, height: size, background: ICON_BADGE_GRADIENTS[tone] }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.5)} className="text-white" fill="currentColor" fillOpacity={0.25} />
    </span>
  );
}
