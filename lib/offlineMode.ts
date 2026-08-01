// Offline-mode opt-in preference (founder request, 2026-08-01). Mirrors
// lib/i18n.ts's locale-storage triad exactly -- device-local only, no
// database column/migration, since connectivity is inherently a per-device
// concern (a user's laptop and phone can have very different networks).
const OFFLINE_MODE_STORAGE_KEY = 'slearn_offline_mode_enabled';

export function isOfflineModeEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(OFFLINE_MODE_STORAGE_KEY) === 'true';
}

export function setOfflineModeEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(OFFLINE_MODE_STORAGE_KEY, String(enabled));
}
