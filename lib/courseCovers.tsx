import { Code, Megaphone, BarChart3, Palette, Briefcase, BookOpen, LucideIcon } from 'lucide-react';

// Per-category gradient + icon covers, replacing the identical
// emoji-on-gradient course thumbnails (Design Review finding: "every
// course showed the same 50%-opacity book emoji"). Matches the category
// seed data in 0001_core_schema.sql and the improved/*.dc.html prototypes'
// `covers` mapping.
const COVERS: Record<string, { gradient: string; icon: LucideIcon }> = {
  'Web Development': { gradient: 'linear-gradient(135deg,#3C413A,#181B16)', icon: Code },
  Marketing: { gradient: 'linear-gradient(135deg,#157A4D,#0A4329)', icon: Megaphone },
  'Data Science': { gradient: 'linear-gradient(135deg,#2D6FE0,#1B4FA8)', icon: BarChart3 },
  Design: { gradient: 'linear-gradient(135deg,#C8881C,#835611)', icon: Palette },
  Business: { gradient: 'linear-gradient(135deg,#555B51,#262A24)', icon: Briefcase },
};

const FALLBACK = { gradient: 'linear-gradient(135deg,#3C413A,#181B16)', icon: BookOpen };

export function getCourseCover(categoryName?: string | null): { gradient: string; icon: LucideIcon } {
  return (categoryName && COVERS[categoryName]) || FALLBACK;
}
