/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './main.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Mirrors _ds/longrich-design-system.../tokens/colors.css so
      // bg-primary-*/text-primary-* utilities match the design system.
      colors: {
        primary: {
          50: '#EAF6EF',
          100: '#CFEADB',
          200: '#A3D9BC',
          300: '#6FC397',
          400: '#3DA876',
          500: '#1E8F5E',
          600: '#157A4D',
          700: '#0F5F3C',
          800: '#0A4329',
          900: '#06301D',
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
      },
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
