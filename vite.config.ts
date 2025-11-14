import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',   // <-- REQUIRED FOR VERCEL
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
