import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as authContext from '../contexts/AuthContext';
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
});
