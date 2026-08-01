import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfflineProvider, useOfflineStatus } from '../contexts/OfflineContext';
import { isOfflineModeEnabled } from '../lib/offlineMode';

function Probe() {
  const { isOnline, offlineModeEnabled, setOfflineModeEnabled } = useOfflineStatus();
  return (
    <div>
      <span>{isOnline ? 'online' : 'offline'}</span>
      <span>{offlineModeEnabled ? 'enabled' : 'disabled'}</span>
      <button onClick={() => setOfflineModeEnabled(true)}>enable</button>
      <button onClick={() => setOfflineModeEnabled(false)}>disable</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <OfflineProvider>
      <Probe />
    </OfflineProvider>
  );
}

describe('OfflineContext', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  it('reflects navigator.onLine at mount', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    renderProbe();
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('updates when the browser fires online/offline events', () => {
    renderProbe();
    expect(screen.getByText('online')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('offline')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText('online')).toBeInTheDocument();
  });

  it('defaults offlineModeEnabled to false and persists enabling it', async () => {
    const user = userEvent.setup();
    renderProbe();

    expect(screen.getByText('disabled')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'enable' }));
    expect(screen.getByText('enabled')).toBeInTheDocument();
    expect(isOfflineModeEnabled()).toBe(true);

    await user.click(screen.getByRole('button', { name: 'disable' }));
    expect(screen.getByText('disabled')).toBeInTheDocument();
    expect(isOfflineModeEnabled()).toBe(false);
  });
});
