import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Manual registration (lib/serviceWorkerUpdates.ts) instead of the
      // plugin's auto-injected registerSW.js -- the auto-injected script has
      // no hook into app code, so a new SW activates (skipWaiting/
      // clientsClaim already run unconditionally) without ever reloading an
      // already-open tab. Founder report, 2026-08-05: a deploy went live
      // (confirmed via curl) but their browser kept serving the old
      // precached bundle indefinitely.
      injectRegister: false,
      includeAssets: ['3D_S-Logo-removebg.png'],
      workbox: {
        // Precache the app shell + hashed build assets so repeat visits and
        // flaky mobile connections (the design's stated target market) can
        // still load the UI; Supabase API calls are not cached — this is
        // shell-offline, not data-offline.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
      manifest: {
        name: 'S@Learn — Online Learning Platform',
        short_name: 'S@Learn',
        description: 'Mobile-first online learning platform for African markets.',
        theme_color: '#157A4D',
        background_color: '#FBFCFB',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/3D_S-Logo-removebg.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/3D_S-Logo-removebg.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/3D_S-Logo-removebg.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
