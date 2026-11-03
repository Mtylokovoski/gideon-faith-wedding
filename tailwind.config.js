/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lavender: {
          50: '#F8F5FD',
          100: '#EFE9F9',
          200: '#E0D4F2',
          300: '#CBB6E8',
          400: '#B094DA',
          500: '#9674C8',
          600: '#7C58B0',
          700: '#634693',
          800: '#4B3472',
          900: '#352353',
        },
        ivory: { DEFAULT: '#FBF8F1', dark: '#F3EDE0' },
        champagne: {
          300: '#E6D3A8',
          400: '#D9BD86',
          500: '#C9A96E',
          600: '#B08F52',
          700: '#8E713E',
        },
      },
      fontFamily: {
        script: ['"Great Vibes"', 'cursive'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
