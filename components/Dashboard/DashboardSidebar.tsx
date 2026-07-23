import { LayoutDashboard, MessageCircle, Award, User } from 'lucide-react';

type DashboardSidebarProps = {
  current: 'dashboard' | 'my-requests' | 'certificates' | 'account-settings';
  onNavigate: (page: string) => void;
};

// Pathfinder-style dashboard IA (DESIGN.md Patterns, 2026-07-23) -- a
// persistent left nav to pages that already exist (My Requests,
// Certificates, Account Settings are all real top-level routes reached
// today via the header/account menu). Deliberately just shortcuts to the
// SAME pages, not a parallel/duplicated IA -- styled in the old gray/primary
// token system already used throughout StudentDashboard, not the newer
// ink-and-paper tokens, to stay visually consistent within this one screen.
const ITEMS = [
  { page: 'dashboard' as const, label: 'Dashboard', Icon: LayoutDashboard },
  { page: 'my-requests' as const, label: 'My Requests', Icon: MessageCircle },
  { page: 'certificates' as const, label: 'Certificates', Icon: Award },
  { page: 'account-settings' as const, label: 'Profile', Icon: User },
];

export default function DashboardSidebar({ current, onNavigate }: DashboardSidebarProps) {
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible" aria-label="Dashboard">
      {ITEMS.map(({ page, label, Icon }) => {
        const isActive = current === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-sm font-medium whitespace-nowrap transition ${
              isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
