/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Golden Yellow primary palette based on #F4C300
        primary: {
          50: '#fff9e6',
          100: '#fff2cc',
          200: '#ffe699',
          300: '#ffd866',
          400: '#ffca33',
          500: '#F4C300',
          600: '#d0a300',
          700: '#a67b00',
          800: '#7d5300',
          900: '#553500',
        },
      },
    },
  },
  plugins: [],
};
