// Founder report, 2026-08-05: a deploy went live (confirmed via curl) but
// the tester's browser kept serving the old cache-first-precached bundle
// indefinitely -- the PWA's service worker (vite-plugin-pwa,
// registerType: 'autoUpdate') activates a new version's skipWaiting/
// clientsClaim automatically, but nothing ever told the already-open tab
// to actually reload and pick it up. updateSW(true) is the plugin's
// built-in "take control and reload this tab now" call -- no custom
// banner needed, this just makes every future deploy actually reach open
// tabs instead of requiring a user to know to hard-refresh.
export function initServiceWorkerUpdates(): void {
  if (import.meta.env.DEV) return; // no service worker in dev

  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({ onNeedRefresh: () => updateSW(true) });
  });
}
