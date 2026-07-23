/** @type {import('tailwindcss').Config} */
export default {
  // lib/**/*.ts added 2026-07-23: lib/totems.ts holds Tailwind class strings
  // as plain data (color per totem badge), not JSX -- without this glob the
  // JIT scanner never sees those literal class names and the badges would
  // render unstyled in a production build.
  content: ['./index.html', './App.tsx', './main.tsx', './components/**/*.{ts,tsx}', './lib/**/*.ts'],
  theme: {
    extend: {
      // The design system's own raw default (_ds/.../tokens/colors.css)
      // maps --color-primary to green, with gold reserved as a separate
      // "reward" accent. But S@Learn's own prototypes (improved/*.dc.html)
      // explicitly override this per the app's actual yellow/gold brand
      // (--color-primary: var(--gold-500), scoped to the .sl class) --
      // green stays reserved for real success states (Tailwind's built-in
      // green-* utilities, used separately and left untouched).
      // Buttons pairing bg-primary-600 with text-white assumed a dark
      // green background; gold-600 (#A66E13) doesn't have safe contrast
      // with white text (~4.45:1, just under AA's 4.5:1), so button
      // markup was updated alongside this to bg-primary-500 text-gray-900
      // (dark-on-gold), matching the design system's --on-primary token.
      colors: {
        primary: {
          50: '#FBF3E1',
          100: '#F6E4BC',
          200: '#EFCD83',
          300: '#E8B84F',
          400: '#E2A52A',
          500: '#C8881C',
          600: '#A66E13',
          700: '#835611',
          800: '#5E3E0C',
          900: '#3D2807',
        },
        gold: {
          50: '#FBF3E1',
          100: '#F6E4BC',
          200: '#EFCD83',
          300: '#E8B84F',
          400: '#E2A52A',
          500: '#C8881C',
          600: '#A66E13',
          700: '#835611',
        },
        // New, non-colliding addition (design system tokens the app's
        // pages are being ported to page-by-page -- see README §5.E). We
        // deliberately do NOT override gray-*/rounded-lg/shadow-md/text-3xl
        // etc.: those are used by every not-yet-rebuilt page, and changing
        // them globally would shift every page at once instead of the one
        // currently being ported. Pages being rebuilt reference exact
        // design-system values directly via arbitrary-value syntax
        // (e.g. rounded-[var(--radius-lg)]) instead.
        canvas: {
          25: '#FBFCFB',
          150: '#E6E9E3',
        },
        // DESIGN.md's ink-and-paper system (approved 2026-07-17), used only
        // by pages built against it so far (components/Tutors/*) -- same
        // non-colliding incremental-porting approach as `canvas` above.
        // Not a replacement for primary/gold/canvas, which existing pages
        // still use.
        ink: '#14171F',
        paper: '#F7F3EA',
        oxblood: { DEFAULT: '#9C3B2E', hover: '#7C2E23' },
        forest: '#1F5C4E',
        'warm-gray': { DEFAULT: '#8A8578', light: '#D8D2C4' },
        'ink-border': '#E4DDCC',
      },
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        // DESIGN.md typography (Fraunces/General Sans/IBM Plex Mono) --
        // additive, see the `ink`/`paper`/etc. color comment above.
        fraunces: ['Fraunces', 'serif'],
        'general-sans': ['General Sans', '-apple-system', 'sans-serif'],
        'plex-mono': ['IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '11px',
        md: '14px',
      },
      borderRadius: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
