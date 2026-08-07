import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authContext from '../contexts/AuthContext';
import * as notificationsLib from '../lib/notifications';
import { LocaleProvider } from '../contexts/LocaleContext';
import Header from '../components/Layout/Header';

function renderHeader(currentPage: string) {
  return render(
    <LocaleProvider>
      <Header
        onNavigate={vi.fn()}
        currentPage={currentPage}
        authModalOpen={false}
        authModalMode="login"
        onOpenAuthModal={vi.fn()}
        onCloseAuthModal={vi.fn()}
      />
    </LocaleProvider>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      signOut: vi.fn(),
    } as never);
  });

  it('shows the plain wordmark on non-institutional pages', () => {
    renderHeader('home');
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('reflects the Government track in the wordmark', () => {
    renderHeader('audience-government');
    expect(screen.getByText('· Government')).toBeInTheDocument();
  });

  it('reflects the Business track in the wordmark', () => {
    renderHeader('audience-business');
    expect(screen.getByText('· Business')).toBeInTheDocument();
  });

  it('reflects the Schools & Universities track in the wordmark', () => {
    renderHeader('audience-schools');
    expect(screen.getByText('· Schools & Universities')).toBeInTheDocument();
  });

  it('sticks the audience nav and header together in one wrapper', () => {
    const { container } = renderHeader('home');
    const stickyWrapper = container.querySelector('.sticky.top-0');
    expect(stickyWrapper).toBeInTheDocument();
    expect(stickyWrapper?.querySelector('nav[aria-label="Audience"]')).toBeInTheDocument();
    expect(stickyWrapper?.querySelector('header')).toBeInTheDocument();
  });

  // Regression: at landscape-phone/tablet widths (roughly 768-1024px) the
  // full desktop nav (5 links + the whole profile/actions cluster) doesn't
  // actually fit, and used to render with the wordmark and nav visibly
  // overlapping instead of falling back to the hamburger menu. Confirmed via
  // 2 screenshots. The fix moved the breakpoint from md (768px) to lg
  // (1024px) -- this locks in that neither the desktop nav's own container
  // nor the mobile hamburger button use the narrower `md:` breakpoint.
  it('shows the desktop nav and hides the hamburger only from the lg breakpoint up, not md', () => {
    const { container } = renderHeader('home');
    expect(container.querySelector('nav.hidden.lg\\:flex')).toBeInTheDocument();
    expect(container.querySelector('nav.hidden.md\\:flex')).not.toBeInTheDocument();
    expect(container.querySelector('button.lg\\:hidden[aria-label]')).toBeInTheDocument();
    expect(container.querySelector('button.md\\:hidden[aria-label]')).not.toBeInTheDocument();
  });

  // Regression: founder report, 2026-08-07 -- the notification bell was
  // only ever rendered inside the desktop nav (`hidden lg:flex`), so it
  // was completely unreachable on mobile, not just visually hidden.
  describe('notification bell on mobile', () => {
    beforeEach(() => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: { id: 'user-1', email: 'jane@example.com' },
        profile: { id: 'user-1', full_name: 'Jane Doe', role: 'student', verified: false, avatar_url: null },
        signOut: vi.fn(),
      } as never);
      vi.spyOn(notificationsLib, 'fetchNotifications').mockResolvedValue([]);
    });

    // The desktop bell (inside the `hidden lg:flex` container) is always
    // present in the DOM regardless of viewport -- Tailwind's responsive
    // classes are CSS-only and inert under jsdom -- so "reachable on
    // mobile" is checked via the "Notifications" text label, which only
    // exists in the mobile-menu row, not the desktop one.
    it('has no "Notifications" label before the hamburger menu is opened', () => {
      renderHeader('home');
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('shows a second, labeled bell once the mobile menu is opened', async () => {
      const user = userEvent.setup();
      renderHeader('home');

      const bellsBefore = screen.getAllByLabelText(/^notifications/i);
      await user.click(screen.getByRole('button', { name: /open menu/i }));

      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getAllByLabelText(/^notifications/i)).toHaveLength(bellsBefore.length + 1);
    });
  });
});
