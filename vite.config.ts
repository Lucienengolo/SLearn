import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
