// Shared gradient palette for the icon-badge treatment (founder request,
// 2026-07-27: "use more realistic icons... on every component"). One
// source of truth so StatTile and IconBadge don't drift into slightly
// different hex values for the same "gold"/"green"/etc tone.
export type IconBadgeTone = 'gold' | 'green' | 'blue' | 'gray' | 'red' | 'orange';

export const ICON_BADGE_GRADIENTS: Record<IconBadgeTone, string> = {
  gold: 'linear-gradient(135deg,#F2C94C,#C8881C)',
  green: 'linear-gradient(135deg,#4ADE80,#15803D)',
  blue: 'linear-gradient(135deg,#60A5FA,#1D4ED8)',
  gray: 'linear-gradient(135deg,#9CA3AF,#4B5563)',
  red: 'linear-gradient(135deg,#F87171,#B91C1C)',
  // Kept distinct from `gold` on purpose -- StreakXPCard's flame vs trophy
  // badges are deliberately different semantic tints (fire vs trophy),
  // per the founder's explicit "keep my colors" note (DESIGN.md 2026-07-24).
  orange: 'linear-gradient(135deg,#FB923C,#C2410C)',
};
