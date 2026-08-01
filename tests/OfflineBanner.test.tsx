import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineBanner from '../components/UI/OfflineBanner';
import { LocaleProvider } from '../contexts/LocaleContext';
import * as offlineContext from '../contexts/OfflineContext';

function renderBanner() {
  return render(
    <LocaleProvider>
      <OfflineBanner />
    </LocaleProvider>
  );
}

describe('OfflineBanner', () => {
  // Regression: the banner must only ever appear for a user who opted in
  // AND is actually offline -- a user who never enabled offline mode
  // should see nothing at all if their connection drops.
  it('shows nothing when online, regardless of the offline-mode preference', () => {
    vi.spyOn(offlineContext, 'useOfflineStatus').mockReturnValue({
      isOnline: true,
      offlineModeEnabled: true,
      setOfflineModeEnabled: vi.fn(),
    });
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows nothing when offline but the user never enabled offline mode', () => {
    vi.spyOn(offlineContext, 'useOfflineStatus').mockReturnValue({
      isOnline: false,
      offlineModeEnabled: false,
      setOfflineModeEnabled: vi.fn(),
    });
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the banner when offline and offline mode is enabled', () => {
    vi.spyOn(offlineContext, 'useOfflineStatus').mockReturnValue({
      isOnline: false,
      offlineModeEnabled: true,
      setOfflineModeEnabled: vi.fn(),
    });
    renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  });

  it('renders in French when the locale is French', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR', onLine: false });
    localStorage.clear();
    vi.spyOn(offlineContext, 'useOfflineStatus').mockReturnValue({
      isOnline: false,
      offlineModeEnabled: true,
      setOfflineModeEnabled: vi.fn(),
    });

    renderBanner();
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
