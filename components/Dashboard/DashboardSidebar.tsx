import { LayoutDashboard, MessageCircle, Award, User } from 'lucide-react';
import { Totem } from '../../lib/totems';
import { StudentProgressTier } from '../../lib/gamification';

type DashboardSidebarProps = {
  current: 'dashboard' | 'my-requests' | 'certificates' | 'account-settings';
  onNavigate: (page: string) => void;
  fullName?: string | null;
  totem?: Totem | null;
  tier?: StudentProgressTier | null;
};

// Pathfinder-style dashboard IA (DESIGN.md Patterns, 2026-07-23; Product
// Register "pushed further" pass, 2026-07-24). Green is the active/hover
// accent here to match the reference's actual sidebar look, and a small
// profile header (totem + name + tier pill) sits above the nav items,
// mirroring Pathfinder's avatar+name+"Free" card -- still a shortcut nav to
// pages that already exist, not a parallel IA.
const ITEMS = [
  { page: 'dashboard' as const, label: 'Dashboard', Icon: LayoutDashboard },
  { page: 'my-requests' as const, label: 'My Requests', Icon: MessageCircle },
  { page: 'certificates' as const, label: 'Certificates', Icon: Award },
  { page: 'account-settings' as const, label: 'Profile', Icon: User },
];

export default function DashboardSidebar({ current, onNavigate, fullName, totem, tier }: DashboardSidebarProps) {
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
            <p className="font-medium text-sm text-gray-900 truncate">{fullName ?? 'Student'}</p>
            {tier && (
              <span className="inline-block text-2xs font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 mt-0.5">
                {tier}
              </span>
            )}
          </div>
        </div>
      )}

      <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible" aria-label="Dashboard">
        {ITEMS.map(({ page, label, Icon }) => {
          const isActive = current === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium whitespace-nowrap transition ${
                isActive ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
