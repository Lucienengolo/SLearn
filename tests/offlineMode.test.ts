import { describe, it, expect, beforeEach } from 'vitest';
import { isOfflineModeEnabled, setOfflineModeEnabled } from '../lib/offlineMode';

describe('offlineMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to disabled when nothing is stored', () => {
    expect(isOfflineModeEnabled()).toBe(false);
  });

  it('persists enabling the preference', () => {
    setOfflineModeEnabled(true);
    expect(isOfflineModeEnabled()).toBe(true);
  });

  it('persists disabling the preference', () => {
    setOfflineModeEnabled(true);
    setOfflineModeEnabled(false);
    expect(isOfflineModeEnabled()).toBe(false);
  });
});
